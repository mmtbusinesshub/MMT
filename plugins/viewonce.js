const fs = require('fs');

module.exports = {
  name: 'viewonce',
  onMessage: async (conn, mek) => {
    try {
      if (!mek.message) return;

      console.log('\n🧩 DEBUG: Raw message keys =>', Object.keys(mek.message));

      // Save full raw message object for analysis
      fs.writeFileSync(
        'debug_last_message.json',
        JSON.stringify(mek.message, null, 2)
      );

      // 🔍 Function to recursively unwrap message layers
      const unwrapMessage = (msg) => {
        if (!msg) return msg;
        if (msg.ephemeralMessage) return unwrapMessage(msg.ephemeralMessage.message);
        if (msg.viewOnceMessageV2) return unwrapMessage(msg.viewOnceMessageV2.message);
        if (msg.viewOnceMessageV2Extension)
          return unwrapMessage(msg.viewOnceMessageV2Extension.message);
        return msg;
      };

      // Unwrap the actual content
      const realMsg = unwrapMessage(mek.message);

      // 🔎 Now check the real message
      if (realMsg.imageMessage) {
        console.log('📸 Found: View Once IMAGE');
      } else if (realMsg.videoMessage) {
        console.log('🎥 Found: View Once VIDEO');
      } else {
        console.log('⚪ No view-once media found in this message.');
      }

    } catch (err) {
      console.error('❌ Debug plugin error:', err);
    }
  },
};
