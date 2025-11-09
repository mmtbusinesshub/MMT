const fs = require("fs");
const path = require("path");
const csvParse = require("csv-parse/sync");
const { cmd } = require("../command");

const OWNER_JID = "94774915917@s.whatsapp.net"; // 🔒 Change to your number JID
const CONTACT_PATHS = [
  path.join(__dirname, "..", "data", "contacts.csv"),
  path.join(__dirname, "..", "data", "contacts.json"),
];

const BULK_DELAY_MIN = 10000; // 10s
const BULK_DELAY_MAX = 25000; // 25s
const MAX_RETRIES = 2;

const pendingBulk = new Map(); // stores pending message state

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
          phone: (x.phone || "").toString(),
        }));
      } else if (ext === ".csv") {
        const records = csvParse.parse(data, { columns: true });
        return records.map((r) => ({
          name: r.name || "",
          phone: (r.phone || "").toString(),
        }));
      }
    }
  }
  return [];
}

cmd(
  {
    pattern: "whatsapp",
    react: "📢",
    desc: "Send bulk WhatsApp messages to uploaded contact list",
    category: "crm",
    filename: __filename,
  },
  async (conn, mek, m, { reply }) => {
    const sender = mek.key.participant || mek.key.remoteJid;
    if (sender !== OWNER_JID) return reply("🚫 Owner-only command.");

    const contacts = loadContacts();
    if (!contacts.length)
      return reply("⚠️ No contacts found in /data folder.");

    reply(
      `📋 Found *${contacts.length} contacts*.\n\n📝 Please *reply to this message* with the text you want to send.\n\nType *CANCEL* to abort.`
    );

    pendingBulk.set(sender, {
      step: "await_message",
      contacts,
      timestamp: Date.now(),
    });
  }
);

// ============================
// REPLY HANDLER (like bank.js)
// ============================
module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content || key.fromMe) return;

      const text =
        content.conversation ||
        content.extendedTextMessage?.text ||
        "";
      if (!text.trim()) return;

      const sender = key.participant || key.remoteJid;
      const state = pendingBulk.get(sender);
      if (!state) return;

      const msg = text.trim();

      if (msg.toLowerCase() === "cancel") {
        pendingBulk.delete(sender);
        return conn.sendMessage(sender, { text: "❌ Bulk message cancelled." });
      }

      if (state.step === "await_message") {
        const messageText = msg;
        conn.sendMessage(sender, {
          text: `📢 Sending message to *${state.contacts.length} contacts*.\n\nType *STOP* anytime to cancel.`,
        });

        pendingBulk.set(sender, {
          ...state,
          step: "sending",
          messageText,
          stopRequested: false,
        });

        const updated = pendingBulk.get(sender);
        startBulkSend(conn, sender, updated);
      } else if (state.step === "sending" && msg.toLowerCase() === "stop") {
        state.stopRequested = true;
        conn.sendMessage(sender, { text: "🛑 Stopping bulk message..." });
      }
    } catch (err) {
      console.error("❌ Bulk reply handler error:", err);
    }
  },
};

// ============================
// BULK SENDER FUNCTION
// ============================
async function startBulkSend(conn, owner, state) {
  const log = [];
  let sent = 0;
  let failed = 0;

  for (const c of state.contacts) {
    if (state.stopRequested) break;

    const jid = `${c.phone}@s.whatsapp.net`;
    const text = state.messageText.replace(/\{name\}/g, c.name || "");

    let success = false;
    let attempts = 0;

    while (!success && attempts <= MAX_RETRIES) {
      attempts++;
      try {
        await conn.sendMessage(jid, { text });
        success = true;
        sent++;
        log.push({ phone: c.phone, status: "sent" });
      } catch (e) {
        console.error(`⚠️ Failed to send to ${c.phone}:`, e.message);
        if (attempts > MAX_RETRIES) {
          failed++;
          log.push({ phone: c.phone, status: "failed", error: e.message });
        } else {
          await sleep(2000);
        }
      }
    }

    await sleep(getRandomDelay());

    if ((sent + failed) % 10 === 0) {
      conn.sendMessage(owner, {
        text: `📤 Progress: ${sent} sent, ${failed} failed.`,
      });
    }
  }

  const resultText = `✅ *Bulk message complete!*\n\n📬 Sent: ${sent}\n❌ Failed: ${failed}`;
  conn.sendMessage(owner, { text: resultText });

  const logPath = path.join(
    __dirname,
    "..",
    "data",
    `bulk_log_${Date.now()}.json`
  );
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  await conn.sendMessage(owner, {
    document: fs.readFileSync(logPath),
    fileName: path.basename(logPath),
    mimetype: "application/json",
  });

  pendingBulk.delete(owner);
}
