const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { empiretourl } = require("../lib/functions");

const tempFolder = path.join(__dirname, "../temp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

module.exports = {
  onMessage: async (conn, msg) => {
    try {
      if (!msg.message || msg.key.fromMe) return;

      // Detect ViewOnce message (either v1 or v2)
      const viewOnce =
        msg.message.viewOnceMessageV2?.message ||
        msg.message.viewOnceMessage?.message;
      if (!viewOnce) return;

      // Identify message type (image or video)
      const msgType = Object.keys(viewOnce)[0];
      if (!["imageMessage", "videoMessage"].includes(msgType)) return;

      const mediaMsg = viewOnce[msgType];
      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;

      // Download the content
      const stream = await downloadContentFromMessage(
        mediaMsg,
        msgType === "imageMessage" ? "image" : "video"
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // Save temporarily
      const ext =
        msgType === "imageMessage"
          ? mediaMsg.mimetype?.split("/")[1] || "jpg"
          : mediaMsg.mimetype?.split("/")[1] || "mp4";

      const fileName = `${msg.key.id}.${ext}`;
      const filePath = path.join(tempFolder, fileName);
      await fs.promises.writeFile(filePath, buffer);

      // Upload to CDN (optional, but cool)
      let uploadedUrl = null;
      try {
        const uploadRes = await empiretourl(filePath);
        uploadedUrl = uploadRes.url || uploadRes.file || null;
      } catch (err) {
        console.log("⚠️ Empire upload failed:", err.message);
      }

      // Format message caption
      const caption = `
┏━━ 🕵️‍♂️ *Anti-ViewOnce Triggered* ━━┓
👤 *Sender:* @${sender.split("@")[0]}
🕒 *Time:* ${new Date().toLocaleString()}

💡 *Recovered ViewOnce ${msgType === "imageMessage" ? "Image" : "Video"}*
${uploadedUrl ? `🌐 *CDN Link:* ${uploadedUrl}` : ""}
✅ Service: *MMT Business Hub WhatsApp Assistant*
┗━━━━━━━━━━━━━━━━━━━━┛`;

      // Send recovered content
      const messageOptions = { caption, mentions: [sender] };

      if (msgType === "imageMessage") {
        await conn.sendMessage(from, { image: { url: filePath }, ...messageOptions });
      } else if (msgType === "videoMessage") {
        await conn.sendMessage(from, { video: { url: filePath }, ...messageOptions });
      }

      console.log(`✅ AntiViewOnce: recovered ${msgType} from ${sender}`);
    } catch (err) {
      console.error("❌ AntiViewOnce Error:", err);
    }
  },
};
