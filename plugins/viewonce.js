const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'viewonce',
  onMessage: async (conn, mek) => {
    // Detect view-once message
    if (mek.message?.viewOnceMessageV2) {
      try {
        const msg = mek.message.viewOnceMessageV2.message;
        const type = Object.keys(msg)[0]; // imageMessage / videoMessage
        const mediaMsg = msg[type];

        // Download media
        const stream = await downloadContentFromMessage(
          mediaMsg,
          type === 'imageMessage' ? 'image' : 'video'
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        // Send recovered media
        await conn.sendMessage(mek.key.remoteJid, {
          [type === 'imageMessage' ? 'image' : 'video']: buffer,
          caption: `📤 *Recovered ViewOnce ${type === 'imageMessage' ? 'Photo' : 'Video'}!*`
        }, { quoted: mek });

        console.log(`✅ ViewOnce recovered for ${mek.key.remoteJid}`);
      } catch (err) {
        console.error("❌ Error recovering view-once:", err);
      }
    }
  }
};
