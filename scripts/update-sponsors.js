#!/usr/bin/env node

/**
 * Automated Sponsor List Updater
 *
 * This script fetches current sponsors from GitHub Sponsors API
 * and updates SPONSORS.md with the latest information.
 */

const fs = require("fs");
const path = require("path");

// GitHub API configuration
const SPONSOR_TOKEN = process.env.SPONSOR_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "zviel";
const REPO_NAME = "self-streme";

// Tier configuration matching SPONSORS.md
const TIERS = {
  platinum: { min: 250, name: "Platinum", emoji: "🌟" },
  diamond: { min: 100, max: 249, name: "Diamond", emoji: "💎" },
  gold: { min: 50, max: 99, name: "Gold", emoji: "🥇" },
  silver: { min: 25, max: 49, name: "Silver", emoji: "🥈" },
  bronze: { min: 10, max: 24, name: "Bronze", emoji: "🥉" },
  coffee: { min: 5, max: 9, name: "Coffee", emoji: "☕" },
};

/**
 * Fetch sponsors from GitHub API
 */
async function fetchSponsors() {
  if (!SPONSOR_TOKEN) {
    console.warn("⚠️  SPONSOR_TOKEN not set. Using mock data for testing.");
    return getMockSponsors();
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
                avatarUrl
                url
                ... on User {
                  company
                  location
                }
                ... on Organization {
                  description
                }
              }
              tier {
                monthlyPriceInDollars
                name
              }
              createdAt
              privacyLevel
            }
          }
        }
      }
    `);

    const sponsors = response.user.sponsorshipsAsMaintainer.nodes
      .filter((s) => s.privacyLevel === "PUBLIC")
      .map((s) => ({
        login: s.sponsor.login,
        name: s.sponsor.name || s.sponsor.login,
        avatarUrl: s.sponsor.avatarUrl,
        url: s.sponsor.url,
        company: s.sponsor.company,
        location: s.sponsor.location,
        description: s.sponsor.description,
        amount: s.tier.monthlyPriceInDollars,
        tierName: s.tier.name,
        since: new Date(s.createdAt).toISOString().split("T")[0],
      }));

    return sponsors;
  } catch (error) {
    console.error("❌ Error fetching sponsors:", error.message);
    return [];
  }
}

/**
 * Mock sponsors for testing (when SPONSOR_TOKEN not available)
 */
function getMockSponsors() {
  return [
    // Add mock sponsors here for testing
    // { login: 'testuser', name: 'Test User', amount: 10, ... }
  ];
}

/**
 * Categorize sponsor by tier based on amount
 */
function getTier(amount) {
  for (const [key, tier] of Object.entries(TIERS)) {
    if (amount >= tier.min && (!tier.max || amount <= tier.max)) {
      return { key, ...tier };
    }
  }
  return null;
}

/**
 * Group sponsors by tier
 */
function groupSponsorsByTier(sponsors) {
  const grouped = {
    platinum: [],
    diamond: [],
    gold: [],
    silver: [],
    bronze: [],
    coffee: [],
  };

  sponsors.forEach((sponsor) => {
    const tier = getTier(sponsor.amount);
    if (tier) {
      grouped[tier.key].push(sponsor);
    }
  });

  // Sort each tier by amount (descending) then by name
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.name.localeCompare(b.name);
    });
  });

  return grouped;
}

/**
 * Format sponsor entry for markdown
 */
function formatSponsor(sponsor, tier) {
  const badge = `${tier.emoji} **${tier.name}**`;
  const name = sponsor.url ? `[${sponsor.name}](${sponsor.url})` : sponsor.name;
  const login = `@${sponsor.login}`;
  const amount = `$${sponsor.amount}/mo`;
  const since = `since ${sponsor.since}`;

  let line = `- ${badge} ${name} (${login}) - ${amount} - ${since}`;

  if (sponsor.company) {
    line += ` - ${sponsor.company}`;
  }

  return line;
}

/**
 * Generate sponsors section content
 */
function generateSponsorsSection(groupedSponsors) {
  let content = "";
  let totalSponsors = 0;
  let totalAmount = 0;

  // Generate each tier section
  const tierOrder = [
    "platinum",
    "diamond",
    "gold",
    "silver",
    "bronze",
    "coffee",
  ];

  tierOrder.forEach((tierKey) => {
    const tier = TIERS[tierKey];
    const sponsors = groupedSponsors[tierKey];

    content += `### ${tier.emoji} ${tier.name} Sponsors\n`;

    if (sponsors.length === 0) {
      content += `*Be the first ${tier.name} Sponsor!*\n\n`;
    } else {
      sponsors.forEach((sponsor) => {
        content += formatSponsor(sponsor, tier) + "\n";
        totalSponsors++;
        totalAmount += sponsor.amount;
      });
      content += "\n";
    }
  });

  // Add statistics
  if (totalSponsors > 0) {
    content += `---\n\n`;
    content += `**Total Sponsors:** ${totalSponsors}\n`;
    content += `**Monthly Support:** $${totalAmount}\n`;
    content += `**Last Updated:** ${new Date().toISOString().split("T")[0]}\n\n`;
  }

  return content;
}

