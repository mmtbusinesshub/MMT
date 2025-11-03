const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  proto,
  generateWAMessageContent,
  generateWAMessage,
  AnyMessageContent,
  prepareWAMessageMedia,
  areJidsSameUser,
  downloadContentFromMessage,
  MessageRetryMap,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  generateMessageID, makeInMemoryStore,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const config = require('./config');
const { ownerNumber } = require('./config');
const { BOT_OWNER } = require('./config');
const util = require('util');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const { sms } = require('./lib/msg');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { File } = require('megajs');
const express = require("express");

const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
  if (!config.SESSION_ID) return console.log('❗ [DILSHAN-MD] SESSION_ID not found in env. Please configure it.');
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
      console.log("📥 [DILSHAN-MD] Session file downloaded and saved.");
    });
  });
}

const { replyHandlers, commands } = require('./command');
const antiDeletePlugin = require('./plugins/antidelete.js');
global.pluginHooks = global.pluginHooks || [];
global.pluginHooks.push(antiDeletePlugin);
const antiViewOncePlugin = require('./plugins/antiviewonce.js');
global.pluginHooks.push(antiViewOncePlugin);
const autoGreetingsPlugin = require('./plugins/ai.js');
global.pluginHooks.push(autoGreetingsPlugin);

async function connectToWA() {
  console.log("🛰️ [DILSHAN-MD] Initializing WhatsApp connection...");
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
  const { version } = await fetchLatestBaileysVersion();
  
  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    syncFullHistory: true,
    auth: state,
    version
  });
  conn.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const m = messages[0];
    if (!m.message) return;

    const buttonResponse = m.message.buttonsResponseMessage;
    if (buttonResponse) {
    const selectedId = buttonResponse.selectedButtonId;

    if (selectedId === 'btn_1') {
      await conn.sendMessage(m.key.remoteJid, { text: 'You pressed Button 1!' }, { quoted: m });
    } else if (selectedId === 'btn_2') {
      await conn.sendMessage(m.key.remoteJid, { text: 'You pressed Button 2!' }, { quoted: m });
    }
  }
  });

  conn.ev.on('group-participants.update', async (update) => {
    console.log("📥 New Group Update:", update.id); // group JID will be printed
  });
  conn.ev.on('group-participants.update', async (update) => {
    try {
      const { id: groupId, participants, action } = update;
      const metadata = await conn.groupMetadata(groupId);
      const groupName = metadata.subject || 'this group';

      if (action === 'add') {
        for (const userId of participants) {
          if (global.antiFakeGroups?.[groupId]) {
            const number = userId.split('@')[0];
            if (!number.startsWith("94")) { // Block users not starting with +94 (Sri Lanka)
              await conn.sendMessage(groupId, {
                text: `📵 @${number} removed — only Sri Lankan numbers allowed.`,
                mentions: [userId]
              });
              await conn.groupParticipantsUpdate(groupId, [userId], "remove");
              continue;
            }
          }
          const number = userId.split('@')[0];
          const message = `
🌟 Hey @${number}, welcome to *${groupName}*! 🥳

We’re super happy to have you join us.  

📌 Take a moment to check out the group rules so everyone has a great experience.  
💬 Feel free to introduce yourself and say hi to everyone!  

✨ Together, let’s create a fun, supportive, and respectful community. 💖
`;

          await conn.sendMessage(groupId, {
            image: { url: 'https://github.com/dilshan62/DILSHAN-MD/blob/main/images/WELCOME_DILSHAN_MD.jpg?raw=true' },
            caption: message,
            mentions: [userId]
          });
        }
      }

      if (action === 'remove') {
        for (const userId of participants) {
          const number = userId.split('@')[0];
          const message = `
👋 Hey @${number}, we’ll miss you! 💔

Thank you for being part of *${groupName}*.  
✨ Wishing you happiness and all the best in everything you do! 💖
`;

          await conn.sendMessage(groupId, {
            image: { url: 'https://github.com/dilshan62/DILSHAN-MD/blob/main/images/GOOD_BYE_DILSHAN_MD.jpg?raw=true' },
            caption: message,
            mentions: [userId]
          });
        }
      }
    } catch (e) {
      console.error('Group participants update error:', e);
    }
  });

  conn.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      connectToWA();
    } else if (connection === 'open') {
      console.log("🔧 [DILSHAN-MD] Installing plugins...");
      const path = require('path');
      fs.readdirSync("./plugins/").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === ".js") {
          require("./plugins/" + plugin);
        }
      });
      console.log("✅ [DILSHAN-MD] Plugins installed successfully.");
      console.log("📶 [DILSHAN-MD] Successfully connected to WhatsApp!");

