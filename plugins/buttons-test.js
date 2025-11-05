const { cmd } = require("../command");

cmd(
  {
    pattern: "buttons",
    react: "🔘",
    desc: "Send a 2-button test message (new format)",
    category: "main",
    filename: __filename,
  },
  async (dilshan, mek, m, { reply }) => {
    try {
      const templateButtons = [
        { index: 1, quickReplyButton: { displayText: "✅ Button 1", id: "btn_1" } },
        { index: 2, quickReplyButton: { displayText: "🚀 Button 2", id: "btn_2" } },
      ];

      const message = {
        text: "Here’s a 2-button test message 👇",
        footer: "Baileys Template Button Test",
        templateButtons,
      };

      await dilshan.sendMessage(m.chat, message);
    } catch (err) {
      console.error("Error sending template buttons:", err);
      await reply("❌ Failed to send button message.");
    }
  }
);
