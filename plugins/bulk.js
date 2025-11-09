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

const pendingBulk = {}; // { sender: { step, contacts, messageText, stop } }

function getRandomDelay() {
  return BULK_DELAY_MIN + Math.random() * (BULK_DELAY_MAX - BULK_DELAY_MIN);
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function loadContacts() {
  for (const file of CONTACT_PATHS) {
    if (!fs.existsSync(file)) continue;
    const ext = path.extname(file).toLowerCase();
    const data = fs.readFileSync(file, "utf-8");
    if (ext === ".json") {
      const arr = JSON.parse(data);
      return arr.map(x => ({ name: x.name || "", phone: (x.phone || "").toString().replace(/[^0-9]/g, "") }));
    } else if (ext === ".csv") {
      const records = parse(data, { columns: true, skip_empty_lines: true });
      return records.map(r => ({ name: r.Name || r.name || "", phone: (r.Phone || r.phone || "").toString().replace(/[^0-9]/g, "") }));
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
  filename: __filename
}, async (bot, mek, m, { from, sender, reply }) => {
  if (sender !== OWNER_JID) return reply("🚫 Owner-only command.");

  // Load contacts
  const contacts = loadContacts();
  if (!contacts.length) return reply("⚠️ No contacts found. Upload your CSV or JSON file to /data folder.");

  // Ask for message
  await reply(
    `📢 *BULK MESSAGE MODE*\n────────────────────\n✅ Loaded *${contacts.length} contacts.*\n\nPlease *reply with the message* you want to send to all.\nYou can use *{name}* in your message to personalize each text.\nType *CANCEL* to abort.`
  );

  // Store pending session
  pendingBulk[sender] = { step: "await_message", contacts };
});

// ============================
// REPLY HANDLER: Wait for message
// ============================
cmd({
  filter: (text, { sender }) => pendingBulk[sender] && pendingBulk[sender].step === "await_message"
}, async (bot, mek, m, { sender, body, reply }) => {
  const msg = body.trim();
  if (msg.toLowerCase() === "cancel") {
    delete pendingBulk[sender];
    return reply("❌ Bulk message cancelled.");
  }

  const session = pendingBulk[sender];
  session.messageText = msg;
  session.stop = false;
  session.step = "sending";

  reply(`🚀 Sending your message to *${session.contacts.length}* contacts...\nType *STOP* anytime to halt.`);

  startBulkSend(bot, sender, session);
});

// ============================
// STOP command
// ============================
cmd({
  pattern: "stop",
  react: "🛑",
  desc: "Stop the bulk message process",
  category: "crm",
  filename: __filename
}, async (bot, mek, m, { sender, reply }) => {
  if (pendingBulk[sender] && pendingBulk[sender].step === "sending") {
    pendingBulk[sender].stop = true;
    return reply("🛑 Stopping bulk message process...");
  }
});

// ============================
// BULK SENDING FUNCTION
// ============================
async function startBulkSend(bot, owner, session) {
  const { contacts, messageText } = session;
  const log = [];
  let sent = 0;
  let failed = 0;

  for (const c of contacts) {
    if (session.stop) break;

    const jid = `${c.phone}@s.whatsapp.net`;
    const text = messageText.replace(/\{name\}/g, c.name || "there");

    let success = false;
    let attempts = 0;

    while (!success && attempts <= MAX_RETRIES) {
      attempts++;
      try {
        await bot.sendMessage(jid, { text });
        success = true;
        sent++;
        log.push({ phone: c.phone, name: c.name, status: "sent" });
      } catch (err) {
        if (attempts > MAX_RETRIES) {
          failed++;
          log.push({ phone: c.phone, name: c.name, status: "failed", error: err.message });
        } else {
          await sleep(2000);
        }
      }
    }

    await sleep(getRandomDelay());

    if ((sent + failed) % 10 === 0) {
      await bot.sendMessage(owner, { text: `📤 Progress: ${sent} sent, ${failed} failed.` });
    }
  }

  const result = `✅ *Bulk message process complete!*\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}`;
  await bot.sendMessage(owner, { text: result });

  const logPath = path.join(__dirname, "..", "data", `bulk_log_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  await bot.sendMessage(owner, {
    document: fs.readFileSync(logPath),
    fileName: path.basename(logPath),
    mimetype: "application/json"
  });

  delete pendingBulk[owner];
}
