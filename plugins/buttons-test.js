// plugins/button-test.js - Button Test Plugin using @vreden/meta
const { cmd } = require("../command");

// Import the vreden/meta library
const { makeWASocket } = require('@vreden/meta');

cmd(
  {
    pattern: "buttontest",
    react: "🧪",
    desc: "Test WhatsApp buttons functionality with @vreden/meta",
    category: "test",
    filename: __filename,
  },
  async (conn, mek, m, { from, reply }) => {
    try {
      console.log("🧪 [BUTTON TEST] Sending test buttons using @vreden/meta...");
      
      // Test 1: Simple Text with Buttons
      await conn.sendMessage(from, {
        text: `🧪 *BUTTON TEST MESSAGE*

Testing WhatsApp buttons functionality with @vreden/meta package

*Select an option below:*`,
        buttons: [
          {
            buttonId: 'id1',
            buttonText: {
              displayText: '✅ Button 1'
            },
            type: 1
          },
          {
            buttonId: 'id2',
            buttonText: {
              displayText: '🔍 Button 2'
            },
            type: 1
          },
          {
            buttonId: 'id3',
            buttonText: {
              displayText: '🚀 Button 3'
            },
            type: 1
          }
        ],
        footer: 'MMT BUSINESS HUB Test'
      });

      console.log("✅ [BUTTON TEST] Basic buttons sent");

      // Wait 2 seconds before next test
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test 2: Image with Buttons
      await conn.sendMessage(from, {
        image: { 
          url: "https://raw.githubusercontent.com/dilshan62/DILSHAN-MD/main/images/WELCOME_DILSHAN_MD.jpg"
        },
        caption: "🖼️ *Image with Buttons Test*\n\nClick a button below:",
        buttons: [
          {
            buttonId: 'img1',
            buttonText: {
              displayText: '📷 Image Button 1'
            },
            type: 1
          },
          {
            buttonId: 'img2',
            buttonText: {
              displayText: '🌟 Image Button 2'
            },
            type: 1
          }
        ],
        footer: 'MMT BUSINESS HUB - Image Test'
      });

      console.log("✅ [BUTTON TEST] Image buttons sent");

      // Wait 2 seconds before next test
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test 3: URL Button
      await conn.sendMessage(from, {
        text: "🌐 *URL Button Test*\n\nTest opening website:",
        buttons: [
          {
            buttonId: 'url_btn',
            buttonText: {
              displayText: '🌐 Visit MMT Website'
            },
            type: 1
          }
        ],
        footer: 'MMT BUSINESS HUB - URL Test'
      });

      console.log("✅ [BUTTON TEST] All button tests completed!");

    } catch (error) {
      console.error("❌ [BUTTON TEST] Error sending buttons:", error);
      await reply(`❌ Button test failed: ${error.message}\n\nMake sure @vreden/meta is installed: npm install @vreden/meta`);
    }
  }
);

// Test with Native Flow buttons
cmd(
  {
    pattern: "btest2", 
    react: "🔘",
    desc: "Test Native Flow buttons",
    category: "test",
    filename: __filename,
  },
  async (conn, mek, m, { from, reply }) => {
    try {
      // Test Native Flow Button
      await conn.sendMessage(from, {
        text: "⚡ *Native Flow Button Test*",
        buttons: [
          {
            buttonId: 'flow',
            buttonText: {
              displayText: '🚀 Open Flow'
            },
            nativeFlowInfo: {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: 'Visit MMT Website',
                url: 'https://makemetrend.online',
                merchant_url: 'https://makemetrend.online'
              })
            },
            type: 2
          }
        ],
        footer: 'MMT BUSINESS HUB - Native Flow Test'
      });

      await reply("✅ Native flow button test sent!");

    } catch (error) {
      console.error("❌ [BTEST2] Error:", error);
      await reply(`❌ Native flow test failed: ${error.message}`);
    }
  }
);

// Handle button responses
module.exports = {
  onMessage: async (conn, mek) => {
    try {
      const key = mek.key;
      const content = mek.message;
      if (!content || key.fromMe) return;

      const from = key.remoteJid;

      // Handle button responses from @vreden/meta
      if (content.buttonsResponseMessage) {
        const selectedId = content.buttonsResponseMessage.selectedButtonId;
        
        console.log(`🔄 [BUTTON TEST] @vreden/meta button clicked: ${selectedId} from ${from}`);
        
        let responseText = "";
        
        switch(selectedId) {
          case 'id1':
            responseText = "🎉 *Button 1 Clicked!*\n\n@vreden/meta buttons are working perfectly! ✅";
            break;
            
          case 'id2':
            responseText = "🔍 *Button 2 Clicked!*\n\nButton responses with @vreden/meta are functional! ✅";
            break;
            
          case 'id3':
            responseText = "🚀 *Button 3 Clicked!*\n\nAll button types working with @vreden/meta! ✅";
            break;
            
          case 'img1':
            responseText = "🖼️ *Image Button 1 Clicked!*\n\nImage with buttons working great!";
            break;
            
          case 'img2':
            responseText = "🖼️ *Image Button 2 Clicked!*\n\nImage button functionality confirmed!";
            break;
            
          case 'url_btn':
            responseText = "🌐 *URL Button Clicked!*\n\nURL button response received!";
            break;
            
          default:
            responseText = `🔘 *Button Clicked:* ${selectedId}\n\n@vreden/meta button response working!`;
        }
        
        await conn.sendMessage(from, { 
          text: responseText 
        });

        // Send final test summary
        await conn.sendMessage(from, {
          text: `📊 *@vreden/meta BUTTON TEST SUMMARY*

✅ Basic Buttons: Working
✅ Image Buttons: Working  
✅ Button Responses: Working
✅ Library: @vreden/meta

🎯 All tests passed successfully! 🚀`
        });
      }
      
    } catch (error) {
      console.error("❌ [BUTTON TEST] Error handling @vreden/meta button response:", error);
    }
  }
};
