const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const parse = require("csv-parse/sync").parse;
const config = require("../config");

// Pending state for reply-based interaction
const pendingBroadcast = {};

// Load contacts from CSV file in `data/contacts.csv`
function loadContacts() {
  const csvPath = path.join(__dirname, "..", "data", "contacts.csv");
  if (!fs.existsSync(csvPath)) return [];
  const data = fs.readFileSync(csvPath, "utf-8");
  const records = parse(data, {
    columns: true,
    skip_empty_lines: true
  });
  return records.map(r => ({
    name: r.Name || r.name || "Unknown",
    number: r.Phone || r.phone
  }));
}

// Step 1: Owner sends .bulk command
cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast a message to all contacts (Owner only)",
  category: "owner",
  filename: __filename
}, async (bot, mek, m, { from, sender, reply }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return reply("❌ This command is only for the bot owner.");

    // Ask owner for the broadcast message
    pendingBroadcast[sender] = { step: 1 };
    await reply("📩 Please send the message you want to broadcast to all contacts.");
  } catch (e) {
    console.error("Bulk command error:", e);
    reply("❌ Something went wrong while starting the broadcast.");
  }
});

// Step 2: Owner replies with the message to broadcast
cmd({
  filter: (text, { sender }) => pendingBroadcast[sender] && pendingBroadcast[sender].step === 1
}, async (bot, mek, m, { from, body, sender, reply }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return;

    const message = body.trim();
    if (!message) return reply("❌ Cannot send empty message.");

    // Store message and move to next step
    pendingBroadcast[sender] = { step: 2, message };
    await reply(`✅ Got it! The message is ready to send:\n\n"${message}"\n\nSend any message again to start broadcasting to all contacts.`);
  } catch (e) {
    console.error("Broadcast reply error:", e);
    reply("❌ Failed to store broadcast message.");
  }
});

// Step 3: Owner sends any message again to start broadcasting
cmd({
  filter: (text, { sender }) => pendingBroadcast[sender] && pendingBroadcast[sender].step === 2
}, async (bot, mek, m, { from, sender, reply }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return;

    const { message } = pendingBroadcast[sender];
    const contacts = loadContacts();
    if (!contacts.length) return reply("❌ No contacts found in data/contacts.csv");

    await reply(`📤 Broadcasting message to ${contacts.length} contacts...`);

    for (const contact of contacts) {
      const jid = contact.number + "@s.whatsapp.net";
      try {
        await bot.sendMessage(jid, { text: message });
      } catch (err) {
        console.error(`Failed to send message to ${contact.number}:`, err.message);
      }
    }

    await reply(`✅ Broadcast completed to ${contacts.length} contacts.`);
    delete pendingBroadcast[sender];
  } catch (e) {
    console.error("Broadcast error:", e);
    reply("❌ Failed to broadcast the message.");
  }
});
