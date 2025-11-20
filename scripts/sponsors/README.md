# 🤖 Sponsors Automation Scripts

This directory contains automated scripts for managing the Self-Streme sponsorship program.

---

## 📁 Scripts Overview

### Core Scripts

#### `update-sponsors.js`
**Purpose:** Automatically updates the sponsors list in `SPONSORS.md`

**Features:**
- Fetches current sponsors from GitHub Sponsors API
- Groups sponsors by tier
- Updates SPONSORS.md with current sponsor list
- Generates sponsor badges
- Updates sponsor count in README.md

**Trigger:** 
- Daily via GitHub Actions (00:00 UTC)
- On sponsor events (created, cancelled, tier_changed)
- Manual dispatch

**Usage:**
```bash
SPONSOR_TOKEN=your_token node scripts/update-sponsors.js
```

---

#### `welcome-sponsor.js`
**Purpose:** Sends personalized welcome message to new sponsors

**Features:**
- Tier-specific welcome messages
- Detailed benefits explanation
- Next steps guidance
- Links to resources
- Creates GitHub Discussion or Issue

**Trigger:** 
- When new sponsor signs up
- Automatically via GitHub Actions

**Usage:**
```bash
SPONSOR_TOKEN=your_token \
SPONSOR_LOGIN=username \
TIER_NAME="Gold Sponsor" \
MONTHLY_AMOUNT=50 \
node scripts/welcome-sponsor.js
```

---

#### `tier-changed.js`
**Purpose:** Handles sponsor tier upgrades/downgrades

**Features:**
- Detects upgrades vs downgrades
- Tier-specific benefit updates
- Congratulations for upgrades
- Next steps based on new tier
- Creates notification discussion

**Trigger:**
- When sponsor changes tier
- Automatically via GitHub Actions

**Usage:**
```bash
SPONSOR_TOKEN=your_token \
SPONSOR_LOGIN=username \
NEW_TIER="Diamond Sponsor" \
OLD_TIER="Gold Sponsor" \
node scripts/tier-changed.js
```

---

#### `cancelled-sponsor.js`
**Purpose:** Gracefully handles sponsor cancellations

**Features:**
- Thank you message
- Impact summary
- Benefit expiration timeline
- Stay connected suggestions
- Feedback request
- Re-sponsorship invitation

**Trigger:**
- When sponsor cancels
- Automatically via GitHub Actions

**Usage:**
```bash
SPONSOR_TOKEN=your_token \
SPONSOR_LOGIN=username \
TIER_NAME="Silver Sponsor" \
node scripts/cancelled-sponsor.js
```

---

#### `monthly-updates.js`
**Purpose:** Sends monthly updates to Bronze+ sponsors

**Features:**
- Recent commits summary
- Closed issues list
- Changelog highlights
- Roadmap updates
- Project statistics
- Sponsor perks reminder

**Trigger:**
- First day of each month
- Automatically via GitHub Actions

**Usage:**
```bash
SPONSOR_TOKEN=your_token node scripts/monthly-updates.js
```

---

#### `sponsor-metrics.js`
**Purpose:** Generates sponsorship analytics and metrics

**Features:**
- Sponsor counts by tier
- Revenue calculations (monthly/annual)
- Duration statistics
- Growth metrics
- Demographics analysis
- Insights and recommendations
- JSON and Markdown reports

**Trigger:**
- Daily via GitHub Actions
- Manual dispatch for analysis

**Usage:**
```bash
SPONSOR_TOKEN=your_token node scripts/sponsor-metrics.js
```

**Output:**
- `metrics/sponsor-metrics.json` - Current metrics
- `metrics/sponsor-metrics-YYYY-MM-DD.json` - Historical snapshot
- `metrics/sponsor-metrics.md` - Readable report

---

## 🚀 GitHub Actions Workflow

All scripts are automated via `.github/workflows/sponsors.yml`

### Workflow Jobs

1. **update-sponsors** - Updates sponsor list daily and on events
2. **welcome-sponsor** - Welcomes new sponsors immediately
3. **tier-changed** - Handles tier changes immediately
4. **cancelled-sponsor** - Thanks departing sponsors
5. **monthly-updates** - Sends updates on 1st of month
6. **sponsor-metrics** - Generates metrics daily

### Workflow Triggers

- `schedule`: Daily at 00:00 UTC
- `sponsor`: On GitHub Sponsors events
- `workflow_dispatch`: Manual trigger

---

## 🔧 Setup & Configuration

### Prerequisites

```bash
# Install dependencies
npm install --save-dev @octokit/rest
```

### Environment Variables

All scripts require:

| Variable | Description | Required |
|----------|-------------|----------|
| `SPONSOR_TOKEN` | GitHub API token with repo and admin:org permissions | ✅ Yes |
| `GITHUB_REPOSITORY_OWNER` | Repository owner (defaults to 'zviel') | ❌ No |
| `SPONSOR_LOGIN` | Sponsor's GitHub username | ✅ Yes (for welcome/tier/cancel) |
| `TIER_NAME` | Sponsor tier name | ✅ Yes (for welcome/tier/cancel) |
| `MONTHLY_AMOUNT` | Sponsorship amount in dollars | ❌ No (for welcome) |
| `NEW_TIER` | New tier name | ✅ Yes (for tier-changed) |
| `OLD_TIER` | Previous tier name | ❌ No (for tier-changed) |

