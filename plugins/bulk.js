const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { cmd } = require("../command");

const OWNER_JID = "94774915917@s.whatsapp.net"; // change to your real owner JID
const CONTACT_PATHS = [
  path.join(__dirname, "..", "data", "contacts.csv"),
  path.join(__dirname, "..", "data", "contacts2.csv"),
];

// Load all contacts from CSV
function loadContacts() {
  const contacts = [];
  for (const filePath of CONTACT_PATHS) {
    if (fs.existsSync(filePath)) {
      const csvData = fs.readFileSync(filePath, "utf-8");
      const parsed = parse(csvData, { columns: true, skip_empty_lines: true });
      for (const row of parsed) {
        if (row.number) {
          const jid = row.number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
          contacts.push(jid);
        }
      }
    }
  }
  return contacts;
}

let pendingBulk = null;

// ✅ Command to start bulk messaging
cmd(
  {
    pattern: "bulk",
    react: "📝",
    desc: "Send a bulk message to all contacts",
    category: "owner",
    filename: __filename,
  },
  async (conn, mek, m, { sender, reply }) => {
    if (sender !== OWNER_JID) {
      return reply("⛔ Only the owner can use this command.");
    }

    reply(
      "📝 *Please type the message you want to send to your contact list.*\n\n✍️ I'll wait for your next message."
    );

    pendingBulk = {
      started: true,
      from: sender,
      key: mek.key, // to track original message
      time: Date.now(),
    };
  }
);

// ✅ Filter to catch the owner's next message
cmd.filter(
  (text, { sender, message }) => {
    return (
      pendingBulk &&
      pendingBulk.started &&
      sender === pendingBulk.from &&
      message?.key // 🧠 check that message exists before accessing key
    );
  },
  async (conn, mek, m, { sender, reply, body }) => {
    try {
      if (!pendingBulk) return;

      const msg = body?.trim();
      if (!msg) return reply("❌ Please send a valid message.");

      const contacts = loadContacts();
      if (contacts.length === 0)
        return reply("⚠️ No contacts found in CSV files.");

      reply(
        `📢 Sending your message to *${contacts.length}* contacts...\n\n🕒 Please wait, this might take a few minutes.`
      );

      let sent = 0;
      for (const jid of contacts) {
        await conn.sendMessage(jid, { text: msg });
        sent++;
        await new Promise((r) => setTimeout(r, 1500)); // 1.5s delay
      }

      reply(`✅ Bulk message sent to *${sent}* contacts successfully!`);

      pendingBulk = null; // clear state
    } catch (err) {
      console.error("Bulk error:", err);
      reply("❌ Failed to send bulk message. Check console for details.");
      pendingBulk = null;
    }
  }
);
