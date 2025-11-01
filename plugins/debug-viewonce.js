const util = require("util");

module.exports = {
  onMessage: async (conn, msg) => {
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    console.log("\n==============================");
    console.log("🧩 NEW MESSAGE RECEIVED");
    console.log("==============================\n");

    // Print only message keys for clarity
    console.log("📦 Message Keys:", Object.keys(msg.message));

    // Print nested structure for known viewOnce wrappers
    const checkPaths = [
      "viewOnceMessage",
      "viewOnceMessageV2",
      "viewOnceMessageV2Extension",
      "message.viewOnceMessage",
      "message.viewOnceMessageV2",
      "message.viewOnceMessageV2Extension",
    ];

    for (const path of checkPaths) {
      const parts = path.split(".");
      let data = msg.message;
      for (const part of parts) {
        if (data && typeof data === "object") data = data[part];
      }
      if (data) {
        console.log(`✅ Found something at: ${path}`);
        console.log(util.inspect(data, { depth: 3, colors: true }));
      }
    }

    // If still nothing matches, dump the whole structure (optional)
    console.log("\n📤 FULL MESSAGE OBJECT (truncated):");
    console.log(util.inspect(msg.message, { depth: 4, colors: true }));
    console.log("==============================\n");
  },
};
