#!/usr/bin/env node

/**
 * Welcome New Sponsor Script
 *
 * Automatically sends a personalized welcome message to new sponsors
 * via GitHub issue or discussion.
 */

const https = require('https');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SPONSOR_LOGIN = process.env.SPONSOR_LOGIN;
const TIER_NAME = process.env.TIER_NAME;
const MONTHLY_AMOUNT = process.env.MONTHLY_AMOUNT || '0';
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || 'zviel';
const REPO_NAME = 'self-streme';

// Tier emoji mapping
const TIER_EMOJIS = {
  'Coffee': '☕',
  'Bronze': '🥉',
  'Silver': '🥈',
  'Gold': '🥇',
  'Diamond': '💎',
  'Platinum': '🌟'
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
  return '⭐';
}

/**
 * Get tier-specific welcome message
 */
function getWelcomeMessage(tierName, amount) {
  const emoji = getTierEmoji(tierName);
  const tier = tierName || 'Supporter';

  let benefits = '';

  if (amount >= 250) {
    benefits = `As a ${emoji} **Platinum Sponsor**, you now have access to:
- 🚨 24/7 critical issue support
- 🎯 Guaranteed feature implementation (within project scope)
- 🏆 Optional named version releases
- 📄 Custom SLA agreement
- 🔧 Dedicated monthly consultation hours
- 💼 White-label licensing options (negotiable)
- 🤝 Partnership opportunities

**Next Steps:**
1. Join our private sponsors-only discussion forum
2. Schedule your first consultation call (link will be sent via email)
3. Review your custom SLA agreement
4. Contact us for white-label licensing options`;
  } else if (amount >= 100) {
    benefits = `As a ${emoji} **Diamond Sponsor**, you now have access to:
- ⚡ Premium support (6-hour response time)
- 🏢 Company logo prominently displayed on README
- 🎯 Direct input on feature development
- 🔒 Private security issue notifications
- 📞 Phone/video support
- 🛠️ Custom deployment assistance
- 📊 Quarterly strategy meetings

**Next Steps:**
1. Send us your company logo (PNG/SVG, 400x400px recommended)
2. Join our sponsors-only discussion forum
3. Schedule your first quarterly strategy meeting`;
  } else if (amount >= 50) {
    benefits = `As a ${emoji} **Gold Sponsor**, you now have access to:
- 🚀 VIP support (12-hour response time)
- 💼 Custom integration assistance
- 🎯 Direct influence on roadmap priorities
- 🎨 Logo on README.md (medium size)
- 📺 Featured on project website (when available)
- 🤝 Monthly video call for feedback/support

**Next Steps:**
1. Send us your logo/avatar (PNG/SVG, 200x200px recommended)
2. Join our sponsors-only discussion forum
3. Schedule your first monthly video call`;
  } else if (amount >= 25) {
    benefits = `As a ${emoji} **Silver Sponsor**, you now have access to:
- ⚡ Priority support (24-hour response time)
- 🔧 Direct technical assistance via email
- 📝 Your name/brand in README.md sponsors section
- 🎨 Logo in project documentation (small)

**Next Steps:**
1. Join our sponsors-only discussion forum
2. Send us your logo/avatar if you'd like to be featured
3. Reach out via email for technical assistance`;
  } else if (amount >= 10) {
    benefits = `As a ${emoji} **Bronze Sponsor**, you now have access to:
- 🏅 Bronze badge in SPONSORS.md
- 📊 Monthly project updates and roadmap insights
- 🎯 Priority bug report responses (within 48 hours)
- 💡 Feature request consideration priority

**Next Steps:**
1. Join our sponsors-only discussion forum
2. Watch for monthly project updates
3. Submit any bug reports or feature requests`;
  } else {
    benefits = `As a ${emoji} **Coffee Supporter**, you now have access to:
- ⭐ Sponsor badge on your GitHub profile
- 🙏 Listed in SPONSORS.md (if you choose)
- 💬 Access to sponsors-only discussions
- 📢 Early announcements of new features

**Next Steps:**
1. Join our sponsors-only discussion forum
2. Let us know if you'd like to be listed publicly in SPONSORS.md`;
  }

  return `# 🎉 Welcome, ${SPONSOR_LOGIN}! Thank You for Sponsoring!

Hi @${SPONSOR_LOGIN},

**Thank you so much for becoming a sponsor of Self-Streme!** 🙏

Your support as a **${tier}** ($${amount}/month) helps us:
- 🔧 Maintain and improve the project
- 🚀 Add new features and optimizations
- 📚 Create better documentation
- 🐛 Fix bugs quickly
- 💬 Provide community support

${benefits}

## 📚 Important Links

- **Sponsors Program Details:** [SPONSORS.md](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/SPONSORS.md)
- **Project Documentation:** [docs/](https://github.com/${REPO_OWNER}/${REPO_NAME}/tree/main/docs)
- **Quick Start Guide:** [QUICK_START.md](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/docs/QUICK_START.md)

## 💬 Stay Connected

- **GitHub Discussions:** [Join the conversation](https://github.com/${REPO_OWNER}/${REPO_NAME}/discussions)
- **GitHub Issues:** [Report bugs or request features](https://github.com/${REPO_OWNER}/${REPO_NAME}/issues)
- **Sponsors Forum:** Check your email for exclusive access link

## 🤝 Get Involved

Your sponsorship entitles you to priority support, but we also welcome:
- 💡 Feature suggestions and ideas
- 🐛 Bug reports (with priority response!)
- 📝 Documentation improvements
- 💻 Code contributions

## ❓ Questions?

If you have any questions about your sponsorship benefits or how to access them:
1. Reply to this discussion
2. Email us directly (check your sponsorship confirmation email)
3. Tag us in the sponsors-only forum

---

**Thank you again for your generous support!** Your contribution makes a real difference in keeping Self-Streme active, maintained, and continuously improving.

We're excited to have you as part of our sponsors community! 🌟

Best regards,
The Self-Streme Team

---

*This is an automated welcome message. For personalized assistance, please reach out via any of the channels above.*`;
}

