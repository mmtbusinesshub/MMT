const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast any media or text sent to the bot (Owner Only)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return reply("❌ Only the bot owner can use this command.");

    // Check if message has media or text
    let messageContent;
    if (m.quoted && m.quoted.message) {
      // User replied to a media message with .bulk
      messageContent = m.quoted.message;
      // Optional: add extra caption from args
      if (args.length && messageContent.caption !== undefined) {
        messageContent.caption = args.join(" ");
      }
    } else if (m.message) {
      // If plain text message
      messageContent = { text: args.join(" ") || m.text };
      if (!messageContent.text) return reply("⚠️ Send a message or reply to media first.");
    } else {
      return reply("⚠️ Send a message or reply to media you want to broadcast.");
    }

    // Load contacts
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath)) return reply("❌ contacts.csv not found in /data folder.");
    const csvData = fs.readFileSync(csvPath, "utf8");
    const rows = csvData.split("\n").slice(1);
    const contacts = Array.from(
      new Set(
        rows.map(line => line.trim().split(",")[1]).filter(num => num && /^\d{10,15}$/.test(num))
      )
    );
    if (!contacts.length) return reply("⚠️ No valid contacts found.");

    // Track sent contacts for resume
    const sentPath = path.join(__dirname, "../data/sent.json");
    const sent = fs.existsSync(sentPath) ? JSON.parse(fs.readFileSync(sentPath)) : [];
    const remainingContacts = contacts.filter(num => !sent.includes(num));

    await reply(`📢 Broadcasting to *${remainingContacts.length}* contacts...`);

    // Send in batches
    const BATCH_SIZE = 20;
    for (let i = 0; i < remainingContacts.length; i += BATCH_SIZE) {
      const batch = remainingContacts.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async num => {
        try {
          await conn.sendMessage(num + "@s.whatsapp.net", messageContent);
          sent.push(num);
          console.log(`✅ Sent to ${num}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${num}:`, err);
        }
      }));
      // Save progress
      fs.writeFileSync(sentPath, JSON.stringify(sent, null, 2));
      await sleep(Math.floor(Math.random() * 1300) + 1200);
    }

    await reply("✅ Broadcast complete!");
    fs.unlinkSync(sentPath); // clear progress after done

  } catch (err) {
    console.error("Bulk broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err);
  }
});
