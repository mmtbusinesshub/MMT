const { cmd } = require("../command");

cmd(
  {
    pattern: "buttons",
    react: "🎛️",
    desc: "Test button message",
    category: "test",
    filename: __filename,
  },
  async (sock, mek, m, { reply }) => {
    try {
      const buttons = [
        { buttonId: 'id1', buttonText: { displayText: '🌟 Button 1' }, type: 1 },
        { buttonId: 'id2', buttonText: { displayText: '🔥 Button 2' }, type: 1 },
        { buttonId: 'id3', buttonText: { displayText: '💎 Button 3' }, type: 1 },
      ];

      const buttonMessage = {
        text: "👋 *Hello!* This is a test button message.\n\nSelect an option below:",
        footer: "MMT BUSINESS HUB • Test Menu",
        buttons,
        headerType: 1,
      };

      await sock.sendMessage(m.chat, buttonMessage, { quoted: mek });

    } catch (e) {
      console.error("❌ [TEST BUTTON PLUGIN] Error:", e);
      await reply("⚠️ Failed to send button message.");
    }
  }
);
