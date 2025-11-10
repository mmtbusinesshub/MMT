const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

cmd({
  pattern: "bulk",
  alias: ["bc"],
  react: "📢",
  desc: "Send broadcast (supports image, video, audio, doc, sticker) via caption or command text",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid)
      return reply("❌ Only the bot owner can use this command.");

    // Get caption text (either from caption or text)
    const captionText =
      (m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        m.message?.documentMessage?.caption ||
        m.text ||
        "")
        .replace(/^(\.broadcast|\.bc)/i, "")
        .trim();

    // Identify and download media if available
    let mediaBuffer = null;
    let mediaType = null;
    const msg = m.message;

    if (msg?.imageMessage) {
      mediaType = "image";
      mediaBuffer = await m.download();
    } else if (msg?.videoMessage) {
      mediaType = "video";
      mediaBuffer = await m.download();
    } else if (msg?.audioMessage) {
      mediaType = "audio";
      mediaBuffer = await m.download();
    } else if (msg?.documentMessage) {
      mediaType = "document";
      mediaBuffer = await m.download();
    } else if (msg?.stickerMessage) {
      mediaType = "sticker";
      mediaBuffer = await m.download();
    }

    if (!mediaBuffer && !captionText)
      return reply("⚠️ Send a media file *with caption* like:\n`.broadcast Hello everyone!`");

    // Load contacts
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath))
      return reply("❌ contacts.csv not found in /data folder.");

    const csvData = fs.readFileSync(csvPath, "utf8").trim();
    const rows = csvData.split("\n").slice(1);
    const contacts = Array.from(
      new Set(
        rows
          .map(line => line.trim().split(",")[1])
          .filter(num => num && /^\d{10,15}$/.test(num))
      )
    );

    if (!contacts.length)
      return reply("⚠️ No valid contacts found in contacts.csv.");

    await reply(`📢 *Starting Broadcast*\n\n🧾 Total Contacts: *${contacts.length}*\n💬 Caption: ${captionText || "_(no caption)_"}\n\nProgress will be shown below 👇`);

    let sent = 0, failed = 0;

    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";

      try {
        const options = {};
        if (captionText) options.caption = captionText;

        if (mediaBuffer) {
          // Dynamic message type
          await conn.sendMessage(jid, { [mediaType]: mediaBuffer, ...options });
        } else {
          // Text-only broadcast
          await conn.sendMessage(jid, { text: captionText });
        }

        sent++;
        await conn.sendMessage(ownerJid, {
          text: `✅ *Sent to:* ${contacts[i]}\n📤 Progress: ${sent}/${contacts.length}`
        });

        await sleep(2000); // avoid spam
      } catch (err) {
        failed++;
        await conn.sendMessage(ownerJid, {
          text: `❌ *Failed to send to:* ${contacts[i]}\n💬 Error: ${err.message}`
        });
      }
    }

    await conn.sendMessage(ownerJid, {
      text: `📢 *Broadcast Completed!*\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n👥 Total: ${contacts.length}`
    });
  } catch (err) {
    console.error("Broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err.message);
  }
});
