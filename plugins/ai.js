// plugins/auto-greetings.js
const axios = require('axios');
const config = require('../config');

// 🩵 Sticker URLs
const greetingStickerUrls = {
  morning: 'https://raw.githubusercontent.com/DANUWA-MD/DANUWA-BOT/refs/heads/main/media/stickers/%F0%9F%8D%81%20%EF%BC%A4%EF%BC%A1%EF%BC%AE%EF%BC%B5%EF%BC%B7%EF%BC%A1%EF%BC%8D%20%E3%80%BD%EF%B8%8F%EF%BC%A4%20%F0%9F%8D%81%205.webp',
  afternoon: 'https://raw.githubusercontent.com/DANUWA-MD/DANUWA-BOT/refs/heads/main/media/stickers/afternoon.webp',
  evening: 'https://raw.githubusercontent.com/DANUWA-MD/DANUWA-BOT/refs/heads/main/media/stickers/evening.webp',
  night: 'https://raw.githubusercontent.com/DANUWA-MD/DANUWA-BOT/refs/heads/main/media/stickers/night.webp',
};

// 💬 Trigger keywords
const greetingsMap = {
  morning: ["gm", "good morning", "gud morning", "subha udasanak", "සුභ උදෑසනක්", "காலை வணக்கம்"],
  afternoon: ["good afternoon", "gud afternoon", "ga", "සුභ දවස්‌", "மதிய வணக்கம்"],
  evening: ["good evening", "gud evening", "ge", "සුභ සැන්දෑවක්", "மாலை வணக்கம்"],
  night: ["gn", "good night", "gud night", "gud nyt", "good nite", "සුභ රාත්‍රියක්", "இரவு வணக்கம்"],
  hello: ["hello", "hey", "hi", "hai", "හෙලෝ", "ஹலோ"],
  howareyou: ["how are you", "how r u", "how ru", "ඔයාට කොහොමද", "நீங்கள் எப்படி இருக்கிறீர்கள்"],
  thanks: ["thank you", "thanks", "thx", "ස්තුතියි", "நன்றி"]
};

// 🗨️ Reply texts
const greetingTexts = {
  morning: {
    en: "🌅 Good Morning! Have a fresh start!",
    si: "🌅 සුභ උදෑසනක්! ඔබට අලුත් දවසක් වේවා!"
  },
  afternoon: {
    en: "☀️ Good Afternoon! Keep going strong!",
    si: "☀️ සුභ දවස් අලුතක්! ශක්තිමත් වෙන්න!"
  },
  evening: {
    en: "🌆 Good Evening! How was your day?",
    si: "🌆 සුභ සැන්දෑවක්! ඔබේ දවස කොහොමද?"
  },
  night: {
    en: "🌙 Good Night! Sweet dreams!",
    si: "🌙 සුභ රාත්‍රියක්! හීනයන් මනම්!"
  },
  hello: {
    en: "👋 Hello! How can I assist you today?",
    si: "👋 ආයුබෝවන්! මට අද ඔබට කෙසේ උදව් කල හැකිද?"
  },
  howareyou: {
    en: "🙂 I'm fine, thank you! How about you?",
    si: "🙂 මම හොඳයි, ඔබට ස්තුතියි! ඔබට කොහොමද?"
  },
  thanks: {
    en: "🙏 You're welcome!",
    si: "🙏 ඔබට ස්තුතියි!"
  }
};

// 🇱🇰 Sinhala Unicode detector
function containsSinhala(text) {
  return /[\u0D80-\u0DFF]/.test(text);
}

module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content || key.fromMe) return;

      // Extract message text
      const text =
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        "";

      if (!text.trim()) return;

      const msg = text.toLowerCase();
      const from = key.remoteJid;

      // Ignore commands with prefix
      if (msg.startsWith(config.PREFIX || ".")) return;

      // Match greetings
      let matchedType = null;
      for (const [type, triggers] of Object.entries(greetingsMap)) {
        if (triggers.some(trigger => msg.includes(trigger))) {
          matchedType = type;
          break;
        }
      }
      if (!matchedType) return;

      // 🧷 Send sticker
      const stickerUrl = greetingStickerUrls[matchedType];
      if (stickerUrl) {
        try {
          const response = await axios.get(stickerUrl, { responseType: 'arraybuffer' });
          const stickerBuffer = Buffer.from(response.data);
          await conn.sendMessage(from, { sticker: stickerBuffer }, { quoted: mek });
        } catch (e) {
          console.error("❌ Failed to fetch/send sticker:", e);
        }
      }

      // 🌐 Choose language (Sinhala / English)
      const lang = containsSinhala(msg) ? 'si' : 'en';
      const replyText = greetingTexts[matchedType][lang] || "👋 Hello!";

      // Send reply
      await conn.sendMessage(from, { text: replyText }, { quoted: mek });

    } catch (err) {
      console.error("❌ Auto-greetings plugin error:", err);
    }
  }
};
