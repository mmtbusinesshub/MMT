const { cmd } = require("../command");
const axios = require("axios");
const csv = require("csvtojson");

// ------------------------------
// 🔒 OWNER SETTINGS
// ------------------------------
const OWNER_NUMBER = "94774915917"; // <-- change this to your WhatsApp number (without +)
const CONTACTS_CSV_URL = "https://raw.githubusercontent.com/mmtbusinesshub/MMT/refs/heads/main/data/contacts.csv"; // <-- your CSV raw GitHub URL

// Temporary session storage
const bulkSessions = {};

// ------------------------------------
// 🧠 STEP 1 — Owner starts bulk sending
// ------------------------------------
cmd({
  pattern: "bulk",
  desc: "Send bulk messages to contacts from CSV",
  category: "owner",
  filename: __filename
}, async (bot, mek, m, { from, sender, reply }) => {
  
  // Allow only owner to use
  if (!sender.includes(OWNER_NUMBER)) {
    return reply("❌ You are not authorized to use this command.");
  }

  await reply("📝 *Please type the message you want to send to your contact list.*");

  // Save session
  bulkSessions[sender] = { waitingForMessage: true };
});


// ------------------------------------------------------
// 🧠 STEP 2 — Owner replies with the message to broadcast
// ------------------------------------------------------
cmd({
  filter: (text, { sender }) => bulkSessions[sender]?.waitingForMessage,
}, async (bot, mek, m, { from, sender, body, reply }) => {
  const messageToSend = body.trim();
  delete bulkSessions[sender]; // clear state

  await reply("📂 *Fetching contact list from CSV file...*");

  try {
    // Fetch CSV file from GitHub
    const csvResponse = await axios.get(CONTACTS_CSV_URL);
    const contacts = await csv().fromString(csvResponse.data);

    if (!contacts.length) {
      return reply("❌ No contacts found in your CSV file.");
    }

    await reply(`✅ *Found ${contacts.length} contacts.*\n🚀 Starting to send messages...`);

    let sentCount = 0;
    const delay = 4000; // milliseconds — delay between each message (4 sec recommended)

    for (const contact of contacts) {
      const rawNum = contact.Phone || contact.phone || contact.Number || contact.number;
      const name = contact.Name || contact.name || "Friend";

      if (!rawNum) continue;
      const number = rawNum.replace(/\D/g, ""); // remove any non-digit chars
      const jid = `${number}@s.whatsapp.net`;

      try {
        // Send the personalized message
        const textMessage = `👋 *Hello ${name}!* \n\n${messageToSend}`;

        await bot.sendMessage(jid, { text: textMessage });

        console.log(`✅ Sent to ${name} (${number})`);
        sentCount++;

        // Wait before sending next to prevent ban
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (err) {
        console.log(`❌ Failed to send to ${name} (${number}): ${err.message}`);
      }
    }

    await reply(`🎉 *Bulk messaging completed!*\n✅ Successfully sent to ${sentCount} contacts.`);

  } catch (error) {
    console.error("Bulk error:", error.message);
    await reply("❌ Failed to read CSV or send messages. Please check your file or network connection.");
  }
});
