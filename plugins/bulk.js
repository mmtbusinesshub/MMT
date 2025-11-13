const fs = require("fs");
const path = require("path");
const config = require("../config");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");

// ─────────────
// 📢 Bulk Plugin
// ─────────────

cmd({
  pattern: "bulk",
  alias: ["crm"],
  react: "📢",
  desc: "Send a bulk message for the contact list",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender }) => {
  try {
    const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
    if (sender !== ownerJid)
      return reply("❌ Only the bot owner can use this command.");

    // Check if message exists
    if (!m.message)
      return reply("📢 Please send a message (text, image, video, audio, document, or sticker) you want to broadcast\n\n`Ex: .bulk Hello everyone!`");

    // Extract caption/text
    let captionText = "";
    let mediaType = null;
    let mediaBuffer = null;

    // Handle different message types
    if (m.message.imageMessage) {
      mediaType = "image";
      captionText = m.message.imageMessage.caption || "";
      mediaBuffer = await m.download();
    } else if (m.message.videoMessage) {
      mediaType = "video";
      captionText = m.message.videoMessage.caption || "";
      mediaBuffer = await m.download();
    } else if (m.message.audioMessage) {
      mediaType = "audio";
      mediaBuffer = await m.download();
    } else if (m.message.documentMessage) {
      mediaType = "document";
      captionText = m.message.documentMessage.caption || "";
      mediaBuffer = await m.download();
    } else if (m.message.stickerMessage) {
      mediaType = "sticker";
      mediaBuffer = await m.download();
    } else if (m.message.extendedTextMessage) {
      mediaType = "text";
      captionText = m.message.extendedTextMessage.text || "";
    } else if (m.message.conversation) {
      mediaType = "text";
      captionText = m.message.conversation || "";
    }

    // Clean caption from command
    captionText = captionText.replace(/^(\.bulk|\.crm)\s*/i, "").trim();

    // Validate we have content to send
    if (!mediaBuffer && !captionText) {
      return reply("❌ Please provide a valid message to broadcast.");
    }

    // Load and parse contacts.csv properly
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath)) {
      return reply("❌ contacts.csv not found in /data folder.");
    }

    const csvData = fs.readFileSync(csvPath, "utf8").trim();
    const rows = csvData.split("\n").slice(1); // skip header
    
    const contacts = [];
    for (const row of rows) {
      if (!row.trim()) continue;
      
      // Better CSV parsing that handles commas in values
      const columns = row.split(',').map(col => col.trim());
      if (columns.length >= 2) {
        const number = columns[1]; // Assuming number is in second column
        if (number && /^\d{10,15}$/.test(number)) {
          contacts.push(number);
        }
      }
    }

    // Remove duplicates
    const uniqueContacts = [...new Set(contacts)];

    if (!uniqueContacts.length) {
      return reply("⚠️ No valid contacts found in contacts.csv.");
    }

    await reply(`*📢 Starting broadcast to ${uniqueContacts.length} contacts...*`);

    let success = 0, fail = 0;
    
    for (let i = 0; i < uniqueContacts.length; i++) {
      const jid = uniqueContacts[i] + "@s.whatsapp.net";
      
      try {
        // Prepare message based on media type
        let messageOptions = {};
        
        if (mediaType === "image" && mediaBuffer) {
          messageOptions = { image: mediaBuffer, caption: captionText };
        } else if (mediaType === "video" && mediaBuffer) {
          messageOptions = { video: mediaBuffer, caption: captionText };
        } else if (mediaType === "audio" && mediaBuffer) {
          messageOptions = { audio: mediaBuffer, mimetype: 'audio/mp4' };
        } else if (mediaType === "document" && mediaBuffer) {
          messageOptions = { 
            document: mediaBuffer, 
            caption: captionText,
            fileName: m.message.documentMessage?.fileName || 'document'
          };
        } else if (mediaType === "sticker" && mediaBuffer) {
          messageOptions = { sticker: mediaBuffer };
        } else if (captionText) {
          // Text-only message
          messageOptions = { text: captionText };
        } else {
          console.log(`⚠️ No content to send to ${uniqueContacts[i]}`);
          fail++;
          continue;
        }

        await conn.sendMessage(jid, messageOptions);
        console.log(`✅ Sent to ${uniqueContacts[i]}`);
        success++;
        
        // Delay to avoid rate limiting
        await sleep(2000);
        
      } catch (err) {
        console.error(`❌ Failed to send to ${uniqueContacts[i]}:`, err.message);
        fail++;
        
        // Longer delay on error
        await sleep(3000);
      }
    }

    await reply(`📊 *Broadcast Completed!*\n✅ Success: ${success}\n❌ Failed: ${fail}\n📞 Total: ${uniqueContacts.length}`);

  } catch (err) {
    console.error("Broadcast error:", err);
    reply("❌ Broadcast failed:\n" + err.message);
  }
});