const up = `
╭━━━〔 🔔 *BOT CONNECTED* 🔔〕
┃ ✅ *Connection Status* : ONLINE
┃ 👑 *Owner* : DILSHAN CHANUSHKA
┃ 📡 *Bot Name* : DILSHAN-MD
┃ 💠 *Powered By* : WhatsApp
╰━━━━━━━━━━━━━━━━━━━━━━━╯

🎉 *Welcome back, Master!*  
🔹 Your bot is now *ready to rock* 🚀  
🔹 Use *.menu* or *.help* to explore commands.  
`;
      conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
        image: { url: config.ALIVE_IMG },
        caption: up
      });
    }
  });

  conn.ev.on('creds.update', saveCreds);

  conn.ev.on('messages.upsert', async(mek) => {
    mek = mek.messages[0];
    if (!mek.message) return;

    const contentType = getContentType(mek.message);
    const content = mek.message[contentType];

    if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(contentType)) {
      try {
        const stream = await downloadContentFromMessage(content, contentType.replace('Message', ''));
        const buffer = [];
        for await (const chunk of stream) buffer.push(chunk);
        mek._mediaBuffer = Buffer.concat(buffer);
        mek._mediaType = contentType;
      } catch (err) {
        console.log('❌ Failed to pre-download media:', err.message);
      }
    }

    // Handle viewOnce media buffers specifically
if (mek.message?.viewOnceMessageV2 || mek.message?.viewOnceMessage) {
  try {
    const viewOnceContent = mek.message.viewOnceMessageV2 || mek.message.viewOnceMessage;
    const actualMessage = viewOnceContent.message;
    const mediaType = Object.keys(actualMessage)[0];
    const mediaData = actualMessage[mediaType];
    
    if (mediaData) {
      const stream = await downloadContentFromMessage(mediaData, mediaType.replace('Message', ''));
      const buffer = [];
      for await (const chunk of stream) buffer.push(chunk);
      mek._mediaBuffer = Buffer.concat(buffer);
      mek._mediaType = mediaType;
      console.log(`✅ Pre-downloaded viewOnce ${mediaType} buffer`);
    }
  } catch (err) {
    console.log('❌ Failed to pre-download viewOnce media:', err.message);
  }
}

    // Run plugins onMessage hooks
    if (global.pluginHooks) {
      for (const plugin of global.pluginHooks) {
        if (plugin.onMessage) {
          try {
            await plugin.onMessage(conn, mek);
          } catch (e) {
            console.log("onMessage error:", e);
          }
        }
      }
    }
    
    mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
      ? mek.message.ephemeralMessage.message 
      : mek.message;

    if (config.READ_MESSAGE === 'true') {
      await conn.readMessages([mek.key]); 
      console.log(`Marked message from ${mek.key.remoteJid} as read.`);
    }
    

if (mek.key?.remoteJid === 'status@broadcast') {
  const senderJid = mek.key.participant || mek.key.remoteJid || "unknown@s.whatsapp.net";
  const mentionJid = senderJid.includes("@s.whatsapp.net") ? senderJid : senderJid + "@s.whatsapp.net";

  if (config.AUTO_STATUS_SEEN === "true") {
    try {
      await conn.readMessages([mek.key]);
      console.log(`[✓] Status seen: ${mek.key.id}`);
    } catch (e) {
      console.error("❌ Failed to mark status as seen:", e);
    }
  }

  if (config.AUTO_STATUS_REACT === "true" && mek.key.participant) {
    try {
      const emojis = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '💜', '💙', '🌝', '🖤', '💚'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      await conn.sendMessage(mek.key.participant, {
        react: {
          text: randomEmoji,
          key: mek.key,
        }
      });

      console.log(`[✓] Reacted to status of ${mek.key.participant} with ${randomEmoji}`);
    } catch (e) {
      console.error("❌ Failed to react to status:", e);
    }
  }

  if (mek.message?.extendedTextMessage && !mek.message.imageMessage && !mek.message.videoMessage) {
    const text = mek.message.extendedTextMessage.text || "";
    if (text.trim().length > 0) {
      try {
        await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
          text: `📝 *Text Status*\n👤 From: @${mentionJid.split("@")[0]}\n\n${text}`,
          mentions: [mentionJid]
        });
        console.log(`✅ Text-only status from ${mentionJid} forwarded.`);
      } catch (e) {
        console.error("❌ Failed to forward text status:", e);
      }
    }
  }

  if (mek.message?.imageMessage || mek.message?.videoMessage) {
    try {
      const msgType = mek.message.imageMessage ? "imageMessage" : "videoMessage";
      const mediaMsg = mek.message[msgType];

      const stream = await downloadContentFromMessage(
        mediaMsg,
        msgType === "imageMessage" ? "image" : "video"
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const mimetype = mediaMsg.mimetype || (msgType === "imageMessage" ? "image/jpeg" : "video/mp4");
      const captionText = mediaMsg.caption || "";

      await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
        [msgType === "imageMessage" ? "image" : "video"]: buffer,
        mimetype,
        caption: `📥 *Forwarded Status*\n👤 From: @${mentionJid.split("@")[0]}\n\n${captionText}`,
        mentions: [mentionJid]
      });

      console.log(`✅ Media status from ${mentionJid} forwarded.`);
    } catch (err) {
      console.error("❌ Failed to download or forward media status:", err);
    }
  }
}

    const m = sms(conn, mek);
    const type = getContentType(mek.message);
    const from = mek.key.remoteJid;
    const body = type === 'conversation'
      ? mek.message.conversation
      : mek.message[type]?.text || mek.message[type]?.caption || '';

    const isCmd = body.startsWith(prefix);
    const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    const q = args.join(' ');

    const sender = mek.key.fromMe 
      ? (conn.user.id.split(':')[0]+'@s.whatsapp.net' || conn.user.id) 
      : (mek.key.participant || mek.key.remoteJid);

    const senderNumber = sender.split('@')[0];
    const isGroup = from.endsWith('@g.us');

    const botNumber = conn.user.id.split(':')[0];
    const pushname = mek.pushName || 'Sin Nombre';
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;

    const botNumber2 = await jidNormalizedUser(conn.user.id);

    const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => ({})) : {};
    const groupName = groupMetadata?.subject || 'No Group Name'; // [FIXED] safe groupName default
    const participants = groupMetadata.participants || [];

    const groupAdminsRaw = isGroup ? getGroupAdmins(participants) : [];
    const groupAdmins = groupAdminsRaw.map(jidNormalizedUser);

    const senderId = jidNormalizedUser(sender);
    const botId = jidNormalizedUser(conn.user.id);

    const isAdmins = groupAdmins.includes(senderId);
    const isBotAdmins = groupAdmins.includes(botId);

    if (isGroup && global.antiLinkGroups?.[from] && !isAdmins && /(https?:\/\/[^\s]+)/i.test(body)) {
      await conn.sendMessage(from, {
        text: `🚫 Link detected!\n@${senderNumber} has been removed from *${groupName}*!`,
        mentions: [sender]
      });
      await conn.groupParticipantsUpdate(from, [sender], "remove");
    }
    const badwords = ["fuck", "shit", "idiot", "bitch", "puka", "උඹ", "කැරියා", "හුත්තා" ,"පකයා", "හුකන්නා", "පොන්නයා"];
    if (isGroup && global.antiBadwordGroups?.[from] && !isAdmins) {
      if (badwords.some(word => body.toLowerCase().includes(word))) {
        await conn.sendMessage(from, {
          text: `🧼 Bad word detected!\n@${senderNumber} has been removed from *${groupName}*!`,
          mentions: [sender]
        });
        await conn.groupParticipantsUpdate(from, [sender], "remove");
      }
    }

    const reply = (text, options = {}) => conn.sendMessage(from, { text, ...options }, { quoted: mek });


    conn.decodeJid = jid => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (
          (decode.user &&
            decode.server &&
            decode.user + '@' + decode.server) ||
          jid
        );
      } else return jid;
    };

    if (isCmd) {
      const cmd = commands.find((c) => c.pattern === commandName || (c.alias && c.alias.includes(commandName)));
      if (cmd) {
        switch ((config.MODE || 'public').toLowerCase()) {
          case 'private':
            if (!isOwner) return;
            break;
          case 'public':
          default:
            break;
        }
        
        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

        try {
          cmd.function(conn, mek, m, {
            from, quoted: mek, body, isCmd, command: commandName, args, q,
            isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
            isMe, isOwner, groupMetadata, groupName, participants, groupAdmins,
            isBotAdmins, isAdmins, reply,
          });
        } catch (e) {
          console.error("[PLUGIN ERROR] " + e);
        }
      }
    }

    const replyText = body;
    for (const handler of replyHandlers) {
      if (handler.filter(replyText, { sender, message: mek })) {
        try {
          await handler.function(conn, mek, m, {
            from, quoted: mek, body: replyText, sender, reply,
          });
          break;
        } catch (e) {
          console.log("Reply handler error:", e);
        }
      }
    }
  });

  conn.ev.on('messages.update', async (updates) => {
    if (global.pluginHooks) {
      for (const plugin of global.pluginHooks) {
        if (plugin.onDelete) {
          try {
            await plugin.onDelete(conn, updates);
          } catch (e) {
            console.log("onDelete error:", e);
          }
        }
      }
    }
  });
  conn.ev.on("messages.upsert", async ({ messages }) => {
  const m = messages[0];
  const from = m?.key?.remoteJid;

  // Detect channel messages
  if (from && from.endsWith("@newsletter")) {
    console.log("📡 Channel message detected");
    console.log("➡️ Channel JID:", from);
    console.log("➡️ Message ID:", m.key.id);
    console.log("➡️ Sender:", m.pushName || "Unknown");
    console.log("➡️ Text:", m.message?.conversation || m.message?.extendedTextMessage?.text || "[non-text message]");
    console.log("---------------------------------");
  }
});
}

app.get("/", (req, res) => {
  res.send("Hey, DILSHAN-MD started✅");
});

app.listen(port, () => console.log(`🌐 [DILSHAN-MD] Web server running → http://localhost:${port}`));

setTimeout(() => {
  connectToWA();
}, 4000);









