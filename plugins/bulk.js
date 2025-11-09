const { cmd } = require("../command");
const axios = require("axios");
const csv = require("csvtojson");

// 🔒 OWNER SETTINGS
const OWNER_NUMBER = "94774915917"; // your WhatsApp number without +
const CONTACTS_CSV_URL = "https://raw.githubusercontent.com/mmtbusinesshub/MMT/refs/heads/main/data/contacts.csv"; // CSV raw link

const bulkSessions = {};

// 🧩 STEP 1 – Owner starts bulk session
cmd({
  pattern: "bulk",
  desc: "Send bulk messages to contacts (interactive mode)",
  category: "owner",
  filename: __filename
}, async (bot, mek, m, { sender, reply }) => {

  // ✅ Only allow owner to start
  if (!sender.includes(OWNER_NUMBER))
    return reply("❌ You are not authorized to use this command.");

  bulkSessions[sender] = { stage: "waitingForMessage", lastCommandTime: Date.now() };

  await reply("📝 *Please type the message you want to send to your contact list.*\n\n✍️ I'll wait for your next message (don’t send another command).");
});


// 🧩 STEP 2 – Capture owner’s next message (ignore bot replies)
cmd({
  filter: (text, { sender, m }) => {
    const session = bulkSessions[sender];
    if (!session) return false;

    // Ignore bot’s own replies (messages sent *to* the owner)
    if (m.key.fromMe && m.key.remoteJid === `${OWNER_NUMBER}@s.whatsapp.net`) return false;

    // Accept only owner’s messages TO the bot
    return sender.includes(OWNER_NUMBER);
  }
}, async (bot, mek, m, { sender, body, reply }) => {
  const messageToSend = body?.trim();

  // Ignore accidental resend of .bulk
  if (!messageToSend || messageToSend.startsWith(".bulk"))
    return reply("⚠️ Please type your message, not a command.");

  delete bulkSessions[sender]; // clear session
  await startBulkSend(bot, reply, messageToSend);
});


// 🚀 Bulk Sending Logic
async function startBulkSend(bot, reply, messageToSend) {
  try {
    await reply("📂 *Fetching contact list from CSV file...*");

    const res = await axios.get(CONTACTS_CSV_URL);
    const contacts = await csv().fromString(res.data);

    if (!contacts.length)
      return reply("❌ No contacts found in your CSV file.");

    await reply(`✅ *Found ${contacts.length} contacts.*\n🚀 Starting to send messages...\n🕐 Please wait...`);

    const delay = 4000; // 4s delay
    let sentCount = 0;

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
        sentCount++;
      } catch (err) {
        console.log(`❌ Failed to send to ${name} (${number}): ${err.message}`);
      }

      await new Promise(r => setTimeout(r, delay));
    }

    await reply(`🎉 *Bulk messaging completed!*\n✅ Successfully sent to ${sentCount} contacts.`);

  } catch (err) {
    console.error("Bulk send error:", err.message);
    await reply("❌ Failed to fetch contacts or send messages. Please check your CSV URL or internet connection.");
  }
}
