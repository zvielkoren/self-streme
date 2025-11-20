#!/usr/bin/env node

/**
 * Tier Change Handler Script
 *
 * Automatically handles sponsor tier changes (upgrades/downgrades)
 * and sends appropriate notification messages.
 */

const https = require("https");

// Configuration
const SPONSOR_TOKEN = process.env.SPONSOR_TOKEN;
const SPONSOR_LOGIN = process.env.SPONSOR_LOGIN;
const NEW_TIER = process.env.NEW_TIER;
const OLD_TIER = process.env.OLD_TIER;
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
 * Get tier amount estimate from name
 */
function getTierAmount(tierName) {
  if (!tierName) return 0;
  const lower = tierName.toLowerCase();
  if (lower.includes("platinum")) return 250;
  if (lower.includes("diamond")) return 100;
  if (lower.includes("gold")) return 50;
  if (lower.includes("silver")) return 25;
  if (lower.includes("bronze")) return 10;
  if (lower.includes("coffee")) return 5;
  return 0;
}

/**
 * Determine if this is an upgrade or downgrade
 */
function isUpgrade(oldTier, newTier) {
  const oldAmount = getTierAmount(oldTier);
  const newAmount = getTierAmount(newTier);
  return newAmount > oldAmount;
}

/**
 * Get tier change message
 */
