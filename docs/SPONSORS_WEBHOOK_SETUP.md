# 🔗 GitHub Sponsors Webhook Setup

Guide to setting up webhooks for real-time sponsor event automation.

---

## 📋 Overview

Since GitHub Actions doesn't have native `sponsor` event support, we use `repository_dispatch` events triggered by:
1. **Manual triggers** (for testing)
2. **External webhooks** (for production)
3. **Daily schedule** (fallback)

---

## 🚀 Quick Start

### Option 1: Manual Testing (Recommended for Start)

Use the included trigger script:

```bash
# Set your GitHub token
export SPONSOR_TOKEN="your_SPONSOR_TOKEN"

# Welcome new sponsor
./scripts/trigger-sponsor-event.sh sponsor-created john_doe \
  --tier-name "Gold Sponsor" \
  --monthly-amount 50

# Handle tier change
./scripts/trigger-sponsor-event.sh sponsor-tier-changed jane_doe \
  --new-tier "Platinum Sponsor" \
  --old-tier "Gold Sponsor"

# Handle cancellation
./scripts/trigger-sponsor-event.sh sponsor-cancelled bob_smith \
  --tier-name "Silver Sponsor"
```

### Option 2: GitHub CLI

```bash
# Using gh CLI
gh workflow run sponsors.yml \
  -f event_type=sponsor-created \
  -f sponsor_login=john_doe \
  -f tier_name="Gold Sponsor" \
  -f monthly_amount=50
```

---

## 🔧 Production Setup (External Webhook)

For automatic real-time events, set up an external webhook service.

### Method 1: Zapier/Make/n8n Integration

**Services that support GitHub Sponsors webhooks:**
- Zapier
- Make (formerly Integromat)
- n8n (self-hosted)

**Flow:**
1. GitHub Sponsors → Webhook → Service
2. Service processes event
3. Service triggers GitHub `repository_dispatch`

**Example Zapier Setup:**

```
Trigger: GitHub Sponsors Event
Action: Webhook POST to GitHub API
URL: https://api.github.com/repos/{owner}/{repo}/dispatches
Method: POST
Headers:
  Authorization: Bearer {SPONSOR_TOKEN}
  Accept: application/vnd.github+json
Body:
{
  "event_type": "sponsor-created",
  "client_payload": {
    "sponsor_login": "{{sponsor_login}}",
    "tier_name": "{{tier_name}}",
    "monthly_amount": "{{monthly_amount}}"
  }
}
```

### Method 2: Custom Webhook Server

Create a simple webhook receiver:

```javascript
// webhook-server.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const SPONSOR_TOKEN = process.env.SPONSOR_TOKEN;
const REPO_OWNER = 'zviel';
const REPO_NAME = 'self-streme';

app.post('/sponsor-webhook', async (req, res) => {
  const { action, sponsorship } = req.body;
  
  let eventType;
  switch(action) {
    case 'created':
      eventType = 'sponsor-created';
      break;
    case 'cancelled':
      eventType = 'sponsor-cancelled';
      break;
    case 'tier_changed':
      eventType = 'sponsor-tier-changed';
      break;
    default:
      return res.status(400).send('Unknown action');
  }

  const payload = {
    event_type: eventType,
    client_payload: {
      sponsor_login: sponsorship.sponsor.login,
      tier_name: sponsorship.tier.name,
      monthly_amount: sponsorship.tier.monthly_price_in_dollars
    }
  };

  try {
    await axios.post(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${SPONSOR_TOKEN}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );
    res.status(200).send('Event triggered');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Failed to trigger event');
  }
});

app.listen(3001, () => {
  console.log('Webhook server running on port 3001');
});
```

**Deploy to:**
- Heroku
- Vercel
- Railway
- Any VPS

---

## 🔐 Security

### GitHub Token Permissions

The token needs:
- ✅ `repo` - Repository access
- ✅ `workflow` - Trigger workflows
- ✅ `admin:org` - Access sponsors data (if using scripts)

### Webhook Security

**For custom webhook server:**

```javascript
const crypto = require('crypto');

function verifyWebhook(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  const body = JSON.stringify(req.body);
  const hash = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

app.post('/sponsor-webhook', (req, res) => {
  if (!verifyWebhook(req, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // Process webhook...
});
```

---

## 📊 Event Payloads

### sponsor-created

```json
{
  "event_type": "sponsor-created",
  "client_payload": {
    "sponsor_login": "john_doe",
    "tier_name": "Gold Sponsor",
    "monthly_amount": "50"
  }
}
```

**Triggers:**
- `welcome-sponsor` job
- `update-sponsors` job

### sponsor-cancelled

```json
{
  "event_type": "sponsor-cancelled",
  "client_payload": {
    "sponsor_login": "john_doe",
    "tier_name": "Gold Sponsor"
  }
}
```

**Triggers:**
- `cancelled-sponsor` job
- `update-sponsors` job

### sponsor-tier-changed

```json
{
  "event_type": "sponsor-tier-changed",
  "client_payload": {
    "sponsor_login": "john_doe",
    "new_tier": "Platinum Sponsor",
    "old_tier": "Gold Sponsor"
  }
}
```

**Triggers:**
- `tier-changed` job
- `update-sponsors` job

---

## 🧪 Testing

### Test Workflow Trigger

