#!/usr/bin/env node

/**
 * Cancelled Sponsor Handler Script
 *
 * Automatically sends a thank you message to sponsors who cancel
 * and handles graceful offboarding.
 */

const https = require("https");

// Configuration
const SPONSOR_TOKEN = process.env.SPONSOR_TOKEN;
const SPONSOR_LOGIN = process.env.SPONSOR_LOGIN;
const TIER_NAME = process.env.TIER_NAME;
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "zviel";
const REPO_NAME = "self-streme";

// Tier emoji mapping
const TIER_EMOJIS = {
  Coffee: "☕",
  Bronze: "🥉",
  Silver: "🥈",
  Gold: "🥇",
  Diamond: "💎",
  Platinum: "🌟",
};

/**
 * Get tier emoji
 */
function getTierEmoji(tierName) {
  for (const [key, emoji] of Object.entries(TIER_EMOJIS)) {
    if (tierName && tierName.toLowerCase().includes(key.toLowerCase())) {
      return emoji;
    }
  }
  return "⭐";
}

/**
 * Get farewell message
 */
function getFarewellMessage(tierName) {
  const emoji = getTierEmoji(tierName);
  const tier = tierName || "Supporter";

  return `# 🙏 Thank You for Your Support!

Hi @${SPONSOR_LOGIN},

We noticed that you've cancelled your **${emoji} ${tier}** sponsorship. While we're sad to see you go, we want to express our heartfelt gratitude for your support!

## 💝 Your Impact

During your time as a sponsor, you helped us:
- ✨ Maintain and improve Self-Streme
- 🚀 Add new features and optimizations
- 📚 Create better documentation
- 🐛 Fix bugs quickly
- 💬 Support the community

**Your contribution made a real difference!**

## 📋 What Happens Next

According to our [sponsorship policy](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/SPONSORS.md):

- ✅ Your benefits will remain active until the end of your current billing period
- 📊 Your recognition in SPONSORS.md will be removed after 30 days
- 💬 You'll continue to have access to sponsors-only discussions until your billing period ends
- 🎯 Any priority support tickets will still be honored during this period

## 🤝 Stay Connected

Even though you're no longer a sponsor, you're always welcome in our community!

**Free ways to stay involved:**
- ⭐ Keep your star on the repository
- 💬 Participate in GitHub Discussions
- 🐛 Report bugs and issues
- 📝 Contribute to documentation
- 💻 Submit pull requests
- 📢 Share Self-Streme with others

## 🔄 Come Back Anytime

We'd love to have you back as a sponsor whenever you're ready! Your previous tier and benefits will be waiting for you.

**[Become a Sponsor Again](https://github.com/sponsors/${REPO_OWNER})**

## 💭 Feedback

We're always looking to improve. If you're comfortable sharing, we'd love to know:
- What prompted your cancellation?
- Was there anything we could have done better?
- What would make you consider sponsoring again?

Your feedback helps us serve our sponsors better. Feel free to reply to this discussion or email us directly.

## 📚 Resources

- **Project Documentation:** [docs/](https://github.com/${REPO_OWNER}/${REPO_NAME}/tree/main/docs)
- **Quick Start Guide:** [QUICK_START.md](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/docs/QUICK_START.md)
- **Contributing Guide:** [CONTRIBUTORS.md](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/CONTRIBUTORS.md)

---

**Thank you again for your support!** 🙏

Every contribution, no matter the duration, helps make Self-Streme better for everyone. We're grateful for the time you spent as part of our sponsors community.

We hope to see you around, and we wish you all the best! 🌟

Best regards,
The Self-Streme Team

---

*P.S. If this was a mistake or you have questions about your cancellation, please reach out immediately and we'll help sort it out!*

---

*This is an automated notification. For assistance, please reply to this discussion or contact us via email.*`;
}

/**
 * Create GitHub discussion
 */
async function createDiscussion(title, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: title,
      body: body,
      category: "announcements",
    });

    const options = {
      hostname: "api.github.com",
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/discussions`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${SPONSOR_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "Content-Length": data.length,
        "User-Agent": "Self-Streme-Sponsor-Bot",
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(responseData));
        } else {
          reject(
            new Error(
              `Failed to create discussion: ${res.statusCode} - ${responseData}`,
            ),
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Create GitHub issue (fallback)
 */
async function createIssue(title, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: title,
      body: body,
      labels: ["sponsor", "cancellation"],
    });

    const options = {
      hostname: "api.github.com",
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${SPONSOR_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "Content-Length": data.length,
        "User-Agent": "Self-Streme-Sponsor-Bot",
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(responseData));
        } else {
          reject(
            new Error(
              `Failed to create issue: ${res.statusCode} - ${responseData}`,
            ),
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Send internal notification about cancellation
 */
async function sendInternalNotification(sponsor, tier) {
  console.log("\n📊 Internal Notification:");
  console.log("─".repeat(60));
  console.log(`Sponsor @${sponsor} cancelled their ${tier} sponsorship`);
  console.log(`Action items:`);
  console.log(`  1. Benefits remain active until billing period ends`);
  console.log(`  2. Remove from SPONSORS.md after 30 days`);
  console.log(`  3. Monitor for feedback in discussion`);
  console.log(`  4. Consider follow-up after 90 days`);
  console.log("─".repeat(60));
}

/**
 * Main execution
 */
async function main() {
  console.log("👋 Cancelled Sponsor Handler Starting...\n");

  // Validate environment variables
  if (!SPONSOR_TOKEN) {
    console.error("❌ SPONSOR_TOKEN is required");
    process.exit(1);
  }

  if (!SPONSOR_LOGIN) {
    console.error("❌ SPONSOR_LOGIN is required");
    process.exit(1);
  }

  const tierName = TIER_NAME || "Supporter";

  console.log(`👤 Sponsor: @${SPONSOR_LOGIN}`);
  console.log(`🎯 Tier: ${tierName}`);
  console.log(`📋 Status: Cancelled\n`);

  // Generate farewell message
  const message = getFarewellMessage(tierName);
  const title = `🙏 Thank You for Your Support, @${SPONSOR_LOGIN}!`;

  // Try to create a discussion first, fall back to issue
  try {
    console.log("📝 Creating farewell message...");
    const discussion = await createDiscussion(title, message);
    console.log(`✅ Farewell message created: ${discussion.html_url}`);
  } catch (discussionError) {
    console.warn("⚠️  Could not create discussion, trying issue instead...");
    console.warn(`   Reason: ${discussionError.message}`);

    try {
      console.log("📝 Creating farewell issue...");
      const issue = await createIssue(title, message);
      console.log(`✅ Farewell issue created: ${issue.html_url}`);
    } catch (issueError) {
      console.error(
        "❌ Failed to create farewell message:",
        issueError.message,
      );
      console.log("\n📧 Farewell message (copy manually if needed):");
      console.log("─".repeat(80));
      console.log(message);
      console.log("─".repeat(80));
      process.exit(1);
    }
  }

  // Send internal notification
  await sendInternalNotification(SPONSOR_LOGIN, tierName);

  console.log("\n✨ Cancellation handled successfully!");
  console.log(
    `   Sponsor @${SPONSOR_LOGIN} has been thanked for their support.`,
  );
  console.log(`   Remember to:`);
  console.log(`   - Keep benefits active until billing period ends`);
  console.log(`   - Remove from SPONSORS.md after 30 days`);
  console.log(`   - Monitor for feedback`);
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { getFarewellMessage };
