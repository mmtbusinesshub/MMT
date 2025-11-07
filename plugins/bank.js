const channelJid = '120363423526129509@newsletter'; 
const channelName = 'ミ★ 𝙈𝙈𝙏 𝘽𝙐𝙎𝙄𝙉𝙀𝙎𝙎 𝙃𝙐𝘽 ★彡'; 
const serviceLogo = "https://github.com/mmtbusinesshub/MMT/blob/main/images/WhatsApp%20Image%202025-10-31%20at%2014.04.59_cae3e6bf.jpg?raw=true";

const pendingBankRequests = new Map();

const bankDetails = {
  'hnb': {
    name: 'HNB BANK TRANSFER',
    details: `HNB Bank - Nittambuwa Branch
Name: M I M IFLAJ 
Account Number: 250020285400`,
    emoji: '🎉'
  },
  'boc': {
    name: 'BOC BANK TRANSFER', 
    details: `BOC Bank - Nittambuwa Branch
Account Number: 0091759510
Name: Samsul nisa`,
    emoji: '🎉'
  },
  'hnb bank': {
    name: 'HNB BANK TRANSFER',
    details: `HNB Bank - Nittambuwa Branch
Name: M I M IFLAJ 
Account Number: 250020285400`,
    emoji: '🎉'
  },
  'boc bank': {
    name: 'BOC BANK TRANSFER',
    details: `BOC Bank - Nittambuwa Branch
Account Number: 0091759510
Name: Samsul nisa`,
    emoji: '🎉'
  }
};

const bankKeywords = [
  'bank', 'payment', 'transfer', 'deposit', 'account', 
  'details', 'payment details', 'bank details', 'send money',
  'pay', 'payment method', 'bank account', 'account number'
];

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
      const sender = key.participant || from;

      console.log("🏦 [MMT BANK] Message received:", msg);

      if (pendingBankRequests.has(sender)) {
        await handleBankReply(conn, mek, text, from, sender);
        return;
      }

      const isBankQuery = bankKeywords.some(keyword => msg.includes(keyword));
      
      if (!isBankQuery) return;

      try {
        await conn.sendMessage(from, {
          react: {
            text: "🏦",
            key: mek.key,
          }
        });
        console.log("🏦 [MMT BANK] Reacted to bank query");
      } catch (reactError) {
        console.log("⚠️ [MMT BANK] Could not react to message:", reactError.message);
      }

      const questionText = `🏦 *BANK DETAILS REQUEST*\n────────────────────\n\nPlease reply with which bank details you need:\n\n💳 *HNB Bank* - Type "HNB"\n💳 *BOC Bank* - Type "BOC"\n\nSimply reply with the bank name to get complete details.`;

      await conn.sendMessage(from, {
        image: { url: serviceLogo },
        caption: questionText,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelJid,
            newsletterName: channelName,
            serverMessageId: -1
          }
        }
      }, { quoted: mek });

      pendingBankRequests.set(sender, {
        timestamp: Date.now(),
        originalMessage: text
      });

      console.log(`🏦 [MMT BANK] Asked bank selection from ${sender}`);

      cleanupPendingRequests();

    } catch (err) {
      console.error("❌ [MMT BANK] Plugin error:", err);
    }
  },
};

async function handleBankReply(conn, mek, text, from, sender) {
  try {
    const userReply = text.toLowerCase().trim();
    
    pendingBankRequests.delete(sender);

    await conn.sendMessage(from, {
      react: {
        text: "✅",
        key: mek.key,
      }
    });

    let selectedBank = null;
    
    if (userReply.includes('hnb')) {
      selectedBank = bankDetails['hnb'];
    } else if (userReply.includes('boc')) {
      selectedBank = bankDetails['boc'];
    }

    if (selectedBank) {
      const bankMessage = `🏦 *PAYMENT DETAILS*\n────────────────────\n\n${selectedBank.emoji} *${selectedBank.name}*\n────────────────────\n${selectedBank.details}\n\n────────────────────\n💡 *Important:*\n• Always include your name in transfer description\n• Send payment confirmation to support\n• Contact for any payment issues\n\n📞 *Support:* wa.me/94759125207`;

      await conn.sendMessage(from, {
        image: { url: serviceLogo },
        caption: bankMessage,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelJid,
            newsletterName: channelName,
            serverMessageId: -1
          }
        }
      }, { quoted: mek });

      console.log(`🏦 [MMT BANK] Sent ${selectedBank.name} details to ${sender}`);

    } else {
      const errorMessage = `❌ *Invalid Bank Selection*\n────────────────────\n\nPlease choose one of the following:\n\n💳 *HNB Bank* - Reply "HNB"\n💳 *BOC Bank* - Reply "BOC"\n\nOr type "both" to get all bank details.`;

      await conn.sendMessage(from, {
        text: errorMessage
      }, { quoted: mek });

      pendingBankRequests.set(sender, {
        timestamp: Date.now(),
        originalMessage: text
      });
    }

  } catch (err) {
    console.error("❌ [MMT BANK] Reply handler error:", err);
    
    pendingBankRequests.delete(sender);
    
    await conn.sendMessage(from, {
      text: "❌ Sorry, there was an error processing your request. Please try again."
    }, { quoted: mek });
  }
}

function cleanupPendingRequests() {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  for (const [sender, data] of pendingBankRequests.entries()) {
    if (now - data.timestamp > fiveMinutes) {
      pendingBankRequests.delete(sender);
      console.log(`🧹 [MMT BANK] Cleaned up old request from ${sender}`);
    }
  }
}

setInterval(cleanupPendingRequests, 10 * 60 * 1000);
