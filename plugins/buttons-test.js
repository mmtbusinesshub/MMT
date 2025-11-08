const { cmd } = require("../command");

cmd(
  {
    pattern: "buttons",
    react: "🎛️",
    desc: "Test WhatsApp buttons",
    category: "test",
    filename: __filename,
  },
  async (sock, mek, m, { reply }) => {
    try {
      // Define buttons
      const buttons = [
        { index: 1, quickReplyButton: { displayText: "🌟 Button 1", id: "btn1" } },
        { index: 2, quickReplyButton: { displayText: "🔥 Button 2", id: "btn2" } },
        { index: 3, quickReplyButton: { displayText: "💎 Button 3", id: "btn3" } },
      ];

      // Create button message
      const buttonMessage = {
        text: "👋 *Hello!* This is a test button message.\nSelect an option below:",
        footer: "MMT BUSINESS HUB • Test Menu",
        templateButtons: buttons,
      };

      // Send buttons
      await sock.sendMessage(m.chat, buttonMessage, { quoted: mek });
    } catch (err) {
      console.error("❌ [TEST BUTTON PLUGIN ERROR]:", err);
      await reply("⚠️ Failed to send buttons. Check console.");
    }
  }
);

// Optional: Handle button clicks
module.exports.onMessage = async (sock, mek) => {
  const msg = mek.message?.templateButtonReplyMessage;
  if (!msg) return;

  const id = msg.selectedId;
  const from = mek.key.remoteJid;

  switch (id) {
    case "btn1":
      await sock.sendMessage(from, { text: "✅ You pressed *Button 1!*" }, { quoted: mek });
      break;
    case "btn2":
      await sock.sendMessage(from, { text: "🔥 You pressed *Button 2!*" }, { quoted: mek });
      break;
    case "btn3":
      await sock.sendMessage(from, { text: "💎 You pressed *Button 3!*" }, { quoted: mek });
      break;
  }
};
