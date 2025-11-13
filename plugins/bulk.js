const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

// ───────────────
// 📢 Bulk Plugin
// ───────────────

cmd({
  pattern: "bulk",
  alias: ["crm"],
  react: "📢",
  desc: "Send a bulk message for the contact list",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender }) => {
  try {
    // Prevent bot self-trigger
    if (m.key.fromMe) return;

    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid)
      return reply("❌ Only the bot owner can use this command.");

    // Detect message type
    const messageType = Object.keys(m.message || {})[0];
    const content = m.message?.[messageType];
    if (!content)
      return reply("📢 Please send a message or media to broadcast.\n\nExample: `.bulk Hello everyone!`");

    // Extract caption/text
    const fullCaption = content.caption || content.text || content.conversation || "";
    const captionText = (fullCaption || "").replace(/^(\.bulk|\.crm)/i, "").trim() || " ";

    // Detect message type and prepare content
    let messageContent = {};
    if (m.message?.imageMessage) {
      messageContent = { image: await m.download(), caption: captionText };
    } else if (m.message?.videoMessage) {
      messageContent = { video: await m.download(), caption: captionText };
    } else if (m.message?.audioMessage) {
      messageContent = { audio: await m.download(), mimetype: "audio/mp4" };
    } else if (m.message?.documentMessage) {
      messageContent = { document: await m.download(), fileName: captionText || "file" };
    } else if (m.message?.stickerMessage) {
      messageContent = { sticker: await m.download() };
    } else {
      messageContent = { text: captionText };
    }

    // Load contacts.csv
    const csvPath = path.resolve(__dirname, "..", "data", "contacts.csv");
    if (!fs.existsSync(csvPath))
      return reply("❌ contacts.csv not found in /data folder.");

    const csvData = fs.readFileSync(csvPath, "utf8").trim();
    const rows = csvData.split("\n").slice(1); // skip header line

    // Clean numbers
    const contacts = Array.from(
      new Set(
        rows
          .map(line => line.trim().split(",")[1])
          .map(num => num ? num.replace(/\D/g, "") : null)
          .filter(num => num && num.length >= 10 && num.length <= 15)
      )
    );

    if (!contacts.length)
      return reply("⚠️ No valid contacts found in contacts.csv.");

    await reply(`*❤️‍🩹 Sending broadcast to ${contacts.length} contacts...*`);

    let success = 0, fail = 0;
    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";
      try {
        await conn.sendMessage(jid, messageContent);
        console.log(`✅ Sent to ${contacts[i]}`);
        success++;
        await sleep(1500); // delay to avoid rate limits
      } catch (err) {
        console.error(`❌ Failed to send to ${contacts[i]}:`, err.message);
        fail++;
      }
    }

    await reply(
      `✅ *Broadcast completed!*\n\n📨 Sent: ${success}\n❌ Failed: ${fail}\n🧾 Total: ${contacts.length}`
    );

  } catch (err) {
    console.error("Broadcast error:", err);
    reply("❌ Broadcast failed:\n" + err.message);
  }
});