/**
 * Create GitHub discussion
 */
async function createDiscussion(title, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: title,
      body: body,
      category: 'announcements' // Adjust category as needed
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/discussions`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'Self-Streme-Sponsor-Bot'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`Failed to create discussion: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Create GitHub issue (alternative if discussions not available)
 */
async function createIssue(title, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: title,
      body: body,
      labels: ['sponsor', 'welcome']
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'Self-Streme-Sponsor-Bot'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`Failed to create issue: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
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
  console.log('🎉 Welcome Sponsor Script Starting...\n');

  // Validate environment variables
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }

  if (!SPONSOR_LOGIN) {
    console.error('❌ SPONSOR_LOGIN is required');
    process.exit(1);
  }

  const amount = parseInt(MONTHLY_AMOUNT) || 0;
  const tierName = TIER_NAME || 'Supporter';

  console.log(`👤 Sponsor: @${SPONSOR_LOGIN}`);
  console.log(`💰 Amount: $${amount}/month`);
  console.log(`🎯 Tier: ${tierName}\n`);

  // Generate welcome message
  const message = getWelcomeMessage(tierName, amount);
  const title = `🎉 Welcome New Sponsor: @${SPONSOR_LOGIN}!`;

  // Try to create a discussion first, fall back to issue
  try {
    console.log('📝 Creating welcome discussion...');
    const discussion = await createDiscussion(title, message);
    console.log(`✅ Welcome discussion created: ${discussion.html_url}`);
  } catch (discussionError) {
    console.warn('⚠️  Could not create discussion, trying issue instead...');
    console.warn(`   Reason: ${discussionError.message}`);

    try {
      console.log('📝 Creating welcome issue...');
      const issue = await createIssue(title, message);
      console.log(`✅ Welcome issue created: ${issue.html_url}`);
    } catch (issueError) {
      console.error('❌ Failed to create welcome message:', issueError.message);
      console.log('\n📧 Welcome message (copy manually if needed):');
      console.log('─'.repeat(80));
      console.log(message);
      console.log('─'.repeat(80));
      process.exit(1);
    }
  }

  console.log('\n✨ Welcome message sent successfully!');
  console.log(`   New sponsor @${SPONSOR_LOGIN} has been welcomed.`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { getWelcomeMessage };
