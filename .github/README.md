# .github Folder

This folder contains GitHub-specific configuration files for Self-Streme repository management.

---

## 📋 Contents

### Issue Templates
- **bug_report.yml** - Bug report template with structured fields
- **feature_request.yml** - Feature request template
- **config.yml** - Issue template configuration

### Pull Request
- **pull_request_template.md** - PR template with checklist

### Workflows
- **pr-checks.yml** - Automated checks for pull requests
  - Linting
  - Testing (Node 18 & 20)
  - Build verification
  - Security audit
  - PR title validation
  - File size checks
  - Code quality checks

### Configuration
- **labeler.yml** - Auto-labeling configuration for PRs
- **settings.yml** - Repository settings (requires Probot Settings app)
- **CODEOWNERS** - Code ownership and review assignments

---

## 🚀 How It Works

### Issue Creation
When users create an issue, they'll see:
1. **Bug Report** - Structured form for bug reports
2. **Feature Request** - Structured form for feature requests
3. **Links to documentation and discussions**

### Pull Request Creation
When a PR is opened:
1. PR template is automatically added
2. GitHub Actions run checks
3. Auto-labeling based on files changed
4. Code owners are notified for review

### Automated Checks
All PRs must pass:
- ✅ Code linting
- ✅ Tests (Node 18 & 20)
- ✅ Build verification
- ✅ Security audit
- ✅ PR title format (conventional commits)

---

## 🏷️ Labels

### Type Labels
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `performance` - Performance improvements
- `security` - Security issues

### Priority Labels
- `priority-critical` - Immediate attention needed
- `priority-high` - High priority
- `priority-medium` - Medium priority
- `priority-low` - Low priority

### Status Labels
- `needs-triage` - Needs review
- `in-progress` - Being worked on
- `blocked` - Blocked by another issue
- `ready-for-review` - Ready for review

### Component Labels
- `sources` - Download sources
- `streaming` - Streaming functionality
- `api` - API changes
- `docker` - Docker related
- `dependencies` - Dependency updates

---

## 🔒 Branch Protection

### Main Branch
- ✅ Requires PR reviews (1 approver)
- ✅ Requires status checks to pass
- ✅ Requires conversation resolution
- ✅ Auto-deletes branches after merge

### Develop Branch
- More permissive for active development
- Still runs CI checks

---

## 👥 Code Owners

Defined in `CODEOWNERS`:
- All files: @zviel
- Core services: @zviel
- Documentation: @zviel
- Security files: @zviel

---

## 🛠️ Maintenance

### Adding New Labels
Edit `settings.yml`:
```yaml
labels:
  - name: your-label
    color: hex-color
    description: Description
```

### Adding New Checks
Edit `pr-checks.yml`:
```yaml
your-check:
  name: Your Check
  runs-on: ubuntu-latest
  steps:
    - # your steps
```

### Updating Issue Templates
Edit files in `ISSUE_TEMPLATE/`:
- Use YAML format for structured forms
- Add validation where needed
- Keep forms concise

---

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Issue Templates Guide](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [CODEOWNERS Syntax](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

---

**Last Updated:** 2025-11-20