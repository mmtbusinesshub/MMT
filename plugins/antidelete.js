const fs = require('fs');
const path = require('path');
const { BOT_OWNER } = require('./config'); // e.g. "94774915917"

let deletedMessages = {};
let deletedMediaPath = {};

const tempFolder = path.join(__dirname, '../temp');
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

// convert BOT_OWNER into full WhatsApp JID
const ownerJid = BOT_OWNER.includes('@s.whatsapp.net')
  ? BOT_OWNER
  : `${BOT_OWNER}@s.whatsapp.net`;

module.exports = {
  onMessage: async (conn, msg) => {
    const key = msg.key;
    const content = msg.message;
    if (!content || key.fromMe) return;

    // Save message for text & media
    deletedMessages[key.id] = { key, message: content };

    if (msg._mediaBuffer && msg._mediaType) {
      let ext = '.bin';
      if (msg._mediaType === 'imageMessage') ext = '.jpg';
      else if (msg._mediaType === 'videoMessage') ext = '.mp4';
      else if (msg._mediaType === 'audioMessage') ext = '.ogg';
      else if (msg._mediaType === 'stickerMessage') ext = '.webp';
      else if (msg._mediaType === 'documentMessage') {
        ext = msg.message.documentMessage?.fileName
          ? path.extname(msg.message.documentMessage.fileName)
          : '.bin';
      }

      const fileName = `${key.id}${ext}`;
      const filePath = path.join(tempFolder, fileName);
      try {
        await fs.promises.writeFile(filePath, msg._mediaBuffer);
        deletedMediaPath[key.id] = filePath;
      } catch (e) {
        console.log('❌ Media save failed:', e.message);
      }
    }
  },

  onDelete: async (conn, updates) => {
    for (const update of updates) {
      if (!update || !update.key) continue;

      const isDeleteEvent = update.action === 'delete' || update.update?.message === null;
      if (!isDeleteEvent) continue;

      const from = update.key.remoteJid;
      const sender = update.key.participant || from;

      const deleted =
        deletedMessages[update.key.id] ||
        deletedMessages[update.update?.key?.id];

      if (!deleted) continue;

      try {
        let caption = `
┏━━ 🚨 *MMT Alert* ━━┓

👤 *Sender:* @${sender.split('@')[0]}
📍 *Chat:* ${from}
🕒 *Time:* ${new Date().toLocaleString()}

⚠️ Deleted message has been successfully *recovered* (Owner Only).

✅ Service: *MMT Business Hub WhatsApp Assistant*

┗━━━━━━━━━━━━━━━━━━━━┛`;

        const mediaPath = deletedMediaPath[update.key.id] || deletedMediaPath[update.update?.key?.id];

        // ✅ Only send recovered message privately to the bot owner
        if (mediaPath && fs.existsSync(mediaPath)) {
          let messageOptions = { caption, mentions: [sender] };
          if (mediaPath.endsWith('.jpg')) {
            await conn.sendMessage(ownerJid, { image: { url: mediaPath }, ...messageOptions });
          } else if (mediaPath.endsWith('.mp4')) {
            await conn.sendMessage(ownerJid, { video: { url: mediaPath }, ...messageOptions });
          } else if (mediaPath.endsWith('.webp')) {
            await conn.sendMessage(ownerJid, { sticker: { url: mediaPath } });
            await conn.sendMessage(ownerJid, { text: caption, mentions: [sender] });
          } else if (mediaPath.endsWith('.ogg')) {
            await conn.sendMessage(ownerJid, {
              audio: { url: mediaPath, mimetype: 'audio/ogg; codecs=opus' }
            });
            await conn.sendMessage(ownerJid, { text: caption, mentions: [sender] });
          } else {
            await conn.sendMessage(ownerJid, { document: { url: mediaPath }, ...messageOptions });
          }
        } else {
          let textMessage = null;

          if (deleted.message.conversation) {
            textMessage = deleted.message.conversation;
          } else if (deleted.message.extendedTextMessage?.text) {
            textMessage = deleted.message.extendedTextMessage.text;
          } else if (deleted.message.imageMessage?.caption) {
            textMessage = deleted.message.imageMessage.caption;
          } else if (deleted.message.videoMessage?.caption) {
            textMessage = deleted.message.videoMessage.caption;
          } else if (deleted.message.documentMessage?.caption) {
            textMessage = deleted.message.documentMessage.caption;
          } else {
            const msgValues = Object.values(deleted.message);
            for (const val of msgValues) {
              if (val?.text) {
                textMessage = val.text;
                break;
              }
            }
          }

          const finalText = textMessage
            ? caption + `\n\n📝 *Message:* ${textMessage}`
            : caption;

          await conn.sendMessage(ownerJid, { text: finalText, mentions: [sender] });
        }
      } catch (e) {
        console.log('❌ Error resending deleted message:', e);
      }
    }
  }
};
