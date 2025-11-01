const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Store to track processed viewOnce messages to avoid duplicates
const processedViewOnceMessages = new Set();

module.exports = {
  onMessage: async (conn, msg) => {
    try {
      // Check if it's a viewOnce message
      if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2) {
        const messageId = msg.key.id;
        
        // Avoid processing the same message multiple times
        if (processedViewOnceMessages.has(messageId)) {
          return;
        }
        processedViewOnceMessages.add(messageId);

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        
        // Extract the actual media message from viewOnce wrapper
        const viewOnceContent = msg.message.viewOnceMessage || msg.message.viewOnceMessageV2;
        const actualMessage = viewOnceContent.message;
        const mediaType = getContentType(actualMessage);
        
        if (!['imageMessage', 'videoMessage'].includes(mediaType)) {
          return; // Only handle images and videos
        }

        const mediaMessage = actualMessage[mediaType];
        
        try {
          // Download the media
          const stream = await downloadContentFromMessage(
            mediaMessage,
            mediaType === 'imageMessage' ? 'image' : 'video'
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }

          // Prepare caption with info
          const caption = `📤 *ViewOnce Media Recovered*\n\n👤 *From:* @${sender.split('@')[0]}\n🕒 *Time:* ${new Date().toLocaleString()}\n📁 *Type:* ${mediaType === 'imageMessage' ? 'Image' : 'Video'}\n\n✅ *Recovered by DILSHAN-MD AntiViewOnce*`;

          // Send the recovered media back
          if (mediaType === 'imageMessage') {
            await conn.sendMessage(from, {
              image: buffer,
              caption: caption,
              mentions: [sender]
            }, { quoted: msg });
          } else if (mediaType === 'videoMessage') {
            await conn.sendMessage(from, {
              video: buffer,
              caption: caption,
              mentions: [sender]
            }, { quoted: msg });
          }

          console.log(`✅ ViewOnce media recovered from ${sender}`);

          // Clean up: remove from processed set after 5 minutes to free memory
          setTimeout(() => {
            processedViewOnceMessages.delete(messageId);
          }, 5 * 60 * 1000);

        } catch (downloadError) {
          console.error('❌ Error downloading viewOnce media:', downloadError);
          await conn.sendMessage(from, {
            text: `❌ Failed to recover ViewOnce media\n\nError: ${downloadError.message}`
          }, { quoted: msg });
        }
      }
    } catch (error) {
      console.error('❌ Error in antiviewonce plugin:', error);
    }
  },

  // Optional: Cleanup function to prevent memory leaks
  onDelete: async (conn, updates) => {
    // Clean up processed messages when they're deleted
    for (const update of updates) {
      if (update.key?.id) {
        processedViewOnceMessages.delete(update.key.id);
      }
    }
  }
};
