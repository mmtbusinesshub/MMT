const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');

module.exports = {
  name: 'viewonce',
  onMessage: async (conn, mek) => {
    // print structure for analysis
    if (mek.message) {
      console.log('\n🧩 Incoming message types:', Object.keys(mek.message));
      fs.writeFileSync('last_message.json', JSON.stringify(mek.message, null, 2));
    }
  }
};
