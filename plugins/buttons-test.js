const { cmd } = require("../command");

cmd(
  {
    pattern: "buttons",
    react: "🔘",
    desc: "Test buttons message",
    category: "main",
    filename: __filename,
  },
  async (dilshan, mek, m, { reply }) => {
    // Define the buttons
    const buttons = [
      { buttonId: 'btn1', buttonText: { displayText: 'Button 1' }, type: 1 },
      { buttonId: 'btn2', buttonText: { displayText: 'Button 2' }, type: 1 },
      { buttonId: 'btn3', buttonText: { displayText: 'Button 3' }, type: 1 }
    ];

    // Create the button message
    const buttonMessage = {
      text: "🔘 *Test Buttons* 🔘\n\nThis is a test message with interactive buttons!\nSelect any button below:",
      footer: 'Button Test Plugin',
      buttons: buttons,
      headerType: 1,
      viewOnce: false
    };

    // Send the button message
    await dilshan.sendMessage(mek, buttonMessage, { quoted: null });
  }
);

// Optional: Add handler for button responses
cmd(
  {
    pattern: "btn1",
    desc: "Button 1 handler",
    category: "main",
    filename: __filename,
  },
  async (dilshan, mek, m, { reply }) => {
    await reply("✅ You pressed Button 1!");
  }
);

cmd(
  {
    pattern: "btn2", 
    desc: "Button 2 handler",
    category: "main",
    filename: __filename,
  },
  async (dilshan, mek, m, { reply }) => {
    await reply("✅ You pressed Button 2!");
  }
);

cmd(
  {
    pattern: "btn3",
    desc: "Button 3 handler", 
    category: "main",
    filename: __filename,
  },
  async (dilshan, mek, m, { reply }) => {
    await reply("✅ You pressed Button 3!");
  }
);
