const fs = require('fs');
const path = require('path');

let viewOnceMessages = {};
let viewOnceMediaPath = {};

const tempFolder = path.join(__dirname, '../temp');
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

module.exports = {
  onMessage: async (conn, msg) => {
    const key = msg.key;
    const content = msg.message;
    if (!content || key.fromMe) return;

    // Check if it's a viewOnce message
    const isViewOnce = content.viewOnceMessage || content.viewOnceMessageV2;
    if (!isViewOnce) return;

    console.log('🔍 ViewOnce message detected');

    // Save viewOnce message for processing
    viewOnceMessages[key.id] = { key, message: content };

    // If media buffer is already available, save it
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

      const fileName = `viewonce_${key.id}${ext}`;
      const filePath = path.join(tempFolder, fileName);
      try {
        await fs.promises.writeFile(filePath, msg._mediaBuffer);
        viewOnceMediaPath[key.id] = filePath;
        console.log(`✅ ViewOnce media saved: ${filePath}`);
        
        // Auto-recover immediately since we have the buffer
        await this.recoverViewOnce(conn, key.id);
      } catch (e) {
        console.log('❌ ViewOnce media save failed:', e.message);
      }
    }
  },

  recoverViewOnce: async (conn, messageId) => {
    try {
      const viewOnceData = viewOnceMessages[messageId];
      if (!viewOnceData) {
        console.log('❌ No viewOnce data found for:', messageId);
        return;
      }

      const from = viewOnceData.key.remoteJid;
      const sender = viewOnceData.key.participant || from;
      const content = viewOnceData.message;

      // Extract viewOnce content
      const viewOnceContent = content.viewOnceMessage || content.viewOnceMessageV2;
      if (!viewOnceContent?.message) {
        console.log('❌ No message in viewOnce content');
        return;
      }

      const actualMessage = viewOnceContent.message;
      const mediaType = Object.keys(actualMessage)[0]; // imageMessage, videoMessage, etc.
      const mediaData = actualMessage[mediaType];

      if (!mediaData) {
        console.log('❌ No media data found');
        return;
      }

      const caption = `
┏━━ 🚨 *VIEWONCE RECOVERED* ━━┓

👤 *Sender:* @${sender.split('@')[0]}
🕒 *Time:* ${new Date().toLocaleString()}
📁 *Type:* ${mediaType.replace('Message', '').toUpperCase()}

⚠️ ViewOnce media has been successfully *recovered*.

✅ Service: *MMT Business Hub WhatsApp Assistant*

┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

      const mediaPath = viewOnceMediaPath[messageId];
      
      if (mediaPath && fs.existsSync(mediaPath)) {
        let messageOptions = { caption, mentions: [sender] };
        
        if (mediaPath.endsWith('.jpg')) {
          await conn.sendMessage(from, { image: { url: mediaPath }, ...messageOptions });
          console.log(`✅ ViewOnce image recovered and sent to ${from}`);
        } else if (mediaPath.endsWith('.mp4')) {
          await conn.sendMessage(from, { video: { url: mediaPath }, ...messageOptions });
          console.log(`✅ ViewOnce video recovered and sent to ${from}`);
        } else if (mediaPath.endsWith('.webp')) {
          await conn.sendMessage(from, { sticker: { url: mediaPath } });
          await conn.sendMessage(from, { text: caption, mentions: [sender] });
          console.log(`✅ ViewOnce sticker recovered and sent to ${from}`);
        } else if (mediaPath.endsWith('.ogg')) {
          await conn.sendMessage(from, {
            audio: { url: mediaPath, mimetype: 'audio/ogg; codecs=opus' }
          });
          await conn.sendMessage(from, { text: caption, mentions: [sender] });
          console.log(`✅ ViewOnce audio recovered and sent to ${from}`);
        } else {
          await conn.sendMessage(from, { document: { url: mediaPath }, ...messageOptions });
          console.log(`✅ ViewOnce document recovered and sent to ${from}`);
        }
      } else {
        // If no media file, try to extract text information
        let mediaInfo = `Media Type: ${mediaType}\n`;
        
        if (mediaData.caption) {
          mediaInfo += `Caption: ${mediaData.caption}\n`;
        }
        
        if (mediaData.fileName) {
          mediaInfo += `File Name: ${mediaData.fileName}\n`;
        }
        
        const infoMessage = caption + `\n\n📊 *Media Info:*\n${mediaInfo}\n💡 *Note:* Media buffer not available for automatic recovery.`;
        await conn.sendMessage(from, { text: infoMessage, mentions: [sender] });
        console.log(`✅ ViewOnce info sent to ${from}`);
      }

      // Clean up
      delete viewOnceMessages[messageId];
      if (mediaPath && fs.existsSync(mediaPath)) {
        fs.unlinkSync(mediaPath);
        delete viewOnceMediaPath[messageId];
      }

    } catch (e) {
      console.log('❌ Error recovering viewOnce message:', e);
    }
  },

  onDelete: async (conn, updates) => {
    // Optional: Clean up viewOnce messages when they're deleted
    for (const update of updates) {
      if (!update || !update.key) continue;

      const messageId = update.key.id;
      
      // Clean up viewOnce data if the message is deleted
      if (viewOnceMessages[messageId]) {
        delete viewOnceMessages[messageId];
      }
      
      if (viewOnceMediaPath[messageId]) {
        const mediaPath = viewOnceMediaPath[messageId];
        if (fs.existsSync(mediaPath)) {
          fs.unlinkSync(mediaPath);
        }
        delete viewOnceMediaPath[messageId];
      }
    }
  }
};
