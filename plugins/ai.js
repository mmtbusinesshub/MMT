const axios = require("axios");
const cheerio = require("cheerio"); // npm install cheerio
const config = require("../config");

let cache = null;
let lastFetch = 0;
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes cache

// 🧩 Function to fetch and parse services
async function fetchServices() {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TIME) return cache;

  const { data } = await axios.get("https://makemetrend.online/services");
  const $ = cheerio.load(data);

  const services = [];

  $("tr[data-filter-table-category-id]").each((_, el) => {
    const name = $(el).find('td[data-label="Service"]').text().trim();
    const price = $(el).find("strong").text().trim();
    const min = $(el).find("td").eq(3).text().trim();
    const max = $(el).find("td").eq(4).text().trim();
    const link = $(el).find("a#buyNow").attr("href") || "https://makemetrend.online/services";

    if (name && price) {
      services.push({ name, price, min, max, link });
    }
  });

  cache = services;
  lastFetch = now;
  return services;
}

// 🔍 Find the best matching service by name
function findService(query, services) {
  query = query.toLowerCase();
  return services.find((s) => s.name.toLowerCase().includes(query));
}

module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content || key.fromMe) return;

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

      // Only trigger for service/price queries
      if (!msg.includes("price") && !msg.includes("service")) return;

      const services = await fetchServices();
      const match = findService(msg, services);

      if (!match) {
        const list = services
          .slice(0, 5)
          .map((s) => `• ${s.name} (${s.price})`)
          .join("\n");
        const reply = `❌ Sorry, I couldn't find that service.\n\nHere are a few examples:\n${list}\n\nView all services 👇\nhttps://makemetrend.online/services`;
        await conn.sendMessage(from, { text: reply }, { quoted: mek });
        return;
      }

      const reply = `💼 *${match.name}*\n💰 *Price per 1000:* ${match.price}\n📦 *Min Order:* ${match.min}\n📈 *Max Order:* ${match.max}\n🛒 [Buy Now](${match.link})`;
      await conn.sendMessage(from, { text: reply }, { quoted: mek });
    } catch (err) {
      console.error("❌ auto-services plugin error:", err);
    }
  },
};
