const fs = require("fs");
const path = require("path");
const config = require("../config.js");

const channelJid = '120363423526129509@newsletter'; 
const channelName = 'ミ★ 𝙈𝙈𝙏 𝘽𝙐𝙎𝙄𝙉𝙀𝙎𝙎 𝙃𝙐𝘽 ★彡'; 
const serviceLogo = "https://github.com/mmtbusinesshub/MMT/blob/main/images/download.png?raw=true";

const pendingBroadcast = new Map();

module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content) return;

      const text =
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        "";

      if (!text.trim()) return;

      const msg = text.trim();
      const from = key.remoteJid;
      const sender = key.participant || from;

      const ownerNumber = config.BOT_OWNER.includes("@s.whatsapp.net")
        ? config.BOT_OWNER
        : `${config.BOT_OWNER}@s.whatsapp.net`;

      // 🧠 Only respond if message is from the bot owner number
      if (sender !== ownerNumber && from !== ownerNumber) return;

      console.log("📢 [MMT BROADCAST] Message received from owner:", msg);

      // ✅ Step 1: Detect "bulk" command
      if (msg.toLowerCase() === "bulk") {
        pendingBroadcast.set(sender, { step: "awaiting_message" });

        const instructionText = `📢 *BROADCAST MODE ACTIVATED*\n────────────────────\n✅ Please send the message you want to send to your contact list.\n\n💡 You can use *{name}* in your message to personalize each message.\n────────────────────\n📂 contacts.csv must be in the /data folder.\n────────────────────`;

        await conn.sendMessage(from, {
          image: { url: serviceLogo },
          caption: instructionText,
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: channelJid,
              newsletterName: channelName,
              serverMessageId: -1,
            },
          },
        }, { quoted: mek });

        console.log("📢 [MMT BROADCAST] Waiting for broadcast message...");
        return;
      }

      // ✅ Step 2: Handle the broadcast message
      if (pendingBroadcast.has(sender)) {
        const { step } = pendingBroadcast.get(sender);

        if (step === "awaiting_message") {
          pendingBroadcast.delete(sender);

          const csvPath = path.join(__dirname, "../data/contacts.csv");

          if (!fs.existsSync(csvPath)) {
            await conn.sendMessage(from, {
              text: "❌ *Error:* contacts.csv not found in /data folder.",
            }, { quoted: mek });
            return;
          }

          const csvData = fs.readFileSync(csvPath, "utf8").trim();
          const separator = csvData.includes("\t") ? "\t" : ",";
          const lines = csvData.split(/\r?\n/);
          const contacts = [];

          for (let i = 1; i < lines.length; i++) {
            const [name, phone] = lines[i].split(separator).map((v) => v.trim());
            if (phone && /^\d+$/.test(phone)) {
              contacts.push({ name: name || "Customer", phone });
            }
          }

          if (contacts.length === 0) {
            await conn.sendMessage(from, {
              text: "⚠️ *No valid contacts found* in contacts.csv.",
            }, { quoted: mek });
            return;
          }

          await conn.sendMessage(from, {
            text: `🚀 Sending your message to *${contacts.length}* contacts...`,
          }, { quoted: mek });

          let success = 0;
          for (const { name, phone } of contacts) {
            try {
              const jid = `${phone}@s.whatsapp.net`;
              const personalized = msg.replace(/{name}/gi, name);

              await conn.sendMessage(jid, {
                text: personalized,
              });
              success++;
              await new Promise((r) => setTimeout(r, 500)); // delay between messages
            } catch (err) {
              console.log(`❌ [MMT BROADCAST] Failed to send to ${phone}:`, err.message);
            }
          }

          const summaryText = `✅ *BROADCAST COMPLETED*\n────────────────────\n📬 Successfully sent to *${success}* of *${contacts.length}* contacts.\n────────────────────`;

          await conn.sendMessage(from, {
            image: { url: serviceLogo },
            caption: summaryText,
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: channelJid,
                newsletterName: channelName,
                serverMessageId: -1,
              },
            },
          }, { quoted: mek });

          console.log(`📢 [MMT BROADCAST] Sent to ${success}/${contacts.length} contacts.`);
        }
      }
    } catch (err) {
      console.error("❌ [MMT BROADCAST] Plugin error:", err);
      await conn.sendMessage(mek.key.remoteJid, {
        text: "❌ *An error occurred while processing your broadcast request.*",
      }, { quoted: mek });
    }
  },
};
