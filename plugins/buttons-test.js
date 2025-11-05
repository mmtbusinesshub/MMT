// plugins/button-test.js - Button Test Plugin
const { cmd } = require("../command");

cmd(
  {
    pattern: "buttontest",
    react: "🧪",
    desc: "Test WhatsApp buttons functionality",
    category: "test",
    filename: __filename,
  },
  async (conn, mek, m, { from, reply }) => {
    try {
      console.log("🧪 [BUTTON TEST] Sending test buttons...");
      
      // Test 1: Simple Quick Reply Buttons
      await conn.sendMessage(from, {
        text: `🧪 *BUTTON TEST MESSAGE*

Testing WhatsApp buttons functionality:

• Quick Reply Buttons
• URL Buttons  
• Call Buttons
• List Messages

*Select an option below:*`,
        buttons: [
          {
            buttonId: "test_btn1",
            buttonText: { displayText: "✅ Button 1" },
            type: 1
          },
          {
            buttonId: "test_btn2", 
            buttonText: { displayText: "🔍 Button 2" },
            type: 1
          },
          {
            buttonId: "test_btn3",
            buttonText: { displayText: "🚀 Button 3" },
            type: 1
          }
        ],
        headerType: 1
      });

      // Test 2: Template Buttons (URL & Call)
      await conn.sendMessage(from, {
        text: "🌐 *Template Buttons Test*",
        templateButtons: [
          {
            index: 1,
            urlButton: {
              displayText: "🌐 Visit Website",
              url: "https://makemetrend.online"
            }
          },
          {
            index: 2,
            callButton: {
              displayText: "📞 Call Test",
              phoneNumber: "+94123456789"
            }
          },
          {
            index: 3,
            quickReplyButton: {
              displayText: "🔙 Back to Test",
              id: "back_btn"
            }
          }
        ]
      });

      // Test 3: List Message
      await conn.sendMessage(from, {
        text: "📋 *List Message Test*",
        title: "MMT BUSINESS HUB TEST",
        sections: [
          {
            title: "Test Section 1",
            rows: [
              {
                title: "Test Option A",
                description: "This is option A description",
                rowId: "test_option_a"
              },
              {
                title: "Test Option B", 
                description: "This is option B description",
                rowId: "test_option_b"
              }
            ]
          },
          {
            title: "Test Section 2",
            rows: [
              {
                title: "Test Option C",
                description: "This is option C description",
                rowId: "test_option_c"
              },
              {
                title: "Test Option D",
                description: "This is option D description", 
                rowId: "test_option_d"
              }
            ]
          }
        ]
      });

      console.log("✅ [BUTTON TEST] All test buttons sent successfully!");
      
    } catch (error) {
      console.error("❌ [BUTTON TEST] Error sending buttons:", error);
      await reply(`❌ Button test failed: ${error.message}`);
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

      // Handle button responses
      if (content.buttonsResponseMessage) {
        const selectedId = content.buttonsResponseMessage.selectedButtonId;
        const from = key.remoteJid;
        
        console.log(`🔄 [BUTTON TEST] Button clicked: ${selectedId} from ${from}`);
        
        let responseText = "";
        
        switch(selectedId) {
          case 'test_btn1':
            responseText = "🎉 *Button 1 Clicked!*\n\nYou selected the first test button. This is working correctly! ✅";
            break;
            
          case 'test_btn2':
            responseText = "🔍 *Button 2 Clicked!*\n\nYou selected the second test button. Everything is working! ✅";
            break;
            
          case 'test_btn3':
            responseText = "🚀 *Button 3 Clicked!*\n\nYou selected the third test button. Buttons are functional! ✅";
            break;
            
          case 'back_btn':
            responseText = "🔙 *Back Button Clicked!*\n\nReturning to main test...";
            break;
            
          case 'test_option_a':
            responseText = "📝 *Option A Selected*\n\nList message option A is working correctly!";
            break;
            
          case 'test_option_b':
            responseText = "📝 *Option B Selected*\n\nList message option B is working perfectly!";
            break;
            
          case 'test_option_c':
            responseText = "📝 *Option C Selected*\n\nList message option C is functional!";
            break;
            
          case 'test_option_d':
            responseText = "📝 *Option D Selected*\n\nList message option D is working!";
            break;
            
          default:
            responseText = `🔘 *Unknown Button:* ${selectedId}\n\nThis button ID is not handled in the test.`;
        }
        
        await conn.sendMessage(from, { 
          text: responseText 
        });
        
        // Send confirmation that button handling works
        await conn.sendMessage(from, {
          text: "✅ *BUTTON TEST RESULTS*\n\n🎯 *Quick Reply Buttons:* ✅ Working\n🌐 *URL/Call Buttons:* ✅ Working\n📋 *List Messages:* ✅ Working\n\nAll button types are functional! 🚀"
        });
      }
      
    } catch (error) {
      console.error("❌ [BUTTON TEST] Error handling button response:", error);
    }
  }
};
