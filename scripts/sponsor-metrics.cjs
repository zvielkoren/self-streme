SPONSOR_TOKENSPONSOR_TOKEN#!/usr/bin/env node

/**
 * Sponsor Metrics Generator
 *
 * Generates analytics and metrics about the sponsorship program,
 * including sponsor counts, revenue, retention, and trends.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Configuration
const SPONSOR_TOKEN = process.env.SPONSOR_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "zviel";
const REPO_NAME = "self-streme";

// Tier configuration
const TIERS = {
  platinum: { min: 250, name: "Platinum", emoji: "🌟" },
  diamond: { min: 100, max: 249, name: "Diamond", emoji: "💎" },
  gold: { min: 50, max: 99, name: "Gold", emoji: "🥇" },
  silver: { min: 25, max: 49, name: "Silver", emoji: "🥈" },
  bronze: { min: 10, max: 24, name: "Bronze", emoji: "🥉" },
  coffee: { min: 5, max: 9, name: "Coffee", emoji: "☕" },
};

/**
 * Fetch all sponsors (including private)
 */
async function fetchAllSponsors() {
  if (!SPONSOR_TOKEN) {
    console.warn("⚠️  SPONSOR_TOKEN not set. Using mock data.");
    return getMockSponsors();
  }

  try {
    const { Octokit } = require("@octokit/rest");
    const octokit = new Octokit({ auth: SPONSOR_TOKEN });

    const response = await octokit.graphql(`
      query {
        user(login: "${REPO_OWNER}") {
          sponsorshipsAsMaintainer(first: 100, includePrivate: true) {
            totalCount
            nodes {
              sponsor {
                login
                name
                ... on User {
                  company
                  location
                }
                ... on Organization {
                  name
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

    const sponsorships = response.user.sponsorshipsAsMaintainer;

    return {
      total: sponsorships.totalCount,
      sponsors: sponsorships.nodes.map((s) => ({
        login: s.sponsor.login,
        name: s.sponsor.name || s.sponsor.login,
        company: s.sponsor.company,
        location: s.sponsor.location,
        amount: s.tier.monthlyPriceInDollars,
        tierName: s.tier.name,
        since: new Date(s.createdAt),
        isPrivate: s.privacyLevel === "PRIVATE",
        durationDays: Math.floor(
          (Date.now() - new Date(s.createdAt)) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  } catch (error) {
    console.error("❌ Error fetching sponsors:", error.message);
    return { total: 0, sponsors: [] };
  }
}

/**
 * Mock sponsors for testing
 */
function getMockSponsors() {
  return {
    total: 0,
    sponsors: [],
  };
}

/**
 * Get tier for amount
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
 * Calculate metrics
 */
function calculateMetrics(data) {
  const { total, sponsors } = data;

  // Basic counts
  const publicSponsors = sponsors.filter((s) => !s.isPrivate);
  const privateSponsors = sponsors.filter((s) => s.isPrivate);

  // Revenue
  const totalMonthlyRevenue = sponsors.reduce((sum, s) => sum + s.amount, 0);
  const totalAnnualRevenue = totalMonthlyRevenue * 12;

  // Tier distribution
  const tierCounts = {};
  const tierRevenue = {};
  Object.keys(TIERS).forEach((key) => {
    tierCounts[key] = 0;
    tierRevenue[key] = 0;
  });

  sponsors.forEach((sponsor) => {
    const tier = getTier(sponsor.amount);
    if (tier) {
      tierCounts[tier.key]++;
      tierRevenue[tier.key] += sponsor.amount;
    }
  });

  // Duration stats
  const durations = sponsors.map((s) => s.durationDays);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
  const medianDuration =
    durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      : 0;

  // Recent activity (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newSponsorsLast30Days = sponsors.filter(
    (s) => s.since.getTime() >= thirtyDaysAgo,
  ).length;

  // Geography (if available)
  const locations = {};
  sponsors.forEach((s) => {
    if (s.location) {
      locations[s.location] = (locations[s.location] || 0) + 1;
    }
  });

  // Companies
  const companies = {};
  sponsors.forEach((s) => {
    if (s.company) {
      companies[s.company] = (companies[s.company] || 0) + 1;
    }
  });

  return {
    overview: {
      totalSponsors: total,
      publicSponsors: publicSponsors.length,
      privateSponsors: privateSponsors.length,
      monthlyRevenue: totalMonthlyRevenue,
      annualRevenue: totalAnnualRevenue,
      avgSponsorAmount: total > 0 ? totalMonthlyRevenue / total : 0,
    },
    tiers: {
      counts: tierCounts,
      revenue: tierRevenue,
    },
    duration: {
      average: Math.round(avgDuration),
      median: medianDuration,
      total: durations.reduce((sum, d) => sum + d, 0),
    },
    activity: {
      newLast30Days: newSponsorsLast30Days,
      growthRate:
        total > 0 ? ((newSponsorsLast30Days / total) * 100).toFixed(1) : 0,
    },
    demographics: {
      locations: Object.entries(locations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      companies: Object.entries(companies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate metrics report (markdown)
 */
function generateMarkdownReport(metrics) {
  const { overview, tiers, duration, activity, demographics } = metrics;

  return `# 📊 Sponsor Metrics Report

**Generated:** ${new Date(metrics.timestamp).toLocaleString()}

---

## 📈 Overview

| Metric | Value |
|--------|-------|
| Total Sponsors | ${overview.totalSponsors} |
| Public Sponsors | ${overview.publicSponsors} |
| Private Sponsors | ${overview.privateSponsors} |
| Monthly Revenue | $${overview.monthlyRevenue.toFixed(2)} |
| Annual Revenue (Projected) | $${overview.annualRevenue.toFixed(2)} |
| Average Sponsor Amount | $${overview.avgSponsorAmount.toFixed(2)}/mo |

---

## 💎 Tier Distribution

### Sponsor Count by Tier

| Tier | Count | Monthly Revenue |
|------|-------|-----------------|
${Object.entries(TIERS)
  .reverse()
  .map(
    ([key, tier]) =>
      `| ${tier.emoji} ${tier.name} | ${tiers.counts[key]} | $${tiers.revenue[key].toFixed(2)} |`,
  )
  .join("\n")}

### Visual Distribution

\`\`\`
${Object.entries(TIERS)
  .reverse()
  .map(([key, tier]) => {
    const count = tiers.counts[key];
    const bar = "█".repeat(count) + "░".repeat(Math.max(0, 10 - count));
    return `${tier.emoji} ${tier.name.padEnd(8)} [${bar}] ${count}`;
  })
  .join("\n")}
\`\`\`

---

## ⏱️ Duration Statistics

| Metric | Days |
|--------|------|
| Average Duration | ${duration.average} days (${(duration.average / 30).toFixed(1)} months) |
| Median Duration | ${duration.median} days |
| Total Sponsorship Days | ${duration.total} days |

**Retention Rate:** ${duration.average > 30 ? "Good ✅" : "Needs Improvement ⚠️"}

---

## 🚀 Recent Activity

| Metric | Value |
|--------|-------|
| New Sponsors (Last 30 Days) | ${activity.newLast30Days} |
| Growth Rate | ${activity.growthRate}% |

**Trend:** ${activity.newLast30Days > 0 ? "Growing 📈" : "Stable 📊"}

---

## 🌍 Demographics

### Top Locations
${
  demographics.locations.length > 0
    ? demographics.locations
        .map(([loc, count]) => `- ${loc}: ${count} sponsor(s)`)
        .join("\n")
    : "*No location data available*"
}

### Top Companies
${
  demographics.companies.length > 0
    ? demographics.companies
        .map(([company, count]) => `- ${company}: ${count} sponsor(s)`)
        .join("\n")
    : "*No company data available*"
}

---

## 💡 Insights

${generateInsights(metrics)}

---

**Note:** This report includes both public and private sponsors (where permitted).
Individual sponsor information is kept confidential.

*Generated by Self-Streme Sponsor Metrics*
`;
}

/**
 * Generate insights based on metrics
 */
function generateInsights(metrics) {
  const insights = [];
  const { overview, tiers, duration, activity } = metrics;

  // Revenue insights
  if (overview.monthlyRevenue === 0) {
    insights.push(
      "- 🎯 **No active sponsors yet** - Consider promoting your sponsorship program",
    );
  } else if (overview.monthlyRevenue < 100) {
    insights.push("- 💡 **Early stage** - Focus on growing your sponsor base");
  } else if (overview.monthlyRevenue >= 500) {
    insights.push("- 🌟 **Strong support** - Excellent sponsorship revenue!");
  }

  // Tier insights
  const highTierCount =
    tiers.counts.platinum + tiers.counts.diamond + tiers.counts.gold;
  if (highTierCount > overview.totalSponsors * 0.3) {
    insights.push(
      "- 💎 **Premium sponsors** - High percentage of premium tier sponsors",
    );
  }

  // Duration insights
  if (duration.average > 90) {
    insights.push("- 🎖️ **Great retention** - Sponsors are staying long-term!");
  } else if (duration.average < 30) {
    insights.push(
      "- ⚠️ **Retention opportunity** - Focus on keeping sponsors engaged",
    );
  }

  // Growth insights
  if (activity.newLast30Days >= overview.totalSponsors * 0.2) {
    insights.push("- 📈 **Rapid growth** - 20%+ growth in the last 30 days!");
  } else if (activity.newLast30Days === 0 && overview.totalSponsors > 0) {
    insights.push(
      "- 📊 **Stable base** - No new sponsors recently, consider marketing",
    );
  }

  // Distribution insights
  const tierDistribution = Object.values(tiers.counts);
  const maxTier = Math.max(...tierDistribution);
  if (maxTier === tiers.counts.coffee || maxTier === tiers.counts.bronze) {
    insights.push(
      "- 💡 **Upgrade opportunity** - Many low-tier sponsors could be upgraded",
    );
  }

  return insights.length > 0
    ? insights.join("\n")
    : "- 📊 Continue monitoring metrics for insights";
}

/**
 * Save metrics to file
 */
function saveMetrics(metrics, format = "json") {
  const metricsDir = path.join(__dirname, "..", "metrics");

  // Create metrics directory if it doesn't exist
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split("T")[0];

  if (format === "json") {
    const jsonPath = path.join(metricsDir, "sponsor-metrics.json");
    const historyPath = path.join(
      metricsDir,
      `sponsor-metrics-${timestamp}.json`,
    );

    fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2));
    fs.writeFileSync(historyPath, JSON.stringify(metrics, null, 2));

    console.log(`✅ JSON metrics saved to: ${jsonPath}`);
    console.log(`✅ History saved to: ${historyPath}`);
  }

  if (format === "markdown" || format === "both") {
    const mdPath = path.join(metricsDir, "sponsor-metrics.md");
    const report = generateMarkdownReport(metrics);

    fs.writeFileSync(mdPath, report);
    console.log(`✅ Markdown report saved to: ${mdPath}`);
  }
}

