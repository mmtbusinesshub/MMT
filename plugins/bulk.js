const { cmd } = require("../command");
const axios = require("axios");
const csv = require("csvtojson");

// 🔒 owner info
const OWNER_NUMBER = "94774915917"; // your number (no +)
const CONTACTS_CSV_URL = "https://raw.githubusercontent.com/mmtbusinesshub/MMT/refs/heads/main/data/contacts.csv"; // raw CSV link

// in-memory session map
const bulkSessions = {};

// STEP 1 – owner starts
cmd({
  pattern: "bulk",
  desc: "Send bulk messages to contacts",
  category: "owner",
  filename: __filename
}, async (bot, mek, m, { sender, reply }) => {

  if (!sender.includes(OWNER_NUMBER))
    return reply("❌ You are not authorized to use this command.");

  bulkSessions[sender] = { stage: "ask" };
  await reply("📝 *Please type the message you want to send to your contact list.*");
});


// STEP 2 – capture message text
cmd({
  filter: (text, { sender }) => bulkSessions[sender]?.stage === "ask",
}, async (bot, mek, m, { sender, body, reply }) => {

  const msg = body.trim();
  if (!msg) return reply("❌ Please type a valid message.");

  bulkSessions[sender] = { stage: "confirm", message: msg };

  await reply(`✅ *Got your message!*\n\n"${msg}"\n\n➡️ Type *SEND* to start or *CANCEL* to stop.`);
});


// STEP 3 – confirmation and broadcast
cmd({
  filter: (text, { sender }) => bulkSessions[sender]?.stage === "confirm",
}, async (bot, mek, m, { sender, body, reply }) => {

  const input = body.trim().toUpperCase();
  const session = bulkSessions[sender];

  if (input === "CANCEL") {
    delete bulkSessions[sender];
    return reply("❌ Bulk sending cancelled.");
  }

  if (input !== "SEND")
    return reply("⚠️ Please type *SEND* to start or *CANCEL* to stop.");

  // confirmed
  delete bulkSessions[sender];
  const messageToSend = session.message;

  await reply("📂 *Fetching contacts from CSV file...*");

  try {
    const res = await axios.get(CONTACTS_CSV_URL);
    const contacts = await csv().fromString(res.data);
    if (!contacts.length) return reply("❌ No contacts found.");

    await reply(`✅ *Found ${contacts.length} contacts.*\n🚀 Starting broadcast...`);

    const delay = 4000; // 4 s
    let sent = 0;

    for (const c of contacts) {
      const num = (c.Phone || c.phone || "").replace(/\D/g, "");
      if (!num) continue;

      const name = c.Name || c.name || "Friend";
      const jid = `${num}@s.whatsapp.net`;
      const textMsg = `👋 *Hello ${name}!* \n\n${messageToSend}`;

      try {
        await bot.sendMessage(jid, { text: textMsg });
        console.log(`✅ Sent to ${name} (${num})`);
        sent++;
      } catch (err) {
        console.log(`❌ Failed to send to ${name} (${num}): ${err.message}`);
      }

      await new Promise(r => setTimeout(r, delay));
    }

    await reply(`🎉 *Bulk messaging completed!* ✅ Sent to ${sent} contacts.`);

  } catch (err) {
    console.error("Bulk error:", err.message);
    await reply("❌ Failed to read CSV or send messages. Check your link or network.");
  }
});
