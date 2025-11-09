const fs = require("fs");
const path = require("path");
const { cmd } = require("../command");
const { sleep } = require("../lib/functions");
const config = require("../config");

const pendingBroadcast = {}; // track owners who need to send broadcast message

// Step 1: Owner sends .bulk optionally with message
cmd({
  pattern: "bulk",
  react: "📢",
  desc: "Broadcast a message to all saved contacts (Owner Only)",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { reply, sender, args }) => {
  const ownerJid = config.BOT_OWNER + "@s.whatsapp.net";
  if (sender !== ownerJid) return reply("❌ This command is only for the bot owner.");

  if (!args.length) {
    pendingBroadcast[sender] = true;
    return reply("⚠️ Please send the message you want to broadcast.");
  }

  const message = args.join(" ").trim();
  await broadcastMessage(conn, message, reply);
});

// Step 2: Owner replies with message after empty .bulk
cmd({
  filter: (text, { sender }) => pendingBroadcast[sender],
}, async (conn, mek, m, { reply, sender, body }) => {
  const message = body.trim();
  if (!message) return reply("⚠️ Broadcast message cannot be empty.");

  delete pendingBroadcast[sender]; // clear pending state

  await broadcastMessage(conn, message, reply);
});

// Broadcast function
async function broadcastMessage(conn, message, reply) {
  try {
    const csvPath = path.join(__dirname, "../data/contacts.csv");
    if (!fs.existsSync(csvPath)) return reply("❌ contacts.csv file not found in /data folder.");

    const csvData = fs.readFileSync(csvPath, "utf8");
    const rows = csvData.split("\n").slice(1);
    const contacts = rows
      .map(line => line.trim().split(",")[1])
      .filter(num => num && num.match(/^\d+$/));

    if (!contacts.length) return reply("⚠️ No valid contacts found in contacts.csv.");

    await reply(`📢 Starting broadcast to *${contacts.length}* contacts...`);

    for (let i = 0; i < contacts.length; i++) {
      const jid = contacts[i] + "@s.whatsapp.net";
      await conn.sendMessage(jid, { text: message });
      console.log(`✅ Sent to ${contacts[i]}`);
      await sleep(1200);
    }

    await reply("✅ Broadcast complete!");
  } catch (e) {
    console.error("Bulk broadcast error:", e);
    reply("❌ Failed to broadcast message:\n" + e);
  }
}
