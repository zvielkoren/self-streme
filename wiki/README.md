# 📚 Self-Streme Wiki

This folder contains the wiki pages for Self-Streme. These files can be used to populate a GitHub Wiki or serve as standalone documentation.

---

## 📋 What's Included

### Core Pages
- **Home.md** - Wiki homepage and navigation hub
- **Getting-Started.md** - Complete installation and setup guide
- **_Sidebar.md** - Wiki navigation sidebar

### Page Structure

```
wiki/
├── README.md (this file)
├── Home.md                    # Wiki homepage
├── Getting-Started.md         # Installation guide
└── _Sidebar.md               # Navigation sidebar
```

---

## 🚀 How to Use This Wiki

### Option 1: GitHub Wiki

1. **Enable Wiki on GitHub**
   - Go to repository Settings
   - Enable Wiki feature
   - Clone wiki repository

2. **Copy Pages**
   ```bash
   # Clone your wiki repo
   git clone https://github.com/zviel/self-streme.wiki.git
   
   # Copy wiki files
   cp wiki/*.md self-streme.wiki/
   
   # Commit and push
   cd self-streme.wiki
   git add .
   git commit -m "Add wiki pages"
   git push
   ```

3. **Access Wiki**
   - Visit: https://github.com/zviel/self-streme/wiki

### Option 2: Local Documentation

Use these files as comprehensive documentation:

```bash
# Read locally
cat wiki/Home.md
cat wiki/Getting-Started.md

# Or view in your markdown viewer
```

### Option 3: Generate Static Site

Convert to HTML with tools like:
- **MkDocs** - `mkdocs build`
- **Jekyll** - `jekyll build`
- **Docusaurus** - `npm run build`

---

## 📝 Creating New Pages

### File Naming Convention

- Use PascalCase for file names: `My-New-Page.md`
- No spaces in filenames
- Use hyphens for word separation
- Example: `Premium-Services.md`, `Docker-Deployment.md`

### Page Template

```markdown
# 📘 Page Title

Brief description of what this page covers.

---

## 🎯 Overview

Introduction and context.

## 📋 Content Section

Main content here.

### Subsection

Details.

---

## 🔗 Related Pages

- [Related Page 1](Related-Page-1)
- [Related Page 2](Related-Page-2)

---

**Last Updated:** YYYY-MM-DD
```

### Internal Links

Link to other wiki pages:
```markdown
[Getting Started](Getting-Started)
[Configuration](Configuration)
```

### External Links

Link to GitHub docs:
```markdown
[Main Documentation](https://github.com/zviel/self-streme/tree/main/docs)
[Source Code](https://github.com/zviel/self-streme/tree/main/src)
```

---

## 🗂️ Recommended Page Structure

### Essential Pages (Priority 1)
- ✅ Home.md (homepage)
- ✅ Getting-Started.md (installation)
- ✅ _Sidebar.md (navigation)
- ⏳ Configuration.md (settings reference)
- ⏳ FAQ.md (common questions)
- ⏳ Troubleshooting.md (problem solving)

### Feature Pages (Priority 2)
- ⏳ Instant-Streaming.md
- ⏳ Parallel-Downloads.md
- ⏳ Premium-Services.md
- ⏳ Google-Drive-Integration.md

### Advanced Pages (Priority 3)
- ⏳ API-Reference.md
- ⏳ Performance-Tuning.md
- ⏳ Docker-Deployment.md
- ⏳ Production-Setup.md

### Community Pages (Priority 4)
- ⏳ Contributing.md
- ⏳ Code-of-Conduct.md
- ⏳ Contributors.md

---

## 🎨 Formatting Guidelines

### Headers
```markdown
# Main Title (H1)
## Section (H2)
### Subsection (H3)
#### Details (H4)
```

### Emphasis
```markdown
**Bold text** for emphasis
*Italic text* for subtle emphasis
`Code text` for commands, variables, filenames
```

### Lists
```markdown
Unordered:
- Item 1
- Item 2
  - Nested item

Ordered:
1. First
2. Second
3. Third
```

