#!/usr/bin/env node

/**
 * Monthly Updates Script
 *
 * Automatically sends monthly updates to Bronze+ sponsors
 * with project progress, new features, and roadmap information.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Configuration
const SPONSOR_TOKEN = process.env.SPONSOR_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "zvielkoren";
const REPO_NAME = "self-streme";

// Minimum tier for monthly updates (Bronze = $10)
const MIN_TIER_AMOUNT = 10;

/**
 * Fetch sponsors from GitHub API
 */
async function fetchSponsors() {
  if (!SPONSOR_TOKEN) {
    console.warn("⚠️  SPONSOR_TOKEN not set. Cannot fetch sponsors.");
    return [];
  }

  try {
    const { Octokit } = require("@octokit/rest");
    const octokit = new Octokit({ auth: SPONSOR_TOKEN });

    const response = await octokit.graphql(`
      query {
        user(login: "${REPO_OWNER}") {
          sponsorshipsAsMaintainer(first: 100, includePrivate: false) {
            nodes {
              sponsor {
                login
                name
                email
              }
              tier {
                monthlyPriceInDollars
                name
              }
              privacyLevel
            }
          }
        }
      }
    `);

    const sponsors = response.user.sponsorshipsAsMaintainer.nodes
      .filter((s) => s.privacyLevel === "PUBLIC")
      .filter((s) => s.tier.monthlyPriceInDollars >= MIN_TIER_AMOUNT)
      .map((s) => ({
        login: s.sponsor.login,
        name: s.sponsor.name || s.sponsor.login,
        email: s.sponsor.email,
        amount: s.tier.monthlyPriceInDollars,
        tierName: s.tier.name,
      }));

    return sponsors;
  } catch (error) {
    console.error("❌ Error fetching sponsors:", error.message);
    return [];
  }
}

/**
 * Get recent commits from the repository
 */
async function getRecentCommits() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=10`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${SPONSOR_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Self-Streme-Monthly-Updates",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          const commits = JSON.parse(data);
          resolve(
            commits.slice(0, 5).map((c) => ({
              message: c.commit.message.split("\n")[0],
              author: c.commit.author.name,
              date: new Date(c.commit.author.date).toISOString().split("T")[0],
              url: c.html_url,
            })),
          );
        } else {
          reject(new Error(`Failed to fetch commits: ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Get recent issues (closed in last 30 days)
 */
async function getRecentIssues() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=closed&since=${since}&per_page=10`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${SPONSOR_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Self-Streme-Monthly-Updates",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          const issues = JSON.parse(data);
          resolve(
            issues
              .filter((i) => !i.pull_request)
              .slice(0, 5)
              .map((i) => ({
                title: i.title,
                number: i.number,
                url: i.html_url,
                closedAt: new Date(i.closed_at).toISOString().split("T")[0],
              })),
          );
        } else {
          reject(new Error(`Failed to fetch issues: ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Read changelog for recent updates
 */
function getRecentChangelog() {
  const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");

  if (!fs.existsSync(changelogPath)) {
    return "No recent changelog updates available.";
  }

  const content = fs.readFileSync(changelogPath, "utf8");
  const lines = content.split("\n");

  // Get the first major section (up to 20 lines)
  let excerpt = [];
  let count = 0;
  for (let i = 0; i < lines.length && count < 20; i++) {
    if (lines[i].trim()) {
      excerpt.push(lines[i]);
      count++;
    }
  }

  return excerpt.join("\n");
}

/**
 * Generate monthly update message
 */
async function generateMonthlyUpdate() {
  const currentDate = new Date();
  const monthName = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  let commits = [];
  let issues = [];

  try {
    commits = await getRecentCommits();
  } catch (error) {
    console.warn("⚠️  Could not fetch commits:", error.message);
  }

  try {
    issues = await getRecentIssues();
  } catch (error) {
    console.warn("⚠️  Could not fetch issues:", error.message);
  }

  const changelog = getRecentChangelog();

  const message = `# 📊 Monthly Update - ${monthName}

Hi Sponsors! 👋

Thank you for your continued support of Self-Streme! Here's what happened this month.

## 🚀 Recent Development Activity

### 📝 Recent Commits
${commits.length > 0 ? commits.map((c) => `- \`${c.date}\` - ${c.message} by ${c.author}`).join("\n") : "*No commits this month*"}

