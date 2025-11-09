const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast media or text with caption to all contacts (Owner Only)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return reply("❌ Only the bot owner can use this command.");

    // Check if the message contains media
    let messageContent;
    const quoted = m.quoted && m.quoted.message;

    if (m.message?.imageMessage || m.message?.videoMessage || m.message?.audioMessage || m.message?.stickerMessage) {
      // Media in the current message
      messageContent = m.message;
      // Add caption from args if provided
      if (args.length) {
        if (messageContent.imageMessage) messageContent.imageMessage.caption = args.join(" ");
        if (messageContent.videoMessage) messageContent.videoMessage.caption = args.join(" ");
        if (messageContent.audioMessage) messageContent.audioMessage.caption = args.join(" ");
        if (messageContent.stickerMessage) messageContent.stickerMessage.caption = args.join(" ");
      }
    } else if (m.message?.conversation || m.message?.extendedTextMessage) {
      // Plain text message
      messageContent = { text: args.join(" ") || m.text };
      if (!messageContent.text) return reply("⚠️ Send a message or media with .bulk.");
    } else {
      return reply("⚠️ Send a media (image/video/audio/sticker) with optional caption and type .bulk.");
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

    // Track sent contacts
    const sentPath = path.join(__dirname, "../data/sent.json");
    const sent = fs.existsSync(sentPath) ? JSON.parse(fs.readFileSync(sentPath)) : [];
    const remainingContacts = contacts.filter(num => !sent.includes(num));

    await reply(`📢 Broadcasting to *${remainingContacts.length}* contacts...`);

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
      fs.writeFileSync(sentPath, JSON.stringify(sent, null, 2));
      await sleep(Math.floor(Math.random() * 1300) + 1200);
    }

    await reply("✅ Broadcast complete!");
    fs.unlinkSync(sentPath);

  } catch (err) {
    console.error("Bulk broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err);
  }
});
