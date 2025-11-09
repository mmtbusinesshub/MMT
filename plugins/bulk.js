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
  await bot.sendMessage(sender, {
    text: `📢 *BULK MESSAGE MODE*\n────────────────────\n✅ Loaded *${contacts.length} contacts.*\n\nPlease *type your message* that you want to send to all contacts.\n\nYou can use *{name}* in your message to personalize each text.\n\nType *CANCEL* to abort.`
  });

  // store pending session
  sessions[sender] = {
    step: "awaiting_message",
    contacts
  };
});

// ============================
// OWNER REPLY HANDLER
// ============================
cmd({
  on: "text",
}, async (bot, mek, m, { sender, body, reply }) => {
  if (sender !== OWNER_JID) return; // only owner can trigger

  const session = sessions[sender];
  if (!session) return; // no pending session

  const msg = body?.trim();
  if (!msg) return;

  // Handle cancel
  if (msg.toLowerCase() === "cancel") {
    delete sessions[sender];
    return reply("❌ Bulk message cancelled.");
  }

  // Handle stop
  if (msg.toLowerCase() === "stop" && session.step === "sending") {
    session.stop = true;
    return reply("🛑 Stopping bulk message process...");
  }

  // Handle message input step
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
// BULK SEND LOGIC
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
          if (tries > MAX_RETRIES) {
            failed++;
            log.push({ phone: c.phone, name: c.name, status: "failed", error: err.message });
          } else {
            await sleep(2000);
          }
        }
      }

      if (i < contacts.length - 1 && !session.stop) {
        await sleep(getRandomDelay());
      }

      if ((sent + failed) % 10 === 0 || (sent + failed) === contacts.length) {
        await bot.sendMessage(owner, { 
          text: `📤 Progress: ${sent} sent, ${failed} failed. (${Math.round(((sent + failed) / contacts.length) * 100)}%)`
        });
      }
    }

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
        fileName: path.basename(logPath),
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
