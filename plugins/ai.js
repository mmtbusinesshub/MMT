// plugins/auto-services.js
const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../config");

// 🧠 Simple in-memory cache
let cache = null;
let lastFetch = 0;
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

// 🧩 Browser-like headers to avoid blocking
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://google.com/",
  "Upgrade-Insecure-Requests": "1",
};

// 🧩 Fetch HTML with retry + long timeout
async function fetchWithRetry(url, retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🌐 Fetch attempt ${i + 1}/${retries}: ${url}`);

      const res = await axios.get(url, {
        timeout: 120000, // ⏱️ 2 minutes
        headers: HEADERS,
        validateStatus: (status) => status < 500, // retry on 5xx
      });

      if (res.status === 200 && res.data) {
        console.log("✅ Successfully fetched services page.");
        return res.data;
      } else {
        console.warn(`⚠️ Got status ${res.status}, retrying...`);
      }
    } catch (err) {
      console.warn(`❌ Attempt ${i + 1} failed: ${err.message}`);
    }

    if (i < retries - 1) {
      console.log(`⏳ Waiting ${delay / 1000}s before retry...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Server unavailable after 5 retries.");
}

// 🧠 Fetch and parse services page
async function fetchServices() {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TIME) return cache;

  console.log("🔍 Fetching latest services from makemetrend.online...");
  const html = await fetchWithRetry("https://makemetrend.online/services");
  const $ = cheerio.load(html);

  const services = [];

  $("tr[data-filter-table-category-id]").each((_, el) => {
    const name = $(el).find('td[data-label="Service"]').text().trim();
    const price = $(el).find("strong").text().trim();
    const min = $(el).find("td").eq(3).text().trim();
    const max = $(el).find("td").eq(4).text().trim();
    const link =
      $(el).find("a#buyNow").attr("href") ||
      "https://makemetrend.online/services";
    if (name && price) {
      services.push({ name, price, min, max, link });
    }
  });

  if (services.length === 0)
    throw new Error("No services found — check HTML structure or site status.");

  cache = services;
  lastFetch = now;
  console.log(`✅ Parsed ${services.length} services.`);
  return services;
}

// 🔍 Find service matching user query
function findService(query, services) {
  query = query.toLowerCase();
  return services.find((s) => s.name.toLowerCase().includes(query));
}

// 🧩 WhatsApp message handler
module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content || key.fromMe) return;

      // extract text message
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

      console.log("📩 Received message:", msg);

      // ✅ Always reply once to confirm plugin works
      await conn.sendMessage(
        from,
        { text: "✅ Auto-services plugin loaded! Message received." },
        { quoted: mek }
      );

      // only continue if user asked about price/service
      if (!msg.includes("price") && !msg.includes("service")) return;

      // 🧠 fetch services list
      let services;
      try {
        services = await fetchServices();
      } catch (err) {
        console.error("⚠️ Fetch error:", err.message);
        await conn.sendMessage(
          from,
          { text: "⚠️ The service site is currently busy. Try again later." },
          { quoted: mek }
        );
        return;
      }

      // 🔍 find matching service
      const match = findService(msg, services);

      if (!match) {
        const list = services
          .slice(0, 5)
          .map((s) => `• ${s.name} (${s.price})`)
          .join("\n");
        const reply = `⚠️ Sorry, I couldn't find that service.\n\nHere are a few examples:\n${list}\n\nView all services:\nhttps://makemetrend.online/services`;
        await conn.sendMessage(from, { text: reply }, { quoted: mek });
        return;
      }

      // 💬 reply with found service details
      const reply = `💼 *${match.name}*\n💰 *Price per 1000:* ${match.price}\n📦 *Min Order:* ${match.min}\n📈 *Max Order:* ${match.max}\n🛒 [Buy Now](${match.link})`;
      await conn.sendMessage(from, { text: reply }, { quoted: mek });
    } catch (err) {
      console.error("❌ auto-services plugin error:", err);
    }
  },
};
