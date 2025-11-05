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
  if (!config.SESSION_ID) return console.log('❗ [MMT BUSINESS HUB] SESSION_ID not found in env. Please configure it.');
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
      console.log("📥 [MMT BUSINESS HUB] Session file downloaded and saved.");
    });
  });
}

const { replyHandlers, commands } = require('./command');
const antiDeletePlugin = require('./plugins/antidelete.js');
global.pluginHooks = global.pluginHooks || [];
global.pluginHooks.push(antiDeletePlugin);

async function connectToWA() {
  console.log("🛰️ [MMT BUSINESS HUB] Initializing WhatsApp connection...");
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

  conn.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      connectToWA();
    } else if (connection === 'open') {
      console.log("🔧 [MMT BUSINESS HUB] Installing plugins...");
      const path = require('path');
      fs.readdirSync("./plugins/").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === ".js") {
          require("./plugins/" + plugin);
        }
      });
      console.log("✅ [MMT BUSINESS HUB] Plugins installed successfully.");
      console.log("📶 [MMT BUSINESS HUB] Successfully connected to WhatsApp!");

      const up = `
╭━━━〔 🚀 *MMT BUSINESS HUB* 🚀〕━━━━━━╮
┃                                           
┃ ✅ *Connection Status* : ONLINE        
┃ 👑 *Auto-Reply System* : ACTIVATED     
┃ 📡 *Business Account* : MMT BUSINESS HUB
┃ 💠 *Powered By* : WhatsApp Business API
┃                                           
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌟 *Social Media Marketing Assistant Ready!*  

💼 *Use appropriate message for auto reply system to explore our services*
🔹 *Use *.ping* for test if bot alive or not*
🔹 *Use *.help* for assistance*

🎯 *Growing Your Business, One Click at a Time!*
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
        console.log('❌ [MMT BUSINESS HUB] Failed to pre-download media:', err.message);
      }
    }

    // Run plugins onMessage hooks
    if (global.pluginHooks) {
      for (const plugin of global.pluginHooks) {
        if (plugin.onMessage) {
          try {
            await plugin.onMessage(conn, mek);
          } catch (e) {
            console.log("[MMT BUSINESS HUB] onMessage error:", e);
          }
        }
      }
    }
    
    mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
      ? mek.message.ephemeralMessage.message 
      : mek.message;

    if (config.READ_MESSAGE === 'true') {
      await conn.readMessages([mek.key]); 
      console.log(`[MMT BUSINESS HUB] Marked message from ${mek.key.remoteJid} as read.`);
    }

    if (mek.key?.remoteJid === 'status@broadcast') {
      const senderJid = mek.key.participant || mek.key.remoteJid || "unknown@s.whatsapp.net";
      const mentionJid = senderJid.includes("@s.whatsapp.net") ? senderJid : senderJid + "@s.whatsapp.net";

      if (config.AUTO_STATUS_SEEN === "true") {
        try {
          await conn.readMessages([mek.key]);
          console.log(`[MMT BUSINESS HUB] Status seen: ${mek.key.id}`);
        } catch (e) {
          console.error("❌ [MMT BUSINESS HUB] Failed to mark status as seen:", e);
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

          console.log(`[MMT BUSINESS HUB] Reacted to status of ${mek.key.participant} with ${randomEmoji}`);
        } catch (e) {
          console.error("❌ [MMT BUSINESS HUB] Failed to react to status:", e);
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
    const groupName = groupMetadata?.subject || 'No Group Name';
    const participants = groupMetadata.participants || [];

    const groupAdminsRaw = isGroup ? getGroupAdmins(participants) : [];
    const groupAdmins = groupAdminsRaw.map(jidNormalizedUser);

    const senderId = jidNormalizedUser(sender);
    const botId = jidNormalizedUser(conn.user.id);

    const isAdmins = groupAdmins.includes(senderId);
    const isBotAdmins = groupAdmins.includes(botId);

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
          console.error("[MMT BUSINESS HUB] PLUGIN ERROR: " + e);
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
          console.log("[MMT BUSINESS HUB] Reply handler error:", e);
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
            console.log("[MMT BUSINESS HUB] onDelete error:", e);
          }
        }
      }
    }
  });
}

app.get("/", (req, res) => {
  res.send("MMT BUSINESS HUB Auto-Reply System Started ✅");
});

app.listen(port, () => console.log(`🌐 [MMT BUSINESS HUB] Web server running → http://localhost:${port}`));

setTimeout(() => {
  connectToWA();
}, 4000);
