const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { cmd } = require("../command");

const OWNER_JID = "94774915917@s.whatsapp.net";
const CONTACT_PATHS = [
  path.join(__dirname, "..", "data", "contacts.csv"),
  path.join(__dirname, "..", "data", "contacts.json"),
];

const BULK_DELAY_MIN = 10000;
const BULK_DELAY_MAX = 25000;
const MAX_RETRIES = 2;

const sessions = {}; // tracks pending sessions

function getRandomDelay() {
  return BULK_DELAY_MIN + Math.random() * (BULK_DELAY_MAX - BULK_DELAY_MIN);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function loadContacts() {
  for (const file of CONTACT_PATHS) {
    if (fs.existsSync(file)) {
      const ext = path.extname(file).toLowerCase();
      const data = fs.readFileSync(file, "utf-8");
      try {
        if (ext === ".json") {
          const arr = JSON.parse(data);
          return arr.map((x) => ({
            name: x.name || "",
            phone: (x.phone || "").toString().replace(/[^0-9]/g, ""),
          }));
        } else if (ext === ".csv") {
          const records = parse(data, { columns: true, skip_empty_lines: true });
          return records.map((r) => ({
            name: r.Name || r.name || "",
            phone: (r.Phone || r.phone || "").toString().replace(/[^0-9]/g, ""),
          }));
        }
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
        continue;
      }
    }
  }
  return [];
}

// ============================
// COMMAND: .whatsapp
// ============================
cmd({
  pattern: "whatsapp",
  react: "💬",
  desc: "Send bulk WhatsApp messages to uploaded contacts",
  category: "crm",
  filename: __filename,
}, async (bot, mek, m, { reply, sender }) => {
  if (sender !== OWNER_JID) return reply("🚫 Owner-only command.");

  const contacts = loadContacts();
  if (!contacts.length)
    return reply("⚠️ No contacts found. Upload your CSV or JSON file to /data folder.");

  // Ask owner for message text
  await reply(`📢 *BULK MESSAGE MODE*\n────────────────────\n✅ Loaded *${contacts.length} contacts.*\n\nPlease *type your message* that you want to send to all contacts.\n\nYou can use *{name}* in your message to personalize each text.\n\nType *CANCEL* to abort.`);

  // store pending session
  sessions[sender] = {
    step: "awaiting_message",
    contacts,
    createdAt: Date.now()
  };
});

// ============================
// FIXED REPLY HANDLER
// ============================
cmd({
  filter: (text, { sender }) => {
    // Check if user has an active session AND message is not a command
    return sessions[sender] && 
           !text.startsWith('.') && 
           !text.startsWith('!') && 
           sessions[sender].step === "awaiting_message";
  }
}, async (bot, mek, m, { sender, body, reply }) => {
  const session = sessions[sender];
  if (!session) return;

  const msg = body?.trim();
  if (!msg) return;

  // Handle cancel
  if (msg.toLowerCase() === "cancel") {
    delete sessions[sender];
    return reply("❌ Bulk message cancelled.");
  }

  // Process the message input
  if (session.step === "awaiting_message") {
    session.message = msg;
    session.step = "sending";
    session.stop = false;

    await reply(`🚀 Starting to send your message to *${session.contacts.length}* contacts...\n\nType *STOP* anytime to halt sending.`);

    // Start sending
    startBulkSend(bot, sender, session);
  }
});

// ============================
// STOP COMMAND HANDLER
// ============================
cmd({
  filter: (text, { sender }) => {
    return sessions[sender] && 
           session.step === "sending" && 
           text.toLowerCase() === "stop";
  }
}, async (bot, mek, m, { sender, reply }) => {
  const session = sessions[sender];
  if (session && session.step === "sending") {
    session.stop = true;
    await reply("🛑 Stopping bulk message process...");
  }
});

// ============================
// BULK SEND LOGIC (Improved)
// ============================
async function startBulkSend(bot, owner, session) {
  const { contacts, message } = session;
  const log = [];
  let sent = 0;
  let failed = 0;

  try {
    for (let i = 0; i < contacts.length; i++) {
      if (session.stop) {
        await bot.sendMessage(owner, { 
          text: `⏹️ Process stopped.\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Remaining: ${contacts.length - (sent + failed)}`
        });
        break;
      }

      const c = contacts[i];
      const jid = `${c.phone}@s.whatsapp.net`;
      const personalized = message.replace(/\{name\}/g, c.name || "there");

      let success = false;
      let tries = 0;

      while (!success && tries <= MAX_RETRIES) {
        tries++;
        try {
          await bot.sendMessage(jid, { text: personalized });
          success = true;
          sent++;
          log.push({ phone: c.phone, name: c.name, status: "sent" });
          console.log(`✅ Sent to ${c.phone}`);
        } catch (err) {
          console.error(`Failed to send to ${c.phone} (attempt ${tries}):`, err.message);
          if (tries > MAX_RETRIES) {
            failed++;
            log.push({ phone: c.phone, name: c.name, status: "failed", error: err.message });
          } else {
            await sleep(2000 * tries);
          }
        }
      }

      // Progress updates every 5 messages
      if ((sent + failed) % 5 === 0 || (sent + failed) === contacts.length) {
        await bot.sendMessage(owner, { 
          text: `📤 Progress: ${sent} sent, ${failed} failed. (${Math.round(((sent + failed) / contacts.length) * 100)}%)`
        });
      }

      // Delay between messages
      if (i < contacts.length - 1 && !session.stop) {
        const delay = getRandomDelay();
        await sleep(delay);
      }
    }

    // Final summary
    const summary = session.stop
      ? `⏹️ *Process stopped!*\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Remaining: ${contacts.length - (sent + failed)}`
      : `✅ *Bulk message complete!*\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Total: ${contacts.length}`;

    await bot.sendMessage(owner, { text: summary });

    // Save log file
    if (sent > 0 || failed > 0) {
      const logPath = path.join(__dirname, "..", "data", `bulk_log_${Date.now()}.json`);
      fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
      await bot.sendMessage(owner, {
        document: fs.readFileSync(logPath),
        fileName: `bulk_report_${new Date().toISOString().split('T')[0]}.json`,
        mimetype: "application/json",
      });
    }
  } catch (err) {
    console.error("Bulk send error:", err);
    await bot.sendMessage(owner, { text: `❌ Bulk send failed: ${err.message}` });
  } finally {
    delete sessions[owner];
  }
}

// ============================
// SESSION CLEANUP (Optional)
// ============================
// Clean up old sessions every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(sessions).forEach(jid => {
    if (now - sessions[jid].createdAt > 30 * 60 * 1000) { // 30 minutes
      delete sessions[jid];
    }
  });
}, 60 * 60 * 1000);
