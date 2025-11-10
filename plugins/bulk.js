const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

cmd({
  pattern: "broadcast",
  alias: ["bc"],
  react: "📢",
  desc: "Send broadcast (supports image, video, audio, document, sticker)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";

    // 🧱 Prevent self-trigger (avoid looping)
    if (m.key.fromMe || sender === conn.user.id)
      return; // ignore bot's own messages

    if (sender !== ownerJid)
      return reply("❌ Only the bot owner can use this command.");

    // 🧠 Get caption
    const captionText =
      (m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        m.message?.documentMessage?.caption ||
        m.text ||
        "")
        .replace(/^(\.broadcast|\.bc)/i, "")
        .trim();

    // 🖼️ Identify media
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

    // 📂 Load contacts
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

    await reply(`📢 *Starting Broadcast*\n\n👥 Total Contacts: *${contacts.length}*\n💬 Caption: ${captionText || "_(no caption)_"}\n\nSending...`);

    let sent = 0, failed = 0;

    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";

      try {
        const options = {};
        if (captionText) options.caption = captionText;

        if (mediaBuffer) {
          await conn.sendMessage(jid, { [mediaType]: mediaBuffer, ...options });
        } else {
          await conn.sendMessage(jid, { text: captionText });
        }

        sent++;
        // ✅ Send progress privately to owner
        await conn.sendMessage(ownerJid, {
          text: `✅ Sent to ${contacts[i]} (${sent}/${contacts.length})`,
        }, { quoted: null });

        await sleep(2000);
      } catch (err) {
        failed++;
        await conn.sendMessage(ownerJid, {
          text: `❌ Failed to send to ${contacts[i]} (${failed} failed)\n${err.message}`,
        }, { quoted: null });
      }
    }

    await conn.sendMessage(ownerJid, {
      text: `📢 *Broadcast Completed!*\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n👥 Total: ${contacts.length}`,
    }, { quoted: null });

  } catch (err) {
    console.error("Broadcast error:", err);
    reply("❌ Error during broadcast:\n" + err.message);
  }
});

  }
});
