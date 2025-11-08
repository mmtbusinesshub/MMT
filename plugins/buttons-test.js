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
    // Get the correct JID - try different parameters
    const jid = m?.key?.remoteJid || mek;

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

    try {
      // Send the button message with proper JID handling
      await dilshan.sendMessage(jid, buttonMessage, { quoted: null });
    } catch (error) {
      console.error("Error sending button message:", error);
      await reply("❌ Failed to send buttons. Please try again.");
    }
  }
);

// Alternative version if the above still doesn't work:
cmd(
  {
    pattern: "buttons2",
    react: "🔘",
    desc: "Test buttons message (alternative)",
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

    try {
      // Use reply function if available, otherwise try direct send
      if (reply) {
        await reply(buttonMessage);
      } else {
        const jid = m?.key?.remoteJid || mek?.from || mek;
        await dilshan.sendMessage(jid, buttonMessage, { quoted: null });
      }
    } catch (error) {
      console.error("Error sending button message:", error);
      await reply("❌ Failed to send buttons. Please try again.");
    }
  }
);

// Button handlers
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
