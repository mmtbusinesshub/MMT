const { cmd } = require("../command");
const axios = require("axios");
const csv = require("csvtojson");

// 🔒 OWNER SETTINGS
const OWNER_NUMBER = "94774915917"; // <-- your number (no +)
const CONTACTS_CSV_URL = "https://raw.githubusercontent.com/mmtbusinesshub/MMT/refs/heads/main/data/contacts.csv"; // <-- your CSV file link

// Temporary memory for session
const bulkSessions = {};

// 🧠 STEP 1 — Owner runs .bulk
cmd({
  pattern: "bulk",
  desc: "Send bulk messages to CSV contacts",
  category: "owner",
  filename: __filename
}, async (bot, mek, m, { from, sender, reply }) => {

  // Owner-only protection
  if (!sender.includes(OWNER_NUMBER)) {
    return reply("❌ You are not authorized to use this command.");
  }

  // Ask for message content
  await reply("📝 *Please type the message you want to send to your contact list.*");

  // Set session so next reply is captured
  bulkSessions[sender] = { waitingForMessage: true };
});


// 🧠 STEP 2 — Capture the message text
cmd({
  filter: (text, { sender }) => bulkSessions[sender]?.waitingForMessage,
}, async (bot, mek, m, { from, sender, body, reply }) => {

  const messageToSend = body?.trim();
  if (!messageToSend) return reply("❌ Please type a valid message.");

  // keep messageToSend in session, mark next step
  bulkSessions[sender] = { waitingForMessage: false, message: messageToSend };

  // Confirm message
  await reply(`✅ *Got your message!*\n\n"${messageToSend}"\n\n➡️ Type *SEND* to start sending messages or *CANCEL* to stop.`);
});


// 🧠 STEP 3 — Wait for confirmation (SEND or CANCEL)
cmd({
  filter: (text, { sender }) => bulkSessions[sender] && !bulkSessions[sender].waitingForMessage,
}, async (bot, mek, m, { sender, body, reply }) => {

  const input = body.trim().toUpperCase();
  const session = bulkSessions[sender];

  if (input === "CANCEL") {
    delete bulkSessions[sender];
    return reply("❌ Bulk sending cancelled.");
  }

  if (input !== "SEND") {
    return reply("⚠️ Please type *SEND* to start or *CANCEL* to stop.");
  }

  const messageToSend = session.message;
  delete bulkSessions[sender]; // clear session before starting

  await reply("📂 *Fetching contact list from CSV file...*");

  try {
    // Get CSV data
    const csvResponse = await axios.get(CONTACTS_CSV_URL);
    const contacts = await csv().fromString(csvResponse.data);

    if (!contacts.length) {
      return reply("❌ No contacts found in your CSV file.");
    }

    await reply(`✅ *Found ${contacts.length} contacts.*\n🚀 Starting to send messages...\n🕐 Please wait, this may take a few minutes.`);

    const delay = 4000; // 4 sec delay
    let sentCount = 0;

    for (const contact of contacts) {
      const rawNum = contact.Phone || contact.phone || contact.Number || contact.number;
      const name = contact.Name || contact.name || "Friend";
      if (!rawNum) continue;

      const number = rawNum.replace(/\D/g, "");
      const jid = `${number}@s.whatsapp.net`;

      const textMsg = `👋 *Hello ${name}!* \n\n${messageToSend}`;

      try {
        await bot.sendMessage(jid, { text: textMsg });
        sentCount++;
        console.log(`✅ Sent to ${name} (${number})`);
      } catch (err) {
        console.log(`❌ Failed to send to ${name} (${number}): ${err.message}`);
      }

      await new Promise(res => setTimeout(res, delay)); // delay between sends
    }

    await reply(`🎉 *Bulk messaging completed!*\n✅ Successfully sent to ${sentCount} contacts.`);

  } catch (err) {
    console.error("Bulk error:", err.message);
    await reply("❌ Error reading CSV or sending messages. Check your link or network.");
  }
});
