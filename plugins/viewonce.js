const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'viewonce',
  onMessage: async (conn, mek) => {
    // Detect view-once message (both types)
    const viewOnce =
      mek.message?.viewOnceMessageV2 ||
      mek.message?.viewOnceMessageV2Extension;

    if (!viewOnce) return;

    try {
      const msg = viewOnce.message;
      const type = Object.keys(msg || {})[0];
      const mediaMsg = msg[type];
      if (!mediaMsg) return;

      const stream = await downloadContentFromMessage(
        mediaMsg,
        type === 'imageMessage' ? 'image' : 'video'
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // Send recovered media back to the chat
      await conn.sendMessage(
        mek.key.remoteJid,
        {
          [type === 'imageMessage' ? 'image' : 'video']: buffer,
          caption: `📤 *Recovered ViewOnce ${
            type === 'imageMessage' ? 'Photo' : 'Video'
          }!*`,
        },
        { quoted: mek }
      );

      console.log(`✅ ViewOnce recovered for ${mek.key.remoteJid}`);
    } catch (err) {
      console.error('❌ Error recovering view-once:', err);
    }
  },
};
