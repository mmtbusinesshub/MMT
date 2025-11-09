const { cmd } = require("../command");
const axios = require("axios");
const csv = require("csvtojson");

// 🔒 OWNER SETTINGS
const OWNER_NUMBER = "94774915917"; // <-- your WhatsApp number (without +)
const CONTACTS_CSV_URL = "https://raw.githubusercontent.com/mmtbusinesshub/MMT/refs/heads/main/data/contacts.csv"; // <-- raw CSV link

const bulkSessions = {};

// 🧠 STEP 1 – Handle .bulk command (with or without message)
cmd({
  pattern: "bulk",
  desc: "Send bulk messages to contacts",
  category: "owner",
  filename: __filename
}, async (bot, mek, m, { sender, q, reply }) => {

  // Owner-only check
  if (!sender.includes(OWNER_NUMBER))
    return reply("❌ You are not authorized to use this command.");

  // If user gave a message directly (e.g. .bulk Hello friends!)
  if (q && q.trim().length > 0) {
    return startBulkSend(bot, reply, q.trim());
  }

  // Otherwise, ask for message text
  bulkSessions[sender] = { stage: "ask" };
  await reply("📝 *Please type the message you want to send to your contact list.*");
});


// 🧠 STEP 2 – Capture message text (interactive mode)
cmd({
  filter: (text, { sender }) => bulkSessions[sender]?.stage === "ask",
}, async (bot, mek, m, { sender, body, reply }) => {

  const message = body.trim();
  if (!message) return reply("❌ Please type a valid message.");

  delete bulkSessions[sender]; // done with this session
  await startBulkSend(bot, reply, message);
});


// 🚀 Reusable function for sending bulk messages
async function startBulkSend(bot, reply, messageToSend) {
  try {
    await reply("📂 *Fetching contact list from CSV file...*");

    const res = await axios.get(CONTACTS_CSV_URL);
    const contacts = await csv().fromString(res.data);

    if (!contacts.length)
      return reply("❌ No contacts found in your CSV file.");

    await reply(`✅ *Found ${contacts.length} contacts.*\n🚀 Starting to send messages...\n🕐 Please wait.`);

    const delay = 4000; // 4 seconds delay (anti-ban)
    let sent = 0;

    for (const c of contacts) {
      const raw = c.Phone || c.phone || c.Number || c.number;
      if (!raw) continue;

      const name = c.Name || c.name || "Friend";
      const number = raw.replace(/\D/g, "");
      const jid = `${number}@s.whatsapp.net`;

      const personalized = `👋 *Hello ${name}!* \n\n${messageToSend}`;

      try {
        await bot.sendMessage(jid, { text: personalized });
        console.log(`✅ Sent to ${name} (${number})`);
        sent++;
      } catch (err) {
        console.log(`❌ Failed to send to ${name} (${number}): ${err.message}`);
      }

      await new Promise(r => setTimeout(r, delay));
    }

    await reply(`🎉 *Bulk messaging completed!* ✅ Sent to ${sent} contacts.`);

  } catch (err) {
    console.error("Bulk send error:", err.message);
    await reply("❌ Failed to fetch contacts or send messages. Check your CSV link or internet connection.");
  }
}
