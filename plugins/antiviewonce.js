const fs = require('fs');
const path = require('path');

module.exports = {
  onMessage: async (conn, mek) => {
    try {
      if (!mek.message) return;
      
      // Check for viewOnce messages
      if (mek.message.viewOnceMessage || mek.message.viewOnceMessageV2) {
        console.log('🎯 VIEWONCE DETECTED!');
        
        const from = mek.key.remoteJid;
        const sender = mek.key.participant || from;
        
        // Send immediate confirmation that viewOnce was detected
        await conn.sendMessage(from, {
          text: `🔔 ViewOnce detected from @${sender.split('@')[0]}!\n\nProcessing your viewOnce media...`,
          mentions: [sender]
        });
        
        console.log('✅ ViewOnce detection confirmed');
      }
    } catch (error) {
      console.log('❌ ViewOnce detection error:', error);
    }
  }
};