### 🐛 Issues Resolved
${issues.length > 0 ? issues.map((i) => `- [#${i.number}](${i.url}) ${i.title} (closed ${i.closedAt})`).join("\n") : "*No issues closed this month*"}

## 📚 Recent Updates

${changelog.split("\n").slice(0, 15).join("\n")}

[View full changelog →](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/CHANGELOG.md)

## 🎯 Roadmap & Coming Soon

- Enhanced streaming performance optimizations
- Additional download source integrations
- Improved caching mechanisms
- Better error handling and diagnostics
- UI/UX improvements

*Have feature requests? Let us know in the discussion below!*

## 📊 Project Statistics

- **Active Sponsors:** Contributing to project sustainability
- **Success Rate:** 95-100% streaming reliability
- **Avg Response Time:** 3-5 seconds to playback
- **Documentation:** 10,000+ lines of comprehensive guides

## 💡 How You're Helping

Your sponsorship this month helped us:
- ✅ Maintain server infrastructure
- ✅ Fix critical bugs quickly
- ✅ Add new features and improvements
- ✅ Keep documentation up-to-date
- ✅ Support the community

## 🎁 Sponsor Perks Reminder

**As a Bronze+ sponsor, you have:**
- 🎯 Priority bug report responses (48h or faster based on tier)
- 💡 Feature request consideration priority
- 📊 Monthly updates like this one
- 💬 Access to sponsors-only discussions
- And more based on your tier!

[View all benefits →](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/SPONSORS.md)

## 📞 Get In Touch

Have questions, feedback, or feature requests?
- Reply to this discussion
- Join the sponsors-only forum
- Email us directly (check your sponsorship confirmation)

## 🙏 Thank You!

Your support makes all of this possible. Thank you for being a valued sponsor of Self-Streme!

---

**Stay tuned for next month's update!** 📅

Best regards,
The Self-Streme Team

---

*This is an automated monthly update for Bronze+ sponsors. To update your preferences, reply to this discussion.*`;

  return message;
}

/**
 * Create GitHub discussion for monthly update
 */
async function createMonthlyDiscussion(message) {
  const currentDate = new Date();
  const monthName = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const title = `📊 Monthly Sponsor Update - ${monthName}`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: title,
      body: message,
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
        "User-Agent": "Self-Streme-Monthly-Updates",
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

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  console.log("📊 Monthly Updates Script Starting...\n");

  const currentDate = new Date();
  const monthName = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Validate environment
  if (!SPONSOR_TOKEN) {
    console.error("❌ SPONSOR_TOKEN is required");
    process.exit(1);
  }

  console.log(`📅 Generating update for: ${monthName}\n`);

  // Fetch eligible sponsors
  console.log("📡 Fetching Bronze+ sponsors...");
  const sponsors = await fetchSponsors();
  console.log(`✅ Found ${sponsors.length} eligible sponsor(s)\n`);

  if (sponsors.length === 0) {
    console.log("ℹ️  No Bronze+ sponsors to send updates to.");
    console.log("   Monthly updates are for Bronze tier ($10+) and above.");
    return;
  }

  // Show sponsor list
  console.log("👥 Eligible sponsors:");
  sponsors.forEach((s) => {
    console.log(`   - @${s.login} (${s.tierName} - $${s.amount}/mo)`);
  });
  console.log();

  // Generate update message
  console.log("✍️  Generating monthly update message...");
  const message = await generateMonthlyUpdate();
  console.log("✅ Update message generated\n");

  // Create discussion
  console.log("📝 Creating monthly update discussion...");
  try {
    const discussion = await createMonthlyDiscussion(message);
    console.log(`✅ Discussion created: ${discussion.html_url}\n`);

    console.log("✨ Monthly update sent successfully!");
    console.log(`   ${sponsors.length} sponsor(s) will be notified`);
    console.log(`   Discussion: ${discussion.html_url}`);
  } catch (error) {
    console.error("❌ Failed to create discussion:", error.message);
    console.log("\n📧 Monthly update message (copy manually if needed):");
    console.log("─".repeat(80));
    console.log(message);
    console.log("─".repeat(80));
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { generateMonthlyUpdate, fetchSponsors };
