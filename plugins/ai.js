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

// Extract price range from message
function extractPriceRange(message) {
  const priceRegex = /(\d+)\s*\$?\s*-\s*\$?\s*(\d+)\s*\$/i;
  const singlePriceRegex = /(\d+)\s*\$/gi;
  const matches = [];
  
  // Check for range like "1$ - 2$"
  const rangeMatch = message.match(priceRegex);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1]),
      max: parseInt(rangeMatch[2]),
      type: 'range'
    };
  }
  
  // Check for single prices
  let singleMatch;
  const prices = [];
  while ((singleMatch = singlePriceRegex.exec(message)) !== null) {
    prices.push(parseInt(singleMatch[1]));
  }
  
  if (prices.length >= 2) {
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      type: 'multiple'
    };
  } else if (prices.length === 1) {
    return {
      min: prices[0],
      max: prices[0] + 10, // Add buffer for single price
      type: 'single'
    };
  }
  
  return null;
}

// Extract numeric price from service price string
function extractNumericPrice(priceStr) {
  const match = priceStr.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

// Filter services by platform and type
function filterServicesByPlatform(services, platform, serviceType = 'likes') {
  const platformLower = platform.toLowerCase();
  const typeLower = serviceType.toLowerCase();
  
  return services.filter(service => {
    const serviceName = normalize(service.name);
    const serviceCategory = normalize(service.category);
    
    // Check if service matches platform and type
    const matchesPlatform = serviceName.includes(platformLower) || 
                           serviceCategory.includes(platformLower);
    
    const matchesType = serviceName.includes(typeLower) || 
                       serviceCategory.includes(typeLower) ||
                       serviceName.includes('follower') || // Include followers if likes not found
                       serviceCategory.includes('follower');
    
    return matchesPlatform && matchesType;
  });
}

// Filter services by price range
function filterServicesByPrice(services, priceRange) {
  return services.filter(service => {
    const servicePrice = extractNumericPrice(service.price);
    return servicePrice >= priceRange.min && servicePrice <= priceRange.max;
  });
}

// Sort services by price
function sortServicesByPrice(services, ascending = true) {
  return services.sort((a, b) => {
    const priceA = extractNumericPrice(a.price);
    const priceB = extractNumericPrice(b.price);
    return ascending ? priceA - priceB : priceB - priceA;
  });
}

// Get top services - lowest 3 and highest 2
function getTopServices(services) {
  if (services.length <= 5) return services;
  
  const sorted = sortServicesByPrice(services, true);
  const lowest = sorted.slice(0, 3);
  const highest = sorted.slice(-2);
  
  return [...lowest, ...highest];
}

// Find matching services with intelligent filtering
function findMatchingServices(query, services) {
  if (!services || services.length === 0) return [];
  
  const normalizedQuery = normalize(query);
  
  // Extract platform keywords
  const platforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'telegram', 'twitter'];
  const serviceTypes = ['likes', 'followers', 'views', 'comments', 'shares'];
  
  let targetPlatform = null;
  let targetServiceType = 'likes'; // Default to likes
  
  // Detect platform
  for (const platform of platforms) {
    if (normalizedQuery.includes(platform)) {
      targetPlatform = platform;
      break;
    }
  }
  
  // Detect service type
  for (const type of serviceTypes) {
    if (normalizedQuery.includes(type)) {
      targetServiceType = type;
      break;
    }
  }
  
  // Extract price range
  const priceRange = extractPriceRange(query);
  
  let filteredServices = services;
  
  // Filter by platform if specified
  if (targetPlatform) {
    filteredServices = filterServicesByPlatform(filteredServices, targetPlatform, targetServiceType);
  }
  
  // Filter by price range if specified
  if (priceRange) {
    filteredServices = filterServicesByPrice(filteredServices, priceRange);
  } else if (targetPlatform) {
    // If no price range specified but platform specified, get top services
    filteredServices = getTopServices(filteredServices);
  }
  
  return filteredServices;
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
      const serviceKeywords = ["price", "service", "cost", "buy", "purchase", "order", "rate", "charges", "facebook", "instagram", "youtube", "tiktok", "social media", "marketing", "followers", "likes", "views", "comments", "shares"];
      
      const isServiceQuery = serviceKeywords.some(keyword => msg.includes(keyword));
      
      if (!isServiceQuery) return;

      // React with red heart to the message
      try {
        await conn.sendMessage(from, {
          react: {
            text: "❤️", // Red heart emoji
            key: mek.key,
          }
        });
        console.log("❤️ [MMT BUSINESS HUB] Reacted to user message");
      } catch (reactError) {
        console.log("⚠️ [MMT BUSINESS HUB] Could not react to message:", reactError.message);
      }

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

      // Find matching services with intelligent filtering
      const matches = findMatchingServices(text, services);

      if (matches.length === 0) {
        // Show platform-specific suggestions if no matches found
        const platforms = ['instagram', 'facebook', 'tiktok', 'youtube'];
        const detectedPlatform = platforms.find(platform => msg.includes(platform));
        
        if (detectedPlatform) {
          const platformServices = filterServicesByPlatform(services, detectedPlatform, 'likes');
          const topPlatformServices = getTopServices(platformServices).slice(0, 5);
          
          if (topPlatformServices.length > 0) {
            const serviceList = topPlatformServices
              .map((service, i) => `${numberToEmoji(i + 1)} *${service.name}*\n   💰 ${service.price} | 📦 ${service.min}-${service.max}`)
              .join("\n\n");

            const reply = `🔍 *${detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)} Services*\n\nHere are our popular ${detectedPlatform} services:\n\n${serviceList}\n\n💡 *Need specific pricing?* Try: "${detectedPlatform} likes 1$-5$"\n\n🌐 View all: https://makemetrend.online/services`;
            
            await conn.sendMessage(from, { text: reply }, { quoted: mek });
          } else {
            await conn.sendMessage(
              from,
              { 
                text: `🔍 *Service Not Found*\n\nWe don't have specific ${detectedPlatform} services at the moment. Please check our website for all available services:\n\n🌐 https://makemetrend.online/services\n\nOr contact us for custom solutions! 📞` 
              },
              { quoted: mek }
            );
          }
        } else {
          // General fallback
          const popularServices = services
            .filter(s => 
              s.category.toLowerCase().includes("social") || 
              s.category.toLowerCase().includes("facebook") ||
              s.category.toLowerCase().includes("instagram") ||
              s.category.toLowerCase().includes("youtube") ||
              s.category.toLowerCase().includes("tiktok")
            )
            .slice(0, 6);

          if (popularServices.length > 0) {
            const popularList = popularServices
              .map((s, i) => `${numberToEmoji(i + 1)} *${s.category}* - ${s.name}\n   💰 ${s.price} | 📦 ${s.min}-${s.max}`)
              .join("\n\n");

            const reply = `🔍 *Popular Social Media Services*\n\nHere are our most popular services:\n\n${popularList}\n\n💡 *Tip:* Specify platform and budget like "instagram likes 1$-5$" for better results!\n\n🌐 View all: https://makemetrend.online/services`;
            
            await conn.sendMessage(from, { text: reply }, { quoted: mek });
          } else {
            await conn.sendMessage(
              from,
              { 
                text: "🔍 *Service Catalog*\n\nPlease specify what you're looking for:\n• Instagram likes\n• Facebook followers\n• TikTok views\n• YouTube comments\n\nOr visit: 🌐 https://makemetrend.online/services" 
              },
              { quoted: mek }
            );
          }
        }
        return;
      }

      // Create response message based on filter type
      const priceRange = extractPriceRange(text);
      const platforms = ['instagram', 'facebook', 'tiktok', 'youtube'];
      const detectedPlatform = platforms.find(platform => msg.includes(platform));
      
      let messageText = "";
      
      if (priceRange) {
        messageText = `🎯 *Services in Your Budget (${priceRange.min}$ - ${priceRange.max}$)*\n\n`;
        if (detectedPlatform) {
          messageText = `🎯 *${detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)} Services in Your Budget (${priceRange.min}$ - ${priceRange.max}$)*\n\n`;
        }
      } else if (detectedPlatform) {
        messageText = `🎯 *Best ${detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)} Services*\n\n*Showing: 3 lowest priced + 2 premium services*\n\n`;
      } else {
        messageText = `🎯 *Matching Services Found*\n\n`;
      }

      // Group matches by category
      const matchesByCategory = {};
      matches.forEach(service => {
        if (!matchesByCategory[service.category]) {
          matchesByCategory[service.category] = [];
        }
        matchesByCategory[service.category].push(service);
      });

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

      // Add helpful tips
      if (priceRange && matches.length > 0) {
        messageText += `💡 *Found ${matches.length} services in your budget!*\n`;
      } else if (detectedPlatform && !priceRange) {
        messageText += `💡 *Pro Tip:* Specify your budget like "${detectedPlatform} likes 1$-5$" for exact pricing!\n\n`;
      }
      
      messageText += `\n📞 *Need Help?* Contact us: wa.me/947xxxxxxxx\n🌐 *Website:* https://makemetrend.online`;

      await conn.sendMessage(from, { 
        text: messageText, 
        linkPreview: false 
      }, { quoted: mek });

      console.log(`✅ [MMT BUSINESS HUB] Sent ${matches.length} filtered service matches to ${from}`);

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
