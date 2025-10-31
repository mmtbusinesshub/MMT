const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'antiviewonce',
  onMessage: async (conn, mek) => {
    if (mek.message?.viewOnceMessageV2) {
      try {
        const msg = mek.message.viewOnceMessageV2.message;
        const type = Object.keys(msg)[0];
        const mediaMsg = msg[type];

        const stream = await downloadContentFromMessage(mediaMsg, type === "imageMessage" ? "image" : "video");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await conn.sendMessage(mek.key.remoteJid, {
          [type === "imageMessage" ? "image" : "video"]: buffer,
          caption: `${mediaMsg.caption || ""}\n\n🔓 *Recovered View Once Message*`
        }, { quoted: mek });
      } catch (e) {
        console.log("Error recovering view-once:", e);
      }
    }
  }
};
