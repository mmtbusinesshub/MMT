// plugins/ai.js - MMT BUSINESS HUB Auto Services Plugin
const axios = require("axios");

// Convert number to emoji
function numberToEmoji(num) {
  const emojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  return String(num)
    .split("")
    .map(d => emojis[parseInt(d)] || d)
    .join("");
}

// Normalize text for matching
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Find services by category keywords
function findCategoryServices(query, services) {
  if (!services || services.length === 0) return [];
  
  const q = normalize(query);
  const keywords = q.split(" ").filter(
    (w) => !["price", "service", "for", "the", "whats", "what", "is", "of", "a", "to", "and", "me", "need", "get", "want", "buy", "purchase"].includes(w)
  );

  if (keywords.length === 0) return [];

  return services.filter((s) => {
    const cat = normalize(s.category);
    const name = normalize(s.name);
    
    // Check both category and service name
    return keywords.some((k) => cat.includes(k) || name.includes(k));
  });
}

// WhatsApp message handler
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

      console.log("🤖 [MMT BUSINESS HUB] Auto-services triggered:", msg);

      // Check if message is related to services or pricing
      const serviceKeywords = ["price", "service", "cost", "buy", "purchase", "order", "rate", "charges", "facebook", "instagram", "youtube", "tiktok", "social media", "marketing", "followers", "likes", "views"];
      
      const isServiceQuery = serviceKeywords.some(keyword => msg.includes(keyword));
      
      if (!isServiceQuery) return;

      // Get services from cache
      let services;
      try {
        services = await global.mmtServices.getServices();
        
        if (!services || services.length === 0) {
          await conn.sendMessage(
            from,
            { 
              text: "⚠️ *Service Information Temporarily Unavailable*\n\nOur service catalog is currently being updated. Please try again in a few moments or visit our website directly:\n\n🌐 https://makemetrend.online/services\n\nThank you for your patience! 🙏" 
            },
            { quoted: mek }
          );
          return;
        }
        
        console.log(`📊 [MMT BUSINESS HUB] Using ${services.length} cached services for query`);
        
      } catch (error) {
        console.error("❌ [MMT BUSINESS HUB] Error getting services:", error.message);
        await conn.sendMessage(
          from,
          { 
            text: "❌ *Service Update in Progress*\n\nWe're currently refreshing our service database. Please try again shortly or contact us for immediate assistance.\n\n📞 *Contact Support:* wa.me/947xxxxxxxx" 
          },
          { quoted: mek }
        );
        return;
      }

      // Find matching services
      const matches = findCategoryServices(msg, services);

      if (matches.length === 0) {
        // Show popular services if no specific match found
        const popularServices = services
          .filter(s => 
            s.category.toLowerCase().includes("social") || 
            s.category.toLowerCase().includes("facebook") ||
            s.category.toLowerCase().includes("instagram") ||
            s.category.toLowerCase().includes("youtube") ||
            s.category.toLowerCase().includes("tiktok")
          )
          .slice(0, 8);

        if (popularServices.length > 0) {
          const popularList = popularServices
            .map((s, i) => `${numberToEmoji(i + 1)} *${s.category}* - ${s.name}\n   💰 ${s.price} | 📦 ${s.min}-${s.max}`)
            .join("\n\n");

          const reply = `🔍 *Service Not Found*\n\nI couldn't find exactly what you're looking for, but here are our popular social media services:\n\n${popularList}\n\n💡 *Tip:* Try searching for specific platforms like "Facebook", "Instagram", "YouTube" or "TikTok"\n\n🌐 View all services: https://makemetrend.online/services`;
          
          await conn.sendMessage(from, { text: reply }, { quoted: mek });
        } else {
          // Fallback to general service list
          const categories = [...new Set(services.map(s => s.category))].slice(0, 6);
          const categoryList = categories
            .map((cat, i) => `${numberToEmoji(i + 1)} ${cat}`)
            .join("\n");

          const reply = `🔍 *Service Categories*\n\nI couldn't find that specific service. Here are our main categories:\n\n${categoryList}\n\n💡 *Try:* ".services facebook" or ".services instagram"\n\n🌐 Browse all: https://makemetrend.online/services`;
          
          await conn.sendMessage(from, { text: reply }, { quoted: mek });
        }
        return;
      }

      // Group matches by category
      const matchesByCategory = {};
      matches.forEach(service => {
        if (!matchesByCategory[service.category]) {
          matchesByCategory[service.category] = [];
        }
        matchesByCategory[service.category].push(service);
      });

      // Create response message
      let messageText = `🎯 *Found ${matches.length} Services Matching Your Query*\n\n`;

      Object.entries(matchesByCategory).forEach(([category, categoryServices], categoryIndex) => {
        messageText += `📁 *${category}*\n\n`;
        
        categoryServices.forEach((service, serviceIndex) => {
          const globalIndex = categoryIndex * categoryServices.length + serviceIndex + 1;
          messageText += `${numberToEmoji(globalIndex)} *${service.name}*\n`;
          messageText += `   💰 Price: ${service.price}\n`;
          messageText += `   📊 Min: ${service.min} | Max: ${service.max}\n`;
          messageText += `   🔗 [Buy Now](${service.link})\n\n`;
        });
      });

      messageText += `💼 *Need Help Choosing?*\nWe can help you select the best service for your needs!\n\n📞 *Contact:* wa.me/947xxxxxxxx\n🌐 *Website:* https://makemetrend.online`;

      await conn.sendMessage(from, { 
        text: messageText, 
        linkPreview: false 
      }, { quoted: mek });

      console.log(`✅ [MMT BUSINESS HUB] Sent ${matches.length} service matches to ${from}`);

    } catch (err) {
      console.error("❌ [MMT BUSINESS HUB] Auto-services plugin error:", err);
      
      // Send error message to user
      try {
        await conn.sendMessage(
          from,
          { 
            text: "❌ *Service Error*\n\nWe're experiencing technical difficulties. Please try again in a few moments or contact support directly.\n\n📞 *Support:* wa.me/947xxxxxxxx\n🌐 *Website:* https://makemetrend.online" 
          },
          { quoted: mek }
        );
      } catch (sendError) {
        console.error("❌ [MMT BUSINESS HUB] Failed to send error message:", sendError);
      }
    }
  },
};
