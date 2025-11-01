const { cmd } = require("../command");

cmd({
  pattern: ".*", // match all messages
  fromMe: false, // ignore messages from yourself
  react: "🤖",
  desc: "Auto-reply to user messages based on keywords",
  category: "ai",
  async handler(mek, { sock, q }) {
    const from = mek.key.remoteJid;
    const text = mek.message?.conversation || mek.message?.extendedTextMessage?.text;
    if (!text) return;

    const lower = text.toLowerCase();

    // ===== Keyword-based replies =====
    const replies = [
      { keywords: ["price", "pricing", "cost"], reply: "Our pricing starts from Rs. 2500 depending on your package. Would you like me to send details?" },
      { keywords: ["location", "address"], reply: "We are located in Colombo, Sri Lanka 🇱🇰. You can visit or order online!" },
      { keywords: ["contact", "phone", "call"], reply: "You can reach us at 📞 +94xxxxxxxxx or reply here anytime." },
      { keywords: ["delivery", "ship"], reply: "Yes, we offer delivery across Sri Lanka. Delivery charges depend on your location." },
      { keywords: ["hello", "hi", "hey"], reply: "Hello! 👋 How can I assist you today?" },
      { keywords: ["thank", "thanks"], reply: "You’re welcome! 😊 Happy to help." },
      { keywords: ["service", "product"], reply: "We offer a variety of services and products. Could you please specify which one you are interested in?" },
    ];

    // check for matching keyword
    for (let item of replies) {
      if (item.keywords.some(k => lower.includes(k))) {
        await sock.sendMessage(from, { text: item.reply });
        return;
      }
    }

    // fallback reply
    await sock.sendMessage(from, { text: "Thanks for your message! We will get back to you shortly." });
  }
});
