const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

// ───────────────────────────────────────────────
// 📢 Broadcast Plugin (Image + Caption via Caption Command)
// ───────────────────────────────────────────────

cmd({
  pattern: "broadcast",
  alias: ["bc"],
  react: "📢",
  desc: "Send an image + caption broadcast to all contacts (Owner only)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid)
      return reply("❌ Only the bot owner can use this command.");

    // Get image + caption from message
    const msg = m.message?.imageMessage;
    if (!msg)
      return reply("📸 Please send an *image with caption* like:\n\n`.broadcast Hello everyone!`");

    // Extract caption and clean it
    const fullCaption = msg.caption || "";
    const captionText = fullCaption.replace(/^(\.broadcast|\.bc)/i, "").trim();
    if (!captionText)
      return reply("⚠️ Please include a caption text after your command.");

    // Download image buffer
    const imageBuffer = await m.download();

    // Load contacts.csv
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath))
      return reply("❌ contacts.csv not found in /data folder.");

    const csvData = fs.readFileSync(csvPath, "utf8").trim();
    const rows = csvData.split("\n").slice(1); // skip header line
    const contacts = Array.from(
      new Set(
        rows
          .map(line => line.trim().split(",")[1])
          .filter(num => num && /^\d{10,15}$/.test(num))
      )
    );

    if (!contacts.length)
      return reply("⚠️ No valid contacts found in contacts.csv.");

    await reply(`📤 Sending broadcast to *${contacts.length}* contacts...`);

    let success = 0, fail = 0;
    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";
      try {
        await conn.sendMessage(jid, { image: imageBuffer, caption: captionText });
        console.log(`✅ Sent to ${contacts[i]}`);
        success++;
        await sleep(1500); // delay to avoid spam
      } catch (err) {
        console.error(`❌ Failed to send to ${contacts[i]}:`, err.message);
        fail++;
      }
    }

    await reply(`✅ Broadcast completed!\n\n✅ Sent: ${success}\n❌ Failed: ${fail}`);

  } catch (err) {
    console.error("Broadcast error:", err);
    reply("❌ Broadcast failed:\n" + err.message);
  }
});
