const fs = require('fs');
const path = require('path');

module.exports = {
  onMessage: async (conn, mek) => {
    try {
      if (!mek.message) return;
      
      // Check for viewOnce placeholder messages
      const isViewOnce = mek.message.viewOnceMessage || mek.message.viewOnceMessageV2;
      
      if (isViewOnce) {
        console.log('🔔 ViewOnce Message Detected (But cannot access content on Web)');
        
        const from = mek.key.remoteJid;
        const sender = mek.key.participant || from;
        const senderNumber = sender.split('@')[0];
        
        // Create notification message
        const notification = `
┏━━ 🚨 *VIEWONCE DETECTED* ━━┓

👤 *Sender:* @${senderNumber}
🕒 *Time:* ${new Date().toLocaleString()}
💬 *Chat:* ${from}

⚠️ *Privacy Notice:*
ViewOnce messages are protected by WhatsApp's privacy features. 
For security reasons, these messages can only be viewed on 
official WhatsApp mobile apps.

📱 *Please open WhatsApp on your phone to view this message.*

✅ *MMT Business Hub Security Alert*

┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

        // Send notification to the chat where viewOnce was sent
        await conn.sendMessage(from, {
          text: notification,
          mentions: [sender]
        });

        // Also notify bot owner
        try {
          const ownerNotification = `🔔 *ViewOnce Alert*\n\n• From: @${senderNumber}\n• Chat: ${from}\n• Time: ${new Date().toLocaleString()}\n\n📱 ViewOnce message detected but cannot be accessed due to WhatsApp privacy restrictions.`;
          
          await conn.sendMessage(conn.user.id.split(':')[0] + '@s.whatsapp.net', {
            text: ownerNotification,
            mentions: [sender]
          });
        } catch (ownerError) {
          console.log('⚠️ Could not notify owner:', ownerError.message);
        }
        
        console.log(`✅ ViewOnce detection notified for ${senderNumber}`);
      }
    } catch (error) {
      console.log('❌ ViewOnce detection error:', error);
    }
  },

  onDelete: async (conn, updates) => {
    // Optional: Handle viewOnce message deletions
    for (const update of updates) {
      if (!update || !update.key) continue;
      // You can add deletion tracking if needed
    }
  }
};
