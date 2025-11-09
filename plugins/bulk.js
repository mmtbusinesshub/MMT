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

const pendingBulk = {}; // tracks bulk send sessions

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

  // Ask owner for message content
  await bot.sendMessage(sender, {
    text: `📢 *BULK MESSAGE MODE*\n────────────────────\n✅ Loaded *${contacts.length} contacts.*\n\nPlease *type your message* that you want to send to all contacts.\n\nYou can use *{name}* in your message to personalize each text.\n\nType *CANCEL* to abort.`
  });

  // Create pending session
  pendingBulk[sender] = {
    step: "await_message",
    contacts,
  };
});

// ============================
// REPLY HANDLER: Capture message from owner
// ============================
cmd({
  filter: (text, { sender }) =>
    pendingBulk[sender] &&
    pendingBulk[sender].step === "await_message" &&
    sender === OWNER_JID
}, async (bot, mek, m, { reply, sender, body }) => {
  const msg = body.trim();

  // Cancel
  if (msg.toLowerCase() === "cancel") {
    delete pendingBulk[sender];
    return reply("❌ Bulk message cancelled.");
  }

  if (!msg) return reply("⚠️ Please send a valid message or type CANCEL to abort.");

  const session = pendingBulk[sender];
  session.messageText = msg;
  session.step = "sending";
  session.stop = false;

  await reply(`🚀 Starting to send your message to *${session.contacts.length}* contacts...\n\nType *STOP* anytime to halt sending.`);

  // Start sending after message received
  startBulkSend(bot, sender, session);
});

// ============================
// STOP COMMAND: Stop ongoing bulk send
// ============================
cmd({
  filter: (text, { sender }) =>
    pendingBulk[sender] &&
    pendingBulk[sender].step === "sending" &&
    text.trim().toLowerCase() === "stop" &&
    sender === OWNER_JID
}, async (bot, mek, m, { reply, sender }) => {
  pendingBulk[sender].stop = true;
  await reply("🛑 Stopping bulk message process...");
});

// ============================
// BULK SEND FUNCTION
// ============================
async function startBulkSend(bot, owner, session) {
  const contacts = session.contacts;
  const message = session.messageText;
  const log = [];
  let sent = 0;
  let failed = 0;

  try {
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];

      if (session.stop) {
        await bot.sendMessage(owner, {
          text: `⏹️ Process stopped by user.\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Remaining: ${contacts.length - (sent + failed)}`
        });
        break;
      }

      const jid = `${c.phone}@s.whatsapp.net`;
      const personalizedMessage = message.replace(/\{name\}/g, c.name || "there");

      let success = false;
      let attempts = 0;

      while (!success && attempts <= MAX_RETRIES) {
        attempts++;
        try {
          await bot.sendMessage(jid, { text: personalizedMessage });
          success = true;
          sent++;
          log.push({ phone: c.phone, name: c.name, status: "sent" });
          console.log(`✅ Sent to ${c.phone}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${c.phone}:`, err.message);
          if (attempts > MAX_RETRIES) {
            failed++;
            log.push({ phone: c.phone, name: c.name, status: "failed", error: err.message });
          } else {
            await sleep(2000);
          }
        }
      }

      if (i < contacts.length - 1 && !session.stop) {
        const delay = getRandomDelay();
        await sleep(delay);
      }

      if (((sent + failed) % 10 === 0 || (sent + failed) === contacts.length) && !session.stop) {
        const progress = Math.round(((sent + failed) / contacts.length) * 100);
        await bot.sendMessage(owner, {
          text: `📤 Progress: ${sent} sent, ${failed} failed. (${progress}%)`
        });
      }
    }

    const result = session.stop
      ? `⏹️ *Bulk message process stopped!*\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Remaining: ${contacts.length - (sent + failed)}`
      : `✅ *Bulk message process complete!*\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Total: ${contacts.length}`;

    await bot.sendMessage(owner, { text: result });

    if (sent > 0 || failed > 0) {
      const logPath = path.join(__dirname, "..", "data", `bulk_log_${Date.now()}.json`);
      fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

      await bot.sendMessage(owner, {
        document: fs.readFileSync(logPath),
        fileName: `bulk_log_${Date.now()}.json`,
        mimetype: "application/json",
      });
    }
  } catch (error) {
    console.error("Bulk send error:", error);
    await bot.sendMessage(owner, { text: `❌ Bulk message process failed: ${error.message}` });
  } finally {
    delete pendingBulk[owner];
  }
}
