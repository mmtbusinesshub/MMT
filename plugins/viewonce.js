const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'viewonce',

  /**
   * Automatically triggered when any message is received.
   * Works with your global.pluginHooks system.
   */
  onMessage: async (conn, mek) => {
    try {
      // ✅ Detect ViewOnce message (v2)
      if (!mek.message?.viewOnceMessageV2) return;

      console.log('🔍 ViewOnce message detected!');

      const msg = mek.message.viewOnceMessageV2.message;
      const type = Object.keys(msg)[0]; // imageMessage or videoMessage
      const media = msg[type];
      const from = mek.key.remoteJid;

      if (!media) {
        console.log('⚠️ No media found inside ViewOnce message.');
        return;
      }

      // Send temporary "processing" message
      await conn.sendMessage(from, {
        text: `🔓 *Recovering ${type === 'imageMessage' ? 'image' : 'video'}... please wait!*`
      });

      // ✅ Download media
      const stream = await downloadContentFromMessage(
        media,
        type === 'imageMessage' ? 'image' : 'video'
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const caption = media.caption || '📤 *Recovered ViewOnce media!*';

      // ✅ Send the recovered media back
      await conn.sendMessage(from, {
        [type === 'imageMessage' ? 'image' : 'video']: buffer,
        caption,
      }, { quoted: mek });

      console.log(`✅ Successfully recovered a ${type} from ${from}`);
    } catch (err) {
      console.error('❌ Error recovering ViewOnce message:', err);
      try {
        await conn.sendMessage(mek.key.remoteJid, {
          text: '❌ Failed to recover this ViewOnce message. It might be expired or corrupted.'
        });
      } catch {}
    }
  },
};
