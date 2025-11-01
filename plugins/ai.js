// plugins/ai-autoreply.js
module.exports = {
  onMessage: async (conn, mek) => {
    const key = mek.key;
    const content = mek.message;
    if (!content || key.fromMe) return;

    // Extract text from all possible types
    let text =
      content.conversation ||
      content.extendedTextMessage?.text ||
      content.imageMessage?.caption ||
      content.videoMessage?.caption ||
      content.documentMessage?.caption;

    if (!text) return;

    const lower = text.toLowerCase();
    const from = key.remoteJid;

    // List of keywords and replies
    const replies = [
      { keywords: ["price", "pricing", "cost"], reply: "Our pricing starts from Rs. 2500 depending on your package. Would you like details?" },
      { keywords: ["location", "address"], reply: "We are located in Colombo, Sri Lanka 🇱🇰. You can visit or order online!" },
      { keywords: ["contact", "phone", "call"], reply: "You can reach us at 📞 +94xxxxxxxxx or reply here anytime." },
      { keywords: ["delivery", "ship"], reply: "Yes, we offer delivery across Sri Lanka. Delivery charges depend on your location." },
      { keywords: ["hello", "hi", "hey"], reply: "Hello! 👋 How can I assist you today?" },
      { keywords: ["thank", "thanks"], reply: "You’re welcome! 😊 Happy to help." },
      { keywords: ["service", "product"], reply: "We offer a variety of services and products. Could you please specify which one you are interested in?" },
    ];

    // Send matching reply
    for (let item of replies) {
      if (item.keywords.some(k => lower.includes(k))) {
        await conn.sendMessage(from, { text: item.reply });
        return;
      }
    }

    // Optional fallback
    await conn.sendMessage(from, { text: "Thanks for your message! We will get back to you shortly." });
  }
};
