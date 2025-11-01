const { downloadContentFromMessage, getContentType, proto } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {
    onMessage: async (conn, mek) => {
        try {
            if (!mek.message) return;
            
            // Check for viewOnce messages
            const viewOnceTypes = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];
            let viewOnceType = null;
            let viewOnceContent = null;

            for (const type of viewOnceTypes) {
                if (mek.message[type]) {
                    viewOnceType = type;
                    viewOnceContent = mek.message[type];
                    break;
                }
            }

            if (!viewOnceContent) return;

            console.log(`🔍 ViewOnce detected: ${viewOnceType}`);

            const from = mek.key.remoteJid;
            const sender = mek.key.participant || from;
            const botJid = conn.user.id;

            // Don't process if the message is from the bot itself
            if (mek.key.fromMe) return;

            try {
                // Extract the actual media message
                const actualMessage = viewOnceContent.message;
                if (!actualMessage) {
                    console.log('❌ No actual message found in viewOnce');
                    return;
                }

                const mediaType = getContentType(actualMessage);
                console.log(`📁 Media type: ${mediaType}`);

                if (!['imageMessage', 'videoMessage'].includes(mediaType)) {
                    console.log('❌ Not an image or video viewOnce');
                    return;
                }

                const mediaMsg = actualMessage[mediaType];
                if (!mediaMsg) {
                    console.log('❌ No media message found');
                    return;
                }

                // Download the media
                const mediaKind = mediaType === 'imageMessage' ? 'image' : 'video';
                console.log(`⬇️ Downloading ${mediaKind}...`);

                const stream = await downloadContentFromMessage(mediaMsg, mediaKind);
                
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                console.log(`✅ Downloaded ${buffer.length} bytes`);

                // Create caption
                const caption = `📤 *ViewOnce Media Recovered*\n\n👤 *From:* @${sender.split('@')[0]}\n🕒 *Time:* ${new Date().toLocaleString()}\n📁 *Type:* ${mediaType === 'imageMessage' ? 'Image' : 'Video'}\n\n✨ *Recovered by DILSHAN-MD*`;

                // Send the recovered media back to the sender
                const sendOptions = {
                    mentions: [sender]
                };

                if (mediaType === 'imageMessage') {
                    await conn.sendMessage(from, {
                        image: buffer,
                        caption: caption,
                        ...sendOptions
                    });
                    console.log(`✅ ViewOnce image sent back to ${sender}`);
                } else if (mediaType === 'videoMessage') {
                    await conn.sendMessage(from, {
                        video: buffer,
                        caption: caption,
                        ...sendOptions
                    });
                    console.log(`✅ ViewOnce video sent back to ${sender}`);
                }

                // Also send confirmation to bot owner
                const ownerMsg = `🔔 *ViewOnce Alert*\n\n👤 From: @${sender.split('@')[0]}\n💬 Chat: ${from}\n📁 Type: ${mediaType === 'imageMessage' ? 'Image' : 'Video'}\n✅ Auto-recovered successfully`;
                
                try {
                    await conn.sendMessage(conn.user.id.split(':')[0] + '@s.whatsapp.net', {
                        text: ownerMsg,
                        mentions: [sender]
                    });
                } catch (ownerErr) {
                    console.log('⚠️ Could not notify owner:', ownerErr.message);
                }

            } catch (downloadError) {
                console.error('❌ Error processing viewOnce:', downloadError);
                
                // Send error message to user
                try {
                    await conn.sendMessage(from, {
                        text: `❌ Failed to recover ViewOnce media\n\nError: ${downloadError.message}\n\nPlease try sending again or contact the bot owner.`
                    });
                } catch (sendError) {
                    console.error('❌ Could not send error message:', sendError);
                }
            }

        } catch (error) {
            console.error('❌ Critical error in antiviewonce plugin:', error);
        }
    }
};
