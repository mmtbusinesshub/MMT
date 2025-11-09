const fs = require("fs");
const path = require("path");
const config = require("../config.js");

const pendingBroadcast = new Map();

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

      const msg = text.trim();
      const from = key.remoteJid;
      const sender = key.participant || from;

      // 🧠 Only bot owner can use broadcast
      const ownerNumber = config.BOT_OWNER.includes("@s.whatsapp.net")
        ? config.BOT_OWNER
        : `${config.BOT_OWNER}@s.whatsapp.net`;
      if (sender !== ownerNumber) return;

      // ✅ Step 1: Trigger broadcast mode
      if (msg.toLowerCase() === "bulk") {
        pendingBroadcast.set(sender, { step: "awaiting_message" });

        await conn.sendMessage(from, {
          text: "📢 *Broadcast Mode Activated!*\n\nPlease send the message you want to send to your contact list.\n\n💡 You can use `{name}` in your message to personalize it for each contact.",
        });
        console.log(`[BROADCAST] Owner initiated broadcast mode.`);
        return;
      }

      // ✅ Step 2: Check if awaiting broadcast message
      if (pendingBroadcast.has(sender)) {
        const { step } = pendingBroadcast.get(sender);
        if (step === "awaiting_message") {
          pendingBroadcast.delete(sender);

          // 🧾 Load contacts from data/contacts.csv
          const csvPath = path.join(__dirname, "../data/contacts.csv");
          if (!fs.existsSync(csvPath)) {
            await conn.sendMessage(from, {
              text: "❌ *Error:* contacts.csv file not found in /data folder.",
            });
            return;
          }

          // Read file
          const csvData = fs.readFileSync(csvPath, "utf-8");

          // Detect separator (tab or comma)
          const separator = csvData.includes("\t") ? "\t" : ",";

          const lines = csvData.trim().split(/\r?\n/);
          const contacts = [];

          for (let i = 1; i < lines.length; i++) {
            const [name, phone] = lines[i].split(separator).map((v) => v.trim());
            if (!phone || !/^\d+$/.test(phone)) continue;
            contacts.push({ name: name || "Customer", phone });
          }

          if (contacts.length === 0) {
            await conn.sendMessage(from, {
              text: "⚠️ No valid contacts found in contacts.csv file.",
            });
            return;
          }

          // ✅ Broadcast message to all contacts
          await conn.sendMessage(from, {
            text: `🚀 Sending your message to *${contacts.length}* contacts...`,
          });

          let success = 0;
          for (const { name, phone } of contacts) {
            try {
              const jid = `${phone}@s.whatsapp.net`;
              const personalizedMsg = msg.replace(/{name}/gi, name);

              await conn.sendMessage(jid, { text: personalizedMsg });
              success++;
              await new Promise((r) => setTimeout(r, 500)); // Delay between sends
            } catch (err) {
              console.error(`❌ Failed to send to ${phone}:`, err.message);
            }
          }

          await conn.sendMessage(from, {
            text: `✅ Broadcast completed!\n\n📬 Successfully sent to *${success}* of *${contacts.length}* contacts.`,
          });

          console.log(`[BROADCAST] Sent to ${success}/${contacts.length} contacts.`);
        }
      }
    } catch (err) {
      console.error("❌ [BROADCAST] Plugin error:", err);
    }
  },
};
