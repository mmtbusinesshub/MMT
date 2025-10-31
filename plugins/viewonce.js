const fs = require('fs');

module.exports = {
  name: 'viewonce',
  onMessage: async (conn, mek) => {
    try {
      if (!mek.message) return;

      console.log('\n🧩 DEBUG: Raw message keys =>', Object.keys(mek.message));

      // Save full raw message object to a JSON file (overwrites each time)
      fs.writeFileSync(
        'debug_last_message.json',
        JSON.stringify(mek.message, null, 2)
      );

      // Log view-once related structures if any
      if (mek.message.viewOnceMessageV2)
        console.log('📸 Found: viewOnceMessageV2');
      if (mek.message.viewOnceMessageV2Extension)
        console.log('📸 Found: viewOnceMessageV2Extension');
      if (mek.message.ephemeralMessage)
        console.log(
          '🕓 Found: ephemeralMessage =>',
          Object.keys(mek.message.ephemeralMessage.message || {})
        );
    } catch (err) {
      console.error('❌ Debug plugin error:', err);
    }
  },
};
