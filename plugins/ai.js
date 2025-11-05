// plugins/auto-services-buttons.js
const axios = require("axios");
const cheerio = require("cheerio");
const translate = require("@vitalets/google-translate-api");

// 🧠 Cache
let cache = null;
let lastFetch = 0;
const CACHE_TIME = 5 * 60 * 1000;
const MAX_RESULTS = 5;

// 🧩 Headers
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://google.com/",
  "Upgrade-Insecure-Requests": "1",
};

// Fetch with retry
async function fetchWithRetry(url, retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { timeout: 120000, headers: HEADERS, validateStatus: s => s < 500 });
      if (res.status === 200 && res.data) return res.data;
    } catch {}
    if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
  }
  throw new Error("Server unavailable after 5 retries.");
}

// Fetch services
async function fetchServices() {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TIME) return cache;

  const html = await fetchWithRetry("https://makemetrend.online/services");
  const $ = cheerio.load(html);
  const services = [];
  let currentCategory = null;

  $("tr").each((_, el) => {
    const row = $(el);
    if (row.hasClass("catetitle")) {
      currentCategory = row.find("strong.si-title").text().trim();
      return;
    }
    if (!currentCategory) return;
    const name = row.find('td[data-label="Service"]').text().trim();
    const price = row.find("strong").text().trim();
    const min = row.find("td").eq(3).text().trim();
    const max = row.find("td").eq(4).text().trim();
    const link = row.find("a#buyNow").attr("href") || "https://makemetrend.online/services";
    if (name && price) services.push({ category: currentCategory, name, price, min, max, link });
  });

  cache = services;
  lastFetch = now;
  return services;
}

// Normalize
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Find category
function findCategoryServices(query, services) {
  const q = normalize(query);
  const keywords = q.split(" ").filter(w => !["price","service","for","the","whats","what","is","of","a","to","and","me","need"].includes(w));
  if (!keywords.length) return [];
  return services.filter(s => keywords.every(k => normalize(s.category).includes(k)));
}

// Number to emoji
function numberToEmoji(num) {
  const emojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  return String(num).split("").map(d => emojis[parseInt(d)] || d).join("");
}

// Safe translation
async function safeTranslate(text, target="en") {
  try {
    const res = await translate(text, { to: target });
    if (!res || !res.from || !res.from.language || !res.from.language.iso) throw new Error("Invalid response");
    return { text: res.text, from: res.from.language.iso };
  } catch { return { text, from: "en" }; }
}

// Build buttons message
function buildButtonMessage(categoryName, servicesSlice, startIndex = 0, total = 0) {
  const buttons = servicesSlice.map((s, i) => ({
    buttonId: `SERVICE_${startIndex + i}`,
    buttonText: { displayText: `${numberToEmoji(i+1)} ${s.name}` },
    type: 1
  }));

  // navigation
  if (startIndex + MAX_RESULTS < total) buttons.push({ buttonId: `NEXT_${startIndex + MAX_RESULTS}`, buttonText: { displayText: "➡️ Next" }, type: 1 });
  if (startIndex > 0) buttons.push({ buttonId: `PREV_${startIndex - MAX_RESULTS}`, buttonText: { displayText: "⬅️ Previous" }, type: 1 });

  return { text: `💼 ${categoryName}\n\nSelect a service:`, buttons, headerType: 1 };
}

// Handle button actions
async function handleButton(conn, buttonId, from, matches, userLang) {
  if (buttonId.startsWith("SERVICE_")) {
    const idx = parseInt(buttonId.split("_")[1]);
    const s = matches[idx];
    if (!s) return;

    let msg = `*${s.name}*\n💰 Price: ${s.price}\n📦 Min: ${s.min} | 📈 Max: ${s.max}\n🛒 [Buy Now](${s.link})`;
    if (userLang !== "en") msg = (await safeTranslate(msg, userLang)).text;

    await conn.sendMessage(from, { text: msg, linkPreview: false });
  }

  if (buttonId.startsWith("NEXT_") || buttonId.startsWith("PREV_")) {
    const startIndex = parseInt(buttonId.split("_")[1]);
    const slice = matches.slice(startIndex, startIndex + MAX_RESULTS);
    const msg = buildButtonMessage(slice[0].category, slice, startIndex, matches.length);
    if (userLang !== "en") msg.text = (await safeTranslate(msg.text, userLang)).text;
    await conn.sendMessage(from, msg);
  }
}

// Main plugin
module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content) return;

      // Handle normal messages
      if (content.conversation || content.extendedTextMessage?.text) {
        const text = content.conversation || content.extendedTextMessage?.text;
        if (!text.trim() || key.fromMe) return;
        const from = key.remoteJid;

        const { text: translatedMsg, from: userLang } = await safeTranslate(text, "en");

        if (!translatedMsg.includes("price") && !translatedMsg.includes("service")) return;

        let services;
        try { services = await fetchServices(); } catch { await conn.sendMessage(from, { text: "⚠️ Site busy, try later." }, { quoted: mek }); return; }

        const matches = findCategoryServices(translatedMsg, services);
        if (!matches.length) {
          await conn.sendMessage(from, { text: "⚠️ No services found. View all: https://makemetrend.online/services" }, { quoted: mek });
          return;
        }

        // send first page
        const startIndex = 0;
        const slice = matches.slice(startIndex, startIndex + MAX_RESULTS);
        const buttonMsg = buildButtonMessage(slice[0].category, slice, startIndex, matches.length);
        if (userLang !== "en") buttonMsg.text = (await safeTranslate(buttonMsg.text, userLang)).text;

        await conn.sendMessage(from, buttonMsg, { quoted: mek });

        // save user session for button navigation
        conn.serviceSessions = conn.serviceSessions || {};
        conn.serviceSessions[from] = { matches, userLang };
      }

      // Handle button clicks
      if (content.buttonsResponseMessage) {
        const from = key.remoteJid;
        const session = conn.serviceSessions?.[from];
        if (!session) return;
        const { matches, userLang } = session;
        await handleButton(conn, content.buttonsResponseMessage.selectedButtonId, from, matches, userLang);
      }

    } catch (err) { console.error("❌ auto-services plugin error:", err); }
  }
};
