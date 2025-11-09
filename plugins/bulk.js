const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

let lastMedia = {}; // store last media sent by owner

// Hook to save last media whenever owner sends one
cmd({
  pattern: "saveMedia",
  react: "💾",
  desc: "Internal: Save last media sent by owner",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { sender }) => {
  const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
  if (sender !== ownerJid) return;

  if (m.message?.imageMessage || m.message?.videoMessage || m.message?.audioMessage || m.message?.stickerMessage) {
    lastMedia = m.message; // store the whole media object
    console.log("📌 Last media updated for broadcasting.");
  }
});

cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast last media with caption to all contacts (Owner Only)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return reply("❌ Only the bot owner can use this command.");

    if (!lastMedia || Object.keys(lastMedia).length === 0) 
      return reply("⚠️ No media found. Send an image/video/audio/sticker first.");

    // Add caption if provided
    const captionText = args.join(" ");
    if (lastMedia.imageMessage && captionText) lastMedia.imageMessage.caption = captionText;
    if (lastMedia.videoMessage && captionText) lastMedia.videoMessage.caption = captionText;
    if (lastMedia.audioMessage && captionText) lastMedia.audioMessage.caption = captionText;
    if (lastMedia.stickerMessage && captionText) lastMedia.stickerMessage.caption = captionText;

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

    await reply(`📢 Broadcasting to *${contacts.length}* contacts...`);

    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";
      try {
        await conn.sendMessage(jid, lastMedia);
        console.log(`✅ Sent to ${contacts[i]}`);
        await sleep(1200); // avoid spam flag
      } catch (err) {
        console.error(`❌ Failed to send to ${contacts[i]}:`, err);
      }
    }

    await reply("✅ Broadcast complete!");
  } catch (err) {
    console.error("Bulk broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err);
  }
});