/**
 * Update SPONSORS.md file
 */
function updateSponsorsFile(content) {
  const sponsorsPath = path.join(__dirname, "..", "..", "SPONSORS.md");

  if (!fs.existsSync(sponsorsPath)) {
    console.error("❌ SPONSORS.md not found!");
    process.exit(1);
  }

  let fileContent = fs.readFileSync(sponsorsPath, "utf8");

  // Find the section to replace (between "## 🏆 Current Sponsors" and the next "##")
  const startMarker = "## 🏆 Current Sponsors";
  const startIndex = fileContent.indexOf(startMarker);

  if (startIndex === -1) {
    console.error('❌ Could not find "## 🏆 Current Sponsors" section!');
    process.exit(1);
  }

  // Find the next section (next ## heading)
  const afterStart = fileContent.substring(startIndex + startMarker.length);
  const nextSectionMatch = afterStart.match(/\n## /);
  const endIndex = nextSectionMatch
    ? startIndex + startMarker.length + nextSectionMatch.index
    : fileContent.length;

  // Replace the section
  const before = fileContent.substring(0, startIndex + startMarker.length);
  const after = fileContent.substring(endIndex);

  const newContent = before + "\n\n" + content + after;

  fs.writeFileSync(sponsorsPath, newContent, "utf8");
  console.log("✅ Updated SPONSORS.md");
}

/**
 * Update README.md with sponsor count
 */
function updateReadme(totalSponsors) {
  const readmePath = path.join(__dirname, "..", "..", "README.md");

  if (!fs.existsSync(readmePath)) {
    console.warn("⚠️  README.md not found, skipping update");
    return;
  }

  let content = fs.readFileSync(readmePath, "utf8");

  // Update sponsor count if there's a placeholder
  // This is optional - only updates if specific marker exists
  const marker = "<!-- SPONSOR_COUNT -->";
  if (content.includes(marker)) {
    content = content.replace(
      new RegExp(`${marker}\\d+`, "g"),
      `${marker}${totalSponsors}`,
    );
    fs.writeFileSync(readmePath, content, "utf8");
    console.log("✅ Updated README.md with sponsor count");
  }
}

/**
 * Generate sponsor badge for README
 */
function generateSponsorBadge(sponsors) {
  const totalAmount = sponsors.reduce((sum, s) => sum + s.amount, 0);
  const count = sponsors.length;

  return {
    count,
    totalAmount,
    badge: `[![Sponsors](https://img.shields.io/badge/Sponsors-${count}-pink)](https://github.com/sponsors/${REPO_OWNER})`,
    amountBadge: `[![Monthly Support](https://img.shields.io/badge/Monthly%20Support-$${totalAmount}-green)](https://github.com/sponsors/${REPO_OWNER})`,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Starting sponsor list update...\n");

  // Fetch sponsors
  console.log("📡 Fetching sponsors from GitHub...");
  const sponsors = await fetchSponsors();
  console.log(`✅ Found ${sponsors.length} public sponsor(s)\n`);

  if (sponsors.length === 0) {
    console.log(
      'ℹ️  No public sponsors yet. SPONSORS.md will show "Be the first!" messages.',
    );
  }

  // Group by tier
  console.log("📊 Grouping sponsors by tier...");
  const groupedSponsors = groupSponsorsByTier(sponsors);

  // Show summary
  Object.entries(groupedSponsors).forEach(([tier, list]) => {
    if (list.length > 0) {
      console.log(
        `   ${TIERS[tier].emoji} ${TIERS[tier].name}: ${list.length}`,
      );
    }
  });
  console.log();

  // Generate content
  console.log("✍️  Generating sponsor section content...");
  const content = generateSponsorsSection(groupedSponsors);

  // Update files
  console.log("💾 Updating SPONSORS.md...");
  updateSponsorsFile(content);

  console.log("💾 Updating README.md...");
  updateReadme(sponsors.length);

  // Generate badges
  const badges = generateSponsorBadge(sponsors);
  console.log("\n📛 Sponsor badges:");
  console.log(badges.badge);
  console.log(badges.amountBadge);

  console.log("\n✨ Sponsor list update complete!");
  console.log(`   Total sponsors: ${sponsors.length}`);
  console.log(`   Monthly support: $${badges.totalAmount}`);
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  fetchSponsors,
  groupSponsorsByTier,
  generateSponsorsSection,
};