```bash
# Test with curl
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $SPONSOR_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/zviel/self-streme/dispatches \
  -d '{
    "event_type": "sponsor-created",
    "client_payload": {
      "sponsor_login": "testuser",
      "tier_name": "Bronze Sponsor",
      "monthly_amount": "10"
    }
  }'
```

### Verify Workflow Run

```bash
# Using GitHub CLI
gh run list --workflow=sponsors.yml

# View logs
gh run view --log
```

---

## 🔄 Fallback System

Even without webhooks, the system still works:

### Daily Schedule
- Runs at 00:00 UTC daily
- Updates sponsor list
- Generates metrics
- Sends monthly updates (if 1st of month)

### Manual Triggers
- Use trigger script anytime
- Run via GitHub Actions UI
- Use GitHub CLI

**Result:** Sponsors are always up-to-date within 24 hours maximum.

---

## 🐛 Troubleshooting

### Webhook not triggering workflow

**Check:**
1. Event type matches workflow (`sponsor-created`, etc.)
2. Token has `repo` and `workflow` permissions
3. Repository name is correct
4. Payload format is correct JSON

**Debug:**
```bash
# Check workflow runs
gh run list --workflow=sponsors.yml --limit 10

# View failed run logs
gh run view <run-id> --log
```

### Script execution fails

**Common issues:**
- Missing `@octokit/rest`: `npm install --save-dev @octokit/rest`
- Wrong environment variables
- Token permissions insufficient

**Debug:**
```bash
# Test script locally
SPONSOR_TOKEN=your_token \
SPONSOR_LOGIN=testuser \
TIER_NAME="Bronze Sponsor" \
MONTHLY_AMOUNT=10 \
node scripts/welcome-sponsor.js
```

### Events not reaching GitHub

**Verify webhook:**
```bash
# Check repository_dispatch endpoint
curl -X POST \
  -H "Authorization: Bearer $SPONSOR_TOKEN" \
  https://api.github.com/repos/zviel/self-streme/dispatches \
  -d '{"event_type": "test"}'
```

If you get 204 response, webhook is working.

---

## 📈 Monitoring

### Check Workflow Runs

**Via GitHub UI:**
1. Go to Actions tab
2. Select "Sponsor Management Automation"
3. View run history

**Via GitHub CLI:**
```bash
# List recent runs
gh run list --workflow=sponsors.yml

# Watch workflow in real-time
gh run watch
```

### Monitor Metrics

```bash
# View latest metrics
cat metrics/sponsor-metrics.json

# View report
cat metrics/sponsor-metrics.md
```

---

## 🔗 Alternative Approaches

### 1. GitHub Apps

Create a GitHub App that listens to sponsor events:
- More complex setup
- Better authentication
- Official GitHub integration

### 2. Probot

Use Probot framework:
- JavaScript-based
- Easy to deploy
- Handles webhooks automatically

### 3. GitHub Actions Marketplace

Check for sponsor automation actions:
- Community-maintained
- Ready-to-use
- May have limitations

---

## 📋 Checklist

### Initial Setup
- [ ] GitHub Sponsors activated
- [ ] Workflow file in place (`.github/workflows/sponsors.yml`)
- [ ] Scripts installed (`scripts/*.js`)
- [ ] Dependencies installed (`npm install`)
- [ ] GitHub token configured

### Webhook Setup (Optional)
- [ ] Webhook service chosen (Zapier/custom/etc)
- [ ] Webhook configured to trigger `repository_dispatch`
- [ ] Test event sent successfully
- [ ] Workflow triggered by webhook

### Testing
- [ ] Manual trigger test passed
- [ ] Welcome message created
- [ ] Sponsor list updated
- [ ] Metrics generated

### Production
- [ ] Webhooks configured (or relying on daily schedule)
- [ ] Monitoring in place
- [ ] Documentation reviewed by team
- [ ] Sponsors notified of automation

---

## 💡 Best Practices

1. **Start Simple**
   - Use daily schedule first
   - Add webhooks later if needed

2. **Test Thoroughly**
   - Use manual triggers for testing
   - Verify each event type
   - Check all scripts work

3. **Monitor Regularly**
   - Check Actions tab weekly
   - Review metrics monthly
   - Update scripts as needed

4. **Keep Token Secure**
   - Never commit tokens
   - Use GitHub Secrets
   - Rotate regularly

5. **Document Changes**
   - Update docs when modifying scripts
   - Note any custom configurations
   - Share with team

---

## 📞 Support

**Issues with webhooks?**
- Check GitHub Actions logs
- Review script output
- Create issue with `automation` label

**Questions about setup?**
- See [SPONSORS_AUTOMATION.md](SPONSORS_AUTOMATION.md)
- Review [scripts/sponsors/README.md](../scripts/sponsors/README.md)

---

## 🎯 Summary

**Without Webhooks (Default):**
- Daily updates at 00:00 UTC
- Manual triggers available
- 24-hour maximum delay
- ✅ Simple, reliable

**With Webhooks (Optional):**
- Real-time updates (< 1 minute)
- Automatic event handling
- Better user experience
- ⚡ Fast, professional

**Both approaches work!** Choose based on your needs.

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Production Ready  
**Recommended:** Start with daily schedule, add webhooks if needed

For complete automation guide, see [SPONSORS_AUTOMATION.md](../SPONSORS_AUTOMATION.md)
