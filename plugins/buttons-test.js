const { cmd } = require("../command");

cmd(
  {
    pattern: "debug",
    react: "🐛",
    desc: "Debug parameters",
    category: "main",
    filename: __filename,
  },
  async (conn, mek, m, { from, reply }) => {
    const debugInfo = `
🔧 *DEBUG INFORMATION*

📱 From: ${from}
💬 Body: ${m.body || 'No body'}
🔑 Key: ${JSON.stringify(m.key, null, 2)}
👤 Sender: ${m.sender}
🤖 Bot: ${conn.user.id}

📊 mek type: ${typeof mek}
📊 m type: ${typeof m}
    `;
    
    console.log("Debug info:", { from, mek, m });
    await reply(debugInfo);
  }
);