### GitHub Token Permissions

The `SPONSOR_TOKEN` must have:
- ✅ `repo` - Full repository access
- ✅ `admin:org` - Organization administration (for Sponsors API)
- ✅ `write:discussion` - Create and manage discussions
- ✅ `write:issues` - Create issues (fallback)

---

## 📊 Sponsor Tiers

Scripts recognize these tiers:

| Tier | Amount | Response Time | Key Features |
|------|--------|---------------|--------------|
| ☕ Coffee | $5/mo | Standard | Badge, early access |
| 🥉 Bronze | $10/mo | 48h | Priority bugs, monthly updates |
| 🥈 Silver | $25/mo | 24h | Tech support, logo |
| 🥇 Gold | $50/mo | 12h | VIP support, video calls |
| 💎 Diamond | $100/mo | 6h | Enterprise support |
| 🌟 Platinum | $250+/mo | 24/7 | Guaranteed features, SLA |

---

## 🧪 Testing

### Test Individual Scripts

```bash
# Test welcome message (no API call)
SPONSOR_LOGIN=testuser \
TIER_NAME="Bronze Sponsor" \
MONTHLY_AMOUNT=10 \
node scripts/welcome-sponsor.js

# Test metrics with mock data
node scripts/sponsor-metrics.js
```

### Test Workflow Locally

```bash
# Install act (GitHub Actions local runner)
# brew install act (macOS)
# or download from https://github.com/nektos/act

# Run workflow
act sponsor -e test-event.json
```

---

## 📝 Customization

### Modify Welcome Messages

Edit `welcome-sponsor.js` → `getWelcomeMessage()` function

### Modify Tier Benefits

Update benefit descriptions in each script's message generation function

### Change Update Frequency

Edit `.github/workflows/sponsors.yml` → `schedule` cron expression

### Add New Metrics

Extend `sponsor-metrics.js` → `calculateMetrics()` function

---

## 🐛 Troubleshooting

### Common Issues

**"SPONSOR_TOKEN is required"**
- Ensure `SPONSOR_TOKEN` environment variable is set
- Check token has correct permissions

**"Failed to create discussion"**
- Verify GitHub Discussions is enabled on repository
- Scripts will fallback to creating issues

**"Failed to fetch sponsors"**
- Check token has `admin:org` permission
- Verify you have active sponsors on GitHub Sponsors

**No sponsors in output**
- Only public sponsors are shown by default
- Private sponsors require explicit permission

### Debug Mode

Add verbose logging:

```bash
DEBUG=* node scripts/update-sponsors.js
```

### Manual Verification

Check API directly:

```bash
curl -H "Authorization: Bearer $SPONSOR_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/user/sponsorships
```

---

## 📊 Metrics Output

### JSON Format (`sponsor-metrics.json`)

```json
{
  "overview": {
    "totalSponsors": 10,
    "publicSponsors": 8,
    "privateSponsors": 2,
    "monthlyRevenue": 350,
    "annualRevenue": 4200
  },
  "tiers": {
    "counts": { "platinum": 1, "diamond": 2, ... },
    "revenue": { "platinum": 250, "diamond": 200, ... }
  },
  "duration": {
    "average": 45,
    "median": 30
  },
  "activity": {
    "newLast30Days": 2,
    "growthRate": "20.0"
  }
}
```

### Markdown Format (`sponsor-metrics.md`)

Human-readable report with:
- Overview statistics
- Tier distribution charts
- Duration analysis
- Recent activity
- Demographics
- Actionable insights

---

## 🔐 Security

### Best Practices

- ✅ Never commit `SPONSOR_TOKEN` to repository
- ✅ Use GitHub Secrets for CI/CD
- ✅ Rotate tokens regularly
- ✅ Use minimum required permissions
- ✅ Monitor API rate limits

### Data Privacy

- Only public sponsors shown by default
- Private sponsors excluded from public lists
- Email addresses never exposed
- Individual metrics kept confidential

---

## 🤝 Contributing

Improvements welcome! When adding new scripts:

1. Follow existing naming conventions
2. Add proper error handling
3. Include usage documentation
4. Add to GitHub Actions workflow
5. Update this README

---

## 📞 Support

**Issues with automation?**
- Check GitHub Actions logs
- Review script output messages
- Create issue with `automation` label

**Questions about sponsors program?**
- See [SPONSORS.md](../SPONSORS.md)
- Review [SPONSORS_GUIDE.md](../docs/SPONSORS_GUIDE.md)

---

## 📜 License

These scripts are part of Self-Streme and follow the same license.

See [LICENSE](../LICENSE) for details.

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Production Ready  
**Automation Status:** 🤖 Fully Automated
