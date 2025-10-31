const fs = require('fs');

module.exports = {
  name: 'viewonce',
  onMessage: async (conn, mek) => {
    try {
      // Log message type
      if (mek.messageStubType) {
        console.log('📩 Stub Type:', mek.messageStubType, mek.messageStubParameters || []);
      }

      // Detect view-once event
      if (mek.messageStubType === 92) {
        console.log('🕵 View-once message received!');
      } else if (mek.messageStubType === 93) {
        console.log('👁 View-once message was opened!');
      } else if (mek.messageStubType === 94) {
        console.log('🗑 View-once message deleted!');
      }

      // Optional: log anything that still has message content (for normal images/videos)
      if (mek.message) {
        console.log('🧩 Normal message keys:', Object.keys(mek.message));
      }

    } catch (err) {
      console.error('❌ viewonce debug error:', err);
    }
  },
};
