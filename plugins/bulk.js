const fs = require("fs");
const path = require("path");
const Papa = require("papaparse"); // if your bot already uses this, else use simple split
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast a message to all saved contacts (Owner Only)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";

    // Only allow the bot owner
    if (sender !== ownerJid) {
      return reply("❌ This command is only for the bot owner.");
    }

    // Get the broadcast message text
    const message = args.join(" ").trim();
    if (!message) return reply("⚠️ Please provide a message.\nExample: *.bulk Hello everyone!*");

    // Read contacts.csv from data folder
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath)) {
      return reply("❌ contacts.csv file not found in /data folder.");
    }

    const csvData = fs.readFileSync(csvPath, "utf8");
    const rows = csvData.split("\n").slice(1); // skip header line
    const contacts = rows
      .map(line => line.trim().split("\t")[1]) // assuming tab-separated
      .filter(num => num && num.match(/^\d+$/));

    if (contacts.length === 0) return reply("⚠️ No valid contacts found in contacts.csv.");

    await reply(`📢 Starting broadcast to *${contacts.length}* contacts...`);

    // Loop through contacts and send messages
    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";
      await conn.sendMessage(jid, { text: message });
      console.log(`✅ Sent to ${contacts[i]}`);
      await sleep(1200); // wait 1.2s between messages to avoid spam flag
    }

    await reply("✅ Broadcast complete!");

  } catch (err) {
    console.error("Bulk broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err);
  }
});