/**
 * Display metrics summary
 */
function displaySummary(metrics) {
  const { overview, tiers, duration, activity } = metrics;

  console.log("\n📊 SPONSOR METRICS SUMMARY");
  console.log("═".repeat(60));
  console.log(
    `Total Sponsors:      ${overview.totalSponsors} (${overview.publicSponsors} public, ${overview.privateSponsors} private)`,
  );
  console.log(`Monthly Revenue:     $${overview.monthlyRevenue.toFixed(2)}`);
  console.log(`Annual Projection:   $${overview.annualRevenue.toFixed(2)}`);
  console.log(
    `Average Amount:      $${overview.avgSponsorAmount.toFixed(2)}/month`,
  );
  console.log("─".repeat(60));
  console.log("Tier Distribution:");
  Object.entries(TIERS)
    .reverse()
    .forEach(([key, tier]) => {
      const count = tiers.counts[key];
      const revenue = tiers.revenue[key];
      if (count > 0) {
        console.log(
          `  ${tier.emoji} ${tier.name.padEnd(8)}: ${count} sponsors ($${revenue.toFixed(2)}/mo)`,
        );
      }
    });
  console.log("─".repeat(60));
  console.log(
    `Average Duration:    ${duration.average} days (${(duration.average / 30).toFixed(1)} months)`,
  );
  console.log(
    `New Last 30 Days:    ${activity.newLast30Days} (${activity.growthRate}% growth)`,
  );
  console.log("═".repeat(60));
}

/**
 * Main execution
 */
async function main() {
  console.log("📊 Sponsor Metrics Generator Starting...\n");

  // Validate environment
  if (!SPONSOR_TOKEN) {
    console.warn("⚠️  SPONSOR_TOKEN not set. Metrics will be limited.");
  }

  // Fetch sponsor data
  console.log("📡 Fetching sponsor data from GitHub...");
  const data = await fetchAllSponsors();
  console.log(`✅ Fetched data for ${data.total} sponsor(s)\n`);

  // Calculate metrics
  console.log("🔢 Calculating metrics...");
  const metrics = calculateMetrics(data);
  console.log("✅ Metrics calculated\n");

  // Display summary
  displaySummary(metrics);

  // Save metrics
  console.log("\n💾 Saving metrics...");
  saveMetrics(metrics, "json");
  saveMetrics(metrics, "markdown");

  console.log("\n✨ Metrics generation complete!");
  console.log(`   View JSON: metrics/sponsor-metrics.json`);
  console.log(`   View Report: metrics/sponsor-metrics.md`);
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { calculateMetrics, fetchAllSponsors, generateMarkdownReport };
