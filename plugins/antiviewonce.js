const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { empiretourl } = require("../lib/functions");

const tempFolder = path.join(__dirname, "../temp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

module.exports = {
  onMessage: async (conn, msg) => {
    try {
      if (!msg.message) return;

      // Ignore messages sent by the bot itself
      if (msg.key.fromMe) return;

      console.log("🕵️ Checking incoming message for ViewOnce...");

      // Detect ViewOnce message types
      const viewOnce =
        msg.message.viewOnceMessageV2?.message ||
        msg.message.viewOnceMessage?.message;

      if (!viewOnce) {
        console.log("🚫 Not a ViewOnce message.");
        return;
      }

      console.log("✅ ViewOnce message detected!");

      const msgType = Object.keys(viewOnce)[0];
      console.log("📸 Message type:", msgType);

      if (!["imageMessage", "videoMessage"].includes(msgType)) {
        console.log("⚠️ Unsupported ViewOnce type:", msgType);
        return;
      }

      const mediaMsg = viewOnce[msgType];
      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      console.log(`👤 From: ${senderNumber}`);
      console.log("⬇️ Downloading media...");

      // Download ViewOnce media
      const stream = await downloadContentFromMessage(
        mediaMsg,
        msgType === "imageMessage" ? "image" : "video"
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      console.log(`✅ Media downloaded (${buffer.length} bytes)`);

      // Save temporarily
      const ext =
        msgType === "imageMessage"
          ? mediaMsg.mimetype?.split("/")[1] || "jpg"
          : mediaMsg.mimetype?.split("/")[1] || "mp4";
      const fileName = `${msg.key.id}.${ext}`;
      const filePath = path.join(tempFolder, fileName);
      await fs.promises.writeFile(filePath, buffer);
      console.log(`💾 Saved to: ${filePath}`);

      // Upload to CDN
      let uploadedUrl = null;
      try {
        const uploadRes = await empiretourl(filePath);
        uploadedUrl = uploadRes.url || uploadRes.file || null;
        console.log("🌐 Uploaded to CDN:", uploadedUrl);
      } catch (err) {
        console.log("⚠️ EmpireTech upload failed:", err.message);
      }

      const caption = `
┏━━ 🕵️‍♂️ *Anti-ViewOnce Triggered* ━━┓
👤 *Sender:* @${senderNumber}
🕒 *Time:* ${new Date().toLocaleString()}

💡 *Recovered ViewOnce ${
        msgType === "imageMessage" ? "Image" : "Video"
      }*
${uploadedUrl ? `🌐 *CDN Link:* ${uploadedUrl}` : ""}
✅ Service: *MMT Business Hub WhatsApp Assistant*
┗━━━━━━━━━━━━━━━━━━━━┛`;

      const messageOptions = { caption, mentions: [sender] };

      console.log("📤 Sending recovered ViewOnce back to chat...");
      if (msgType === "imageMessage") {
        await conn.sendMessage(from, { image: { url: filePath }, ...messageOptions });
      } else if (msgType === "videoMessage") {
        await conn.sendMessage(from, { video: { url: filePath }, ...messageOptions });
      }

      console.log("✅ Successfully resent ViewOnce message to chat.");

      // Optional cleanup
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          console.log("🧹 Temp file deleted:", fileName);
        } catch (e) {
          console.log("⚠️ Failed to delete temp file:", e.message);
        }
      }, 15000); // Delete after 15 seconds

    } catch (err) {
      console.error("❌ AntiViewOnce error:", err);
    }
  },
};
