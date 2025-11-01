const fs = require('fs');
const path = require('path');

let viewOnceMessages = {};

const tempFolder = path.join(__dirname, '../temp');
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

module.exports = {
  onMessage: async (conn, msg) => {
    try {
      const key = msg.key;
      const content = msg.message;
      
      if (!content || key.fromMe) return;

      // Check if it's a viewOnce message
      const isViewOnce = content.viewOnceMessage || content.viewOnceMessageV2;
      if (!isViewOnce) return;

      console.log('🔍 ViewOnce message detected from:', key.remoteJid);

      // Store the viewOnce message data
      viewOnceMessages[key.id] = {
        key: key,
        message: content,
        timestamp: Date.now(),
        sender: key.participant || key.remoteJid
      };

      // If media buffer is available, process immediately
      if (msg._mediaBuffer && msg._mediaType) {
        console.log('✅ Media buffer available, processing viewOnce...');
        await this.processViewOnce(conn, key.id);
      } else {
        console.log('⚠️ No media buffer available for viewOnce');
      }

    } catch (error) {
      console.log('❌ Error in viewOnce detection:', error);
    }
  },

  processViewOnce: async (conn, messageId) => {
    try {
      const viewOnceData = viewOnceMessages[messageId];
      if (!viewOnceData) {
        console.log('❌ No viewOnce data found for:', messageId);
        return;
      }

      const { key, message, sender } = viewOnceData;
      const from = key.remoteJid;

      // Extract viewOnce content
      const viewOnceContent = message.viewOnceMessage || message.viewOnceMessageV2;
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

      console.log(`📁 Processing ${mediaType} from viewOnce`);

      // Get the media buffer from the original message
      if (!msg._mediaBuffer) {
        console.log('❌ No media buffer available');
        return;
      }

      // Determine file extension
      let ext = '.bin';
      let mimeType = 'application/octet-stream';
      
      if (mediaType === 'imageMessage') {
        ext = '.jpg';
        mimeType = mediaData.mimetype || 'image/jpeg';
      } else if (mediaType === 'videoMessage') {
        ext = '.mp4';
        mimeType = mediaData.mimetype || 'video/mp4';
      } else if (mediaType === 'stickerMessage') {
        ext = '.webp';
        mimeType = 'image/webp';
      } else if (mediaType === 'audioMessage') {
        ext = '.ogg';
        mimeType = 'audio/ogg; codecs=opus';
      }

      // Save to temp file (optional, for debugging)
      const fileName = `viewonce_${messageId}${ext}`;
      const filePath = path.join(tempFolder, fileName);
      
      try {
        await fs.promises.writeFile(filePath, msg._mediaBuffer);
        console.log(`✅ ViewOnce media saved to: ${filePath}`);
      } catch (e) {
        console.log('⚠️ Could not save media file:', e.message);
      }

      // Create caption
      const caption = `
┏━━ 🚨 *VIEWONCE RECOVERED* ━━┓

👤 *Sender:* @${sender.split('@')[0]}
🕒 *Time:* ${new Date().toLocaleString()}
📁 *Type:* ${mediaType.replace('Message', '').toUpperCase()}

⚠️ ViewOnce media has been successfully *recovered*.

✅ Service: *MMT Business Hub WhatsApp Assistant*

┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

      // Send the recovered media
      const messageOptions = { 
        caption: caption, 
        mentions: [sender] 
      };

      try {
        if (mediaType === 'imageMessage') {
          await conn.sendMessage(from, { 
            image: msg._mediaBuffer,
            mimetype: mimeType,
            ...messageOptions 
          });
          console.log(`✅ ViewOnce image sent successfully`);
        } else if (mediaType === 'videoMessage') {
          await conn.sendMessage(from, { 
            video: msg._mediaBuffer,
            mimetype: mimeType,
            ...messageOptions 
          });
          console.log(`✅ ViewOnce video sent successfully`);
        } else if (mediaType === 'stickerMessage') {
          await conn.sendMessage(from, { 
            sticker: msg._mediaBuffer,
            ...messageOptions 
          });
          console.log(`✅ ViewOnce sticker sent successfully`);
        } else {
          // For other types, send as document
          await conn.sendMessage(from, { 
            document: msg._mediaBuffer,
            mimetype: mimeType,
            fileName: `recovered_viewonce${ext}`,
            ...messageOptions 
          });
          console.log(`✅ ViewOnce media sent as document`);
        }

        // Clean up
        delete viewOnceMessages[messageId];
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.log('⚠️ Could not delete temp file:', cleanupError.message);
        }

      } catch (sendError) {
        console.log('❌ Error sending recovered media:', sendError);
      }

    } catch (error) {
      console.log('❌ Error processing viewOnce:', error);
    }
  },

  onDelete: async (conn, updates) => {
    // Clean up viewOnce messages when they're deleted
    for (const update of updates) {
      if (!update || !update.key) continue;

      const messageId = update.key.id;
      if (viewOnceMessages[messageId]) {
        delete viewOnceMessages[messageId];
        console.log('🧹 Cleaned up deleted viewOnce message:', messageId);
      }
    }
  }
};
