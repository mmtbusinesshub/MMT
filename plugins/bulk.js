const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const { cmd } = require("../command");

const OWNER_JID = "94774915917@s.whatsapp.net"; // 🔒 Change this to your real owner number JID

// Paths to CSV files containing contacts
const CONTACT_PATHS = [
  path.join(__dirname, "..", "data", "contacts.csv"),
  path.join(__dirname, "..", "data", "contacts2.csv"),
];

// Temporary memory to hold pending bulk state
const pendingBulk = {};

// 🧩 Load contacts from CSV files
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

// 🧨 Command to start bulk messaging
cmd(
  {
    pattern: "bulk",
    react: "📝",
    desc: "Send a bulk message to all contacts",
    category: "owner",
    filename: __filename,
  },
  async (conn, mek, m, { sender, reply }) => {
    try {
      if (sender !== OWNER_JID) {
        return reply("⛔ Only the *owner* can use this command.");
      }

      reply(
        "📝 *Please type the message you want to send to your contact list.*\n\n✍️ I'll wait for your next message."
      );

      // Store waiting state
      pendingBulk[sender] = {
        step: "awaitingMessage",
        time: Date.now(),
      };
    } catch (err) {
      console.error("Bulk start error:", err);
      reply("❌ Something went wrong while starting bulk mode.");
    }
  }
);

// 🧩 Reply-based handler to catch owner’s message
cmd(
  {
    on: "message",
  },
  async (conn, mek, m, { sender, body, reply }) => {
    try {
      if (!pendingBulk[sender]) return; // only continue if user is in pending state
      if (sender !== OWNER_JID) return;

      const state = pendingBulk[sender];
      if (state.step !== "awaitingMessage") return;

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
        try {
          await conn.sendMessage(jid, { text: msg });
          sent++;
          await new Promise((r) => setTimeout(r, 1500)); // Delay to prevent spam
        } catch (sendErr) {
          console.log("Failed to send to:", jid, sendErr.message);
        }
      }

      reply(`✅ Successfully sent your message to *${sent}* contacts!`);

      delete pendingBulk[sender]; // clear memory
    } catch (err) {
      console.error("Bulk sending error:", err);
      reply("❌ Failed to send messages. Check console for details.");
      delete pendingBulk[sender];
    }
  }
);
