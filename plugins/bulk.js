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

const pendingBulk = {}; // stores pending sessions per sender

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

  // Ask owner to paste the message
  await reply(
    `📢 *BULK MESSAGE MODE*\n────────────────────\n✅ Loaded *${contacts.length} contacts.*\n\nPlease *reply with the message* you want to send to all.\n\nYou can use *{name}* in your message to personalize each text.\n\nType *CANCEL* to abort.`
  );

  // Set pending session to await message
  pendingBulk[sender] = {
    step: "await_message",
    contacts,
  };
});

// ============================
// MESSAGE HANDLER: Capture the message reply
// ============================
cmd({
  on: "message"
}, async (bot, mek, m, { reply, sender, body }) => {
  // Check if user has a pending bulk session waiting for message
  if (pendingBulk[sender] && pendingBulk[sender].step === "await_message") {
    const msg = body.trim();
    
    // Handle cancel command
    if (msg.toLowerCase() === "cancel") {
      delete pendingBulk[sender];
      return reply("❌ Bulk message cancelled.");
    }

    // Prevent empty messages
    if (!msg) {
      return reply("⚠️ Please send a valid message or type CANCEL to abort.");
    }

    const session = pendingBulk[sender];
    
    // Update session with message and start sending
    session.messageText = msg;
    session.step = "sending";
    session.stop = false;

    await reply(
      `🚀 Sending your message to *${session.contacts.length}* contacts...\n\nType *STOP* anytime to halt sending.`
    );

    // Start the bulk sending process
    startBulkSend(bot, sender, session);
  }
});

// ============================
// Stop command handler
// ============================
cmd({
  pattern: "stop",
  desc: "Stop ongoing bulk message sending"
}, async (bot, mek, m, { reply, sender }) => {
  if (pendingBulk[sender] && pendingBulk[sender].step === "sending") {
    pendingBulk[sender].stop = true;
    await reply("🛑 Stopping bulk message process...");
  }
});

// ============================
// BULK SENDER LOGIC
// ============================
async function startBulkSend(bot, owner, session) {
  const contacts = session.contacts;
  const message = session.messageText;
  const log = [];
  let sent = 0;
  let failed = 0;

  for (const c of contacts) {
    // Check if stop command was issued
    if (session.stop) {
      await bot.sendMessage(owner, { 
        text: `⏹️ Process stopped by user.\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Remaining: ${contacts.length - (sent + failed)}`
      });
      break;
    }

    const jid = `${c.phone}@s.whatsapp.net`;
    const text = message.replace(/\{name\}/g, c.name || "there");

    let success = false;
    let attempts = 0;

    // Retry logic
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
          await sleep(2000); // Wait 2 seconds before retry
        }
      }
    }

    // Random delay between messages
    await sleep(getRandomDelay());

    // Progress update every 10 messages
    if ((sent + failed) % 10 === 0) {
      await bot.sendMessage(owner, { 
        text: `📤 Progress: ${sent} sent, ${failed} failed. (${Math.round(((sent + failed) / contacts.length) * 100)}%)` 
      });
    }
  }

  // Final report
  const result = `✅ *Bulk message process complete!*\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}\n📋 Total: ${contacts.length}`;
  await bot.sendMessage(owner, { text: result });

  // Save and send log
  const logPath = path.join(__dirname, "..", "data", `bulk_log_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  await bot.sendMessage(owner, {
    document: fs.readFileSync(logPath),
    fileName: path.basename(logPath),
    mimetype: "application/json",
  });

  // Clean up session
  delete pendingBulk[owner];
}