### Code Blocks
````markdown
```bash
npm install
npm start
```

```javascript
const config = {
  port: 11470
};
```
````

### Tables
```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
```

### Callouts
```markdown
> **Note:** Important information here

> ⚠️ **Warning:** Critical warning here

> 💡 **Tip:** Helpful tip here
```

### Images
```markdown
![Alt text](https://example.com/image.png)
```

---

## 🔄 Syncing with Main Documentation

The wiki should complement the main documentation in `docs/`:

### Content Strategy

**Wiki (wiki/):**
- User-friendly tutorials
- Step-by-step guides
- Examples and use cases
- Community-editable
- Frequently updated

**Main Docs (docs/):**
- Technical reference
- API documentation
- Architecture details
- Official and versioned
- Release-synchronized

### Avoid Duplication

Instead of duplicating, link between them:
```markdown
For technical details, see [API Reference](https://github.com/zviel/self-streme/blob/main/docs/API-REFERENCE.md)
```

---

## 📊 Wiki Statistics

- **Current Pages:** 3
- **Total Words:** ~3,000
- **Last Updated:** 2025-11-20
- **Version:** 1.0

### Coverage
- [x] Installation guide
- [x] Navigation structure
- [x] Homepage
- [ ] Configuration reference
- [ ] API documentation
- [ ] Troubleshooting guides
- [ ] Feature guides

---

## 🤝 Contributing to Wiki

### For Maintainers

1. **Add new pages** to this folder
2. **Update _Sidebar.md** with links
3. **Follow naming conventions**
4. **Keep style consistent**
5. **Test links**

### For Contributors

See [CONTRIBUTORS.md](../CONTRIBUTORS.md) for contribution guidelines.

Wiki contributions welcome:
- Fix typos
- Add examples
- Improve explanations
- Add screenshots
- Translate pages

---

## 🔗 Related Resources

### Main Documentation
- [docs/](../docs/) - Official documentation
- [docs/summaries/](../docs/summaries/) - Quick reference guides
- [docs/updates/](../docs/updates/) - Version updates

### Project Files
- [README.md](../README.md) - Project overview
- [CONTRIBUTORS.md](../CONTRIBUTORS.md) - How to contribute
- [CHANGELOG.md](../CHANGELOG.md) - Version history

### External
- [GitHub Repository](https://github.com/zviel/self-streme)
- [GitHub Issues](https://github.com/zviel/self-streme/issues)
- [GitHub Wiki](https://github.com/zviel/self-streme/wiki) (when enabled)

---

## 📅 Maintenance Schedule

### Weekly
- [ ] Check for broken links
- [ ] Update timestamps
- [ ] Review recent issues for FAQ updates

### Monthly
- [ ] Audit all pages for accuracy
- [ ] Update screenshots (if any)
- [ ] Add new frequently asked questions

### Per Release
- [ ] Update version numbers
- [ ] Add new feature pages
- [ ] Update configuration examples
- [ ] Review and update all guides

---

## ✅ Quality Checklist

Before publishing a new wiki page:

- [ ] Page follows naming convention
- [ ] All internal links work
- [ ] All code examples tested
- [ ] Grammar and spelling checked
- [ ] Added to _Sidebar.md
- [ ] Linked from related pages
- [ ] Includes "Last Updated" date
- [ ] Has clear structure
- [ ] Includes examples where appropriate
- [ ] Cross-referenced with main docs

---

## 💡 Tips for Wiki Authors

1. **Be Clear** - Use simple language
2. **Be Concise** - Get to the point quickly
3. **Use Examples** - Show, don't just tell
4. **Add Context** - Explain why, not just how
5. **Link Liberally** - Connect related topics
6. **Update Regularly** - Keep information current
7. **Test Everything** - Verify all instructions work
8. **Think of Users** - Write for beginners and experts

---

**Last Updated:** 2025-11-20  
**Wiki Version:** 1.0  
**Self-Streme Version:** 2.0

**Questions?** Open an issue on [GitHub](https://github.com/zviel/self-streme/issues)