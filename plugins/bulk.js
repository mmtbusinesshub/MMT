const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

// Detect media type
function detectMediaType(arg) {
  const ext = arg.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "image";
  if (["mp4", "mov", "mkv"].includes(ext)) return "video";
  if (["mp3", "ogg", "wav"].includes(ext)) return "audio";
  if (["webp"].includes(ext)) return "sticker";
  return "text";
}

cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast text or media to all saved contacts (Owner Only, High-Capacity)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid) return reply("❌ This command is only for the bot owner.");
    if (!args.length) return reply("⚠️ Provide a message or media path. Example: *.bulk Hello!* or *.bulk ./media/photo.jpg*");

    // Detect media type
    const firstArg = args[0];
    const mediaType = detectMediaType(firstArg);
    let messageContent;

    if (mediaType === "text") {
      messageContent = { text: args.join(" ") };
    } else {
      const mediaPath = path.join(__dirname, "../", firstArg);
      if (!fs.existsSync(mediaPath)) return reply("❌ Media file not found: " + mediaPath);

      switch (mediaType) {
        case "image":
          messageContent = { image: { url: mediaPath }, caption: args.slice(1).join(" ") || "" };
          break;
        case "video":
          messageContent = { video: { url: mediaPath }, caption: args.slice(1).join(" ") || "" };
          break;
        case "audio":
          messageContent = { audio: { url: mediaPath }, mimetype: "audio/mp4" };
          break;
        case "sticker":
          messageContent = { sticker: { url: mediaPath } };
          break;
      }
    }

    // Load contacts
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath)) return reply("❌ contacts.csv file not found in /data folder.");

    const csvData = fs.readFileSync(csvPath, "utf8");
    const rows = csvData.split("\n").slice(1);
    const contacts = Array.from(
      new Set(
        rows.map(line => line.trim().split(",")[1]).filter(num => num && /^\d{10,15}$/.test(num))
      )
    );

    if (!contacts.length) return reply("⚠️ No valid contacts found.");

    // Load sent list to resume if interrupted
    const sentPath = path.join(__dirname, "../data/sent.json");
    const sent = fs.existsSync(sentPath) ? JSON.parse(fs.readFileSync(sentPath)) : [];
    const remainingContacts = contacts.filter(num => !sent.includes(num));

    await reply(`📢 Starting broadcast to *${remainingContacts.length}* contacts...`);

    const BATCH_SIZE = 20; // number of messages per batch
    for (let i = 0; i < remainingContacts.length; i += BATCH_SIZE) {
      const batch = remainingContacts.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async num => {
        try {
          await conn.sendMessage(num + "@s.whatsapp.net", messageContent);
          console.log(`✅ Sent to ${num}`);
          sent.push(num);
        } catch (err) {
          console.error(`❌ Failed to send to ${num}:`, err);
        }
      }));

      // Save progress after each batch
      fs.writeFileSync(sentPath, JSON.stringify(sent, null, 2));

      // Random delay 1.2–2.5s
      await sleep(Math.floor(Math.random() * 1300) + 1200);
    }

    await reply("✅ Broadcast complete!");
    console.log("✅ All messages sent!");

    // Optional: clear sent.json after full broadcast
    fs.unlinkSync(sentPath);

  } catch (err) {
    console.error("Bulk broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err);
  }
});
