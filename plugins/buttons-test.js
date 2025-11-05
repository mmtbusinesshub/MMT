const { cmd } = require("../command");

cmd(
  {
    pattern: "buttons",
    react: "🔘",
    desc: "Send a 2-button test message",
    category: "main",
    filename: __filename,
  },
  async (dilshan, mek, m, { reply }) => {
    try {
      const buttons = [
        { buttonId: "btn_1", buttonText: { displayText: "Button 1 ✅" }, type: 1 },
        { buttonId: "btn_2", buttonText: { displayText: "Button 2 🚀" }, type: 1 },
      ];

      const buttonMessage = {
        text: "Here’s a 2-button test message 👇",
        footer: "Baileys Button Test",
        buttons: buttons,
        headerType: 1
      };

      await dilshan.sendMessage(m.chat, buttonMessage, { quoted: m });
    } catch (err) {
      console.error("Error sending buttons:", err);
      await reply("❌ Failed to send button message.");
    }
  }
);
