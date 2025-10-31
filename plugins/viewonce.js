const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'viewonce_fix',
  onMessage: async (conn, mek) => {
    try {
      let viewOnceMsg;

      // 🧩 Case 1: direct viewOnce message
      if (mek.message?.viewOnceMessageV2 || mek.message?.viewOnceMessageV2Extension) {
        viewOnceMsg = mek.message.viewOnceMessageV2 || mek.message.viewOnceMessageV2Extension;
      }

      // 🧩 Case 2: wrapped inside ephemeral message
      else if (mek.message?.ephemeralMessage?.message?.viewOnceMessageV2 ||
               mek.message?.ephemeralMessage?.message?.viewOnceMessageV2Extension) {
        viewOnceMsg =
          mek.message.ephemeralMessage.message.viewOnceMessageV2 ||
          mek.message.ephemeralMessage.message.viewOnceMessageV2Extension;
      }

      if (!viewOnceMsg) return; // not a view-once message

      // Extract actual media
      const innerMsg = viewOnceMsg.message;
      const type = Object.keys(innerMsg || {})[0];
      const mediaMsg = innerMsg[type];
      if (!mediaMsg) return;

      // Download media
      const stream = await downloadContentFromMessage(
        mediaMsg,
        type === 'imageMessage' ? 'image' : 'video'
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // Send recovered image or video back to chat
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

      console.log(`✅ ViewOnce recovered from ${mek.key.remoteJid}`);
    } catch (err) {
      console.error('❌ Error recovering view-once:', err);
    }
  },
};