function getTierChangeMessage(oldTier, newTier, upgrade) {
  const oldEmoji = getTierEmoji(oldTier);
  const newEmoji = getTierEmoji(newTier);
  const action = upgrade ? "upgraded" : "changed";
  const emoji = upgrade ? "🎉" : "📋";
  const newAmount = getTierAmount(newTier);

  let benefits = "";

  if (newAmount >= 250) {
    benefits = `## 🌟 Your New Platinum Benefits

As a **Platinum Sponsor**, you now have access to:
- 🚨 24/7 critical issue support
- 🎯 Guaranteed feature implementation (within project scope)
- 🏆 Optional named version releases
- 📄 Custom SLA agreement
- 🔧 Dedicated monthly consultation hours
- 💼 White-label licensing options (negotiable)
- 🤝 Partnership opportunities

**Plus all benefits from lower tiers!**`;
  } else if (newAmount >= 100) {
    benefits = `## 💎 Your New Diamond Benefits

As a **Diamond Sponsor**, you now have access to:
- ⚡ Premium support (6-hour response time)
- 🏢 Company logo prominently displayed on README
- 🎯 Direct input on feature development
- 🔒 Private security issue notifications
- 📞 Phone/video support
- 🛠️ Custom deployment assistance
- 📊 Quarterly strategy meetings

**Plus all benefits from lower tiers!**`;
  } else if (newAmount >= 50) {
    benefits = `## 🥇 Your New Gold Benefits

As a **Gold Sponsor**, you now have access to:
- 🚀 VIP support (12-hour response time)
- 💼 Custom integration assistance
- 🎯 Direct influence on roadmap priorities
- 🎨 Logo on README.md (medium size)
- 📺 Featured on project website (when available)
- 🤝 Monthly video call for feedback/support

**Plus all benefits from lower tiers!**`;
  } else if (newAmount >= 25) {
    benefits = `## 🥈 Your New Silver Benefits

As a **Silver Sponsor**, you now have access to:
- ⚡ Priority support (24-hour response time)
- 🔧 Direct technical assistance via email
- 📝 Your name/brand in README.md sponsors section
- 🎨 Logo in project documentation (small)

**Plus all benefits from lower tiers!**`;
  } else if (newAmount >= 10) {
    benefits = `## 🥉 Your New Bronze Benefits

As a **Bronze Sponsor**, you now have access to:
- 🏅 Bronze badge in SPONSORS.md
- 📊 Monthly project updates and roadmap insights
- 🎯 Priority bug report responses (within 48 hours)
- 💡 Feature request consideration priority

**Plus all benefits from lower tiers!**`;
  } else {
    benefits = `## ☕ Your Coffee Supporter Benefits

As a **Coffee Supporter**, you have access to:
- ⭐ Sponsor badge on your GitHub profile
- 🙏 Listed in SPONSORS.md (if you choose)
- 💬 Access to sponsors-only discussions
- 📢 Early announcements of new features`;
  }

  let nextSteps = "";
  if (upgrade) {
    nextSteps = `## 🚀 Next Steps

1. Your new benefits are now active!
2. Check your email for updated access information
${newAmount >= 50 ? "3. Schedule your video call (link will be sent shortly)" : ""}
${newAmount >= 100 ? "4. Send us your company logo if you haven't already" : ""}
${newAmount >= 250 ? "5. We'll reach out to set up your custom SLA" : ""}

**Need help?** Reply to this discussion or reach out via the sponsors forum.`;
  } else {
    nextSteps = `## 📋 Next Steps

Your tier has been updated and your new benefits are now active!

If you have any questions about your new tier, please:
1. Reply to this discussion
2. Contact us via the sponsors forum
3. Email us directly (check your sponsorship confirmation)

**Thank you for your continued support!**`;
  }

  return `# ${emoji} Tier ${upgrade ? "Upgrade" : "Change"} Confirmation

Hi @${SPONSOR_LOGIN},

Thank you for ${action === "upgraded" ? "upgrading" : "updating"} your sponsorship!

**Tier Change:**
- Previous: ${oldEmoji} ${oldTier || "Unknown"}
- New: ${newEmoji} ${newTier}

${benefits}

${nextSteps}

## 📚 Resources

- **Sponsors Program:** [SPONSORS.md](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/SPONSORS.md)
- **All Benefits:** [SPONSORS_GUIDE.md](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/docs/SPONSORS_GUIDE.md)
- **Documentation:** [docs/](https://github.com/${REPO_OWNER}/${REPO_NAME}/tree/main/docs)

---

**Thank you for your ${upgrade ? "increased" : "continued"} support!** ${upgrade ? "🎉" : "🙏"}

Your contribution helps us maintain and improve Self-Streme for everyone.

Best regards,
The Self-Streme Team

---

*This is an automated notification. For assistance, please reply to this discussion.*`;
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
      labels: ["sponsor", "tier-change"],
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
 * Main execution
 */
async function main() {
  console.log("📋 Tier Change Handler Starting...\n");

  // Validate environment variables
  if (!SPONSOR_TOKEN) {
    console.error("❌ SPONSOR_TOKEN is required");
    process.exit(1);
  }

  if (!SPONSOR_LOGIN) {
    console.error("❌ SPONSOR_LOGIN is required");
    process.exit(1);
  }

  if (!NEW_TIER) {
    console.error("❌ NEW_TIER is required");
    process.exit(1);
  }

  const upgrade = isUpgrade(OLD_TIER, NEW_TIER);
  const emoji = upgrade ? "⬆️" : "🔄";

  console.log(`👤 Sponsor: @${SPONSOR_LOGIN}`);
  console.log(`${emoji} Old Tier: ${OLD_TIER || "Unknown"}`);
  console.log(`${emoji} New Tier: ${NEW_TIER}`);
  console.log(`📊 Type: ${upgrade ? "UPGRADE" : "CHANGE"}\n`);

  // Generate tier change message
  const message = getTierChangeMessage(OLD_TIER, NEW_TIER, upgrade);
  const titleEmoji = upgrade ? "🎉" : "📋";
  const titleAction = upgrade ? "Upgrade" : "Tier Change";
  const title = `${titleEmoji} Sponsor ${titleAction}: @${SPONSOR_LOGIN}`;

  // Try to create a discussion first, fall back to issue
  try {
    console.log("📝 Creating tier change notification...");
    const discussion = await createDiscussion(title, message);
    console.log(`✅ Notification created: ${discussion.html_url}`);
  } catch (discussionError) {
    console.warn("⚠️  Could not create discussion, trying issue instead...");
    console.warn(`   Reason: ${discussionError.message}`);

    try {
      console.log("📝 Creating notification issue...");
      const issue = await createIssue(title, message);
      console.log(`✅ Notification issue created: ${issue.html_url}`);
    } catch (issueError) {
      console.error("❌ Failed to create notification:", issueError.message);
      console.log("\n📧 Notification message (copy manually if needed):");
      console.log("─".repeat(80));
      console.log(message);
      console.log("─".repeat(80));
      process.exit(1);
    }
  }

  console.log("\n✨ Tier change notification sent successfully!");
  console.log(
    `   Sponsor @${SPONSOR_LOGIN} has been notified of their ${upgrade ? "upgrade" : "tier change"}.`,
  );
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { getTierChangeMessage, isUpgrade };
