# 🎬 Self-Streme Wiki

Welcome to the Self-Streme Wiki! This is your comprehensive guide to understanding, configuring, and optimizing Self-Streme.

---

## 🚀 Quick Navigation

### 📖 Essentials
- [Getting Started](Getting-Started) - Installation and setup
- [Quick Start Guide](Quick-Start-Guide) - Get running in 5 minutes
- [Configuration](Configuration) - Complete configuration reference
- [FAQ](FAQ) - Frequently asked questions

### 🌟 Features
- [Instant Streaming](Instant-Streaming) - 3-5 second playback start
- [Parallel Downloads](Parallel-Downloads) - 5-10x faster downloads
- [Premium Services](Premium-Services) - 95%+ reliability setup
- [Google Drive Integration](Google-Drive-Integration) - 100% cached reliability

### 🔧 Advanced Topics
- [Download Sources](Download-Sources) - Understanding the source system
- [Performance Tuning](Performance-Tuning) - Optimize for your use case
- [Troubleshooting](Troubleshooting) - Fix common issues
- [API Reference](API-Reference) - Complete API documentation

### 📦 Deployment
- [Docker Deployment](Docker-Deployment) - Deploy with Docker
- [Production Setup](Production-Setup) - Best practices for production
- [Cloud Deployment](Cloud-Deployment) - AWS, GCP, Azure guides
- [Monitoring](Monitoring) - Health checks and metrics

---

## 🎯 What is Self-Streme?

Self-Streme is a self-hosted streaming platform that allows you to stream torrents instantly with:

- ✅ **Instant Playback** - Start watching in 3-5 seconds
- ✅ **Multi-Source Support** - Try multiple sources automatically
- ✅ **High Reliability** - 95-100% success rate
- ✅ **Fast Downloads** - 5-10x faster with parallel downloads
- ✅ **Easy Setup** - Get started in minutes
- ✅ **Self-Hosted** - Your data, your control

---

## 📊 Key Features

### ⚡ Performance
- **Instant Streaming** - Playback starts in 3-5 seconds while downloading continues
- **Parallel Downloads** - Download chunks simultaneously for 5-10x speed boost
- **Smart Buffering** - Prioritizes data near playback position
- **Resume Support** - Continue interrupted downloads

### 🌐 Download Sources
- **Premium Services** - Real-Debrid, AllDebrid, Premiumize (95%+ success)
- **Google Drive** - Cache your own torrents (100% reliable)
- **Free Sources** - WebTor.io and others as fallback
- **Automatic Failover** - Tries all sources until one works

### 🎥 Streaming
- **Progressive Download** - Stream while downloading
- **Range Request Support** - Seek anywhere in video
- **Multiple Formats** - MP4, MKV, AVI, and more
- **Subtitle Support** - Built-in subtitle handling

### 🔒 Reliability
- **Verified Sources Only** - All broken sources removed
- **Health Monitoring** - Track source success rates
- **Detailed Errors** - Know exactly why something failed
- **Automatic Retry** - Smart retry logic with backoff

---

## 🚀 Getting Started

### Quick Start (5 Minutes)

1. **Install Prerequisites**
   ```bash
   # Requires Node.js 18+
   node --version
   ```

2. **Clone and Install**
   ```bash
   git clone https://github.com/zviel/self-streme.git
   cd self-streme
   npm install
   ```

3. **Configure**
   ```bash
   # Copy example config
   cp .env.example .env
   
   # Optional: Add premium service for 95%+ reliability
   echo "REAL_DEBRID_API_KEY=your_key_here" >> .env
   ```

4. **Start**
   ```bash
   npm start
   ```

5. **Test**
   ```
   Open: http://localhost:11470
   ```

**Done!** See [Getting Started](Getting-Started) for detailed instructions.

---

## 💡 Popular Use Cases

### Personal Media Server
Stream your personal torrent collection with instant playback.

**Setup:** [Personal Media Server Guide](Personal-Media-Server)

### Stremio Integration
Add Self-Streme as a Stremio addon for seamless integration.

**Setup:** [Stremio Integration Guide](Stremio-Integration)

### Seedbox Replacement
Use Self-Streme with premium services instead of a seedbox.

**Setup:** [Seedbox Alternative Guide](Seedbox-Alternative)

### Family Sharing
Share your streaming server with family members.

**Setup:** [Family Sharing Guide](Family-Sharing)

---

## 📈 Performance Comparison

| Configuration | Success Rate | Time to Play | Download Speed | Cost |
|---------------|--------------|--------------|----------------|------|
| **Free only** | 60-70% | 5-10s | 2-5 MB/s | Free |
| **Free + Optimizations** | 65-75% | 3-5s | 5-10 MB/s | Free |
| **Premium only** | 95-98% | 2-3s | 10-20 MB/s | €0.13/day |
| **Premium + Optimizations** | 98-100% | 2-3s | 15-30 MB/s | €0.13/day |

**Recommendation:** Premium service + all optimizations enabled

---

## 🔧 Configuration Quick Reference

### Instant Streaming (Enabled by Default)
```bash
ENABLE_INSTANT_STREAMING=true      # Start playback in 3-5 seconds
INITIAL_BUFFER_SIZE=10485760       # 10 MB buffer
```

### Speed Optimization
```bash
ENABLE_PARALLEL_RACE=true          # Race multiple sources
ENABLE_MULTIPART_DOWNLOAD=true     # Parallel chunk downloads
PARALLEL_DOWNLOADS=3               # Number of sources to race
MULTIPART_CONNECTIONS=8            # Parallel connections per file
```

### Premium Services (Recommended)
```bash
REAL_DEBRID_API_KEY=your_key       # 95%+ success rate
ALLDEBRID_API_KEY=your_key         # Alternative
PREMIUMIZE_API_KEY=your_key        # Alternative
```

### Google Drive (Optional)
```bash
GOOGLE_DRIVE_ENABLED=true          # Enable cached torrents
GOOGLE_DRIVE_API_ENDPOINT=http://localhost:3000/gdrive
```

**Full reference:** [Configuration Guide](Configuration)

---

## 🆘 Common Issues

### Downloads Failing
**Solution:** [Download Failure Troubleshooting](Troubleshooting-Downloads)

Quick fixes:
- Enable all sources: `EXCLUDE_DOWNLOAD_SOURCES=""`
- Increase retries: `HTTP_MAX_RETRIES=5`
- Add premium service: `REAL_DEBRID_API_KEY=your_key`

### Playback Not Starting
**Solution:** [Playback Issues](Troubleshooting-Playback)

Check:
- Instant streaming enabled (default)
- Initial buffer size appropriate
- Network connectivity

### P2P Not Connecting
**Solution:** [P2P Troubleshooting](Troubleshooting-P2P)

Check:
- Firewall settings
- Port forwarding
- DHT enabled

**Full guide:** [Troubleshooting](Troubleshooting)

---

## 📚 Documentation Structure

### By Experience Level

**🌱 Beginner**
- [Getting Started](Getting-Started)
- [Quick Start Guide](Quick-Start-Guide)
- [FAQ](FAQ)
- [Basic Configuration](Basic-Configuration)

**🌿 Intermediate**
- [Advanced Configuration](Advanced-Configuration)
- [Performance Tuning](Performance-Tuning)
- [Download Sources](Download-Sources)
- [Troubleshooting](Troubleshooting)

**🌲 Advanced**
- [API Reference](API-Reference)
- [Source Code Guide](Source-Code-Guide)
- [Custom Sources](Custom-Sources)
- [Monitoring & Analytics](Monitoring)

### By Topic

**⚡ Performance**
- [Instant Streaming](Instant-Streaming)
- [Parallel Downloads](Parallel-Downloads)
- [Performance Tuning](Performance-Tuning)
- [Caching Strategy](Caching-Strategy)

**🌐 Sources**
- [Premium Services](Premium-Services)
- [Google Drive Integration](Google-Drive-Integration)
- [Free Sources](Free-Sources)
- [Custom Sources](Custom-Sources)

**🚀 Deployment**
- [Docker Deployment](Docker-Deployment)
- [Production Setup](Production-Setup)
- [Cloud Deployment](Cloud-Deployment)
- [Reverse Proxy Setup](Reverse-Proxy)

**🔧 Advanced**
- [API Reference](API-Reference)
- [Environment Variables](Environment-Variables)
- [Health Monitoring](Health-Monitoring)
- [Security](Security)

---

## 🤝 Contributing

Want to help improve Self-Streme?

- **Report Bugs:** [GitHub Issues](https://github.com/zviel/self-streme/issues)
- **Suggest Features:** [Feature Requests](https://github.com/zviel/self-streme/issues)
- **Contribute Code:** [Contribution Guide](Contributing)
- **Improve Docs:** Edit wiki pages directly

See [CONTRIBUTORS.md](https://github.com/zviel/self-streme/blob/main/CONTRIBUTORS.md) for details.

---

## 💖 Support & Sponsorship

Love Self-Streme? Help keep it maintained and growing!

### Ways to Support
- ⭐ **Star** the repository on GitHub
- 💰 **Become a Sponsor** - [GitHub Sponsors](https://github.com/sponsors/zvielkoren)
- 🐛 **Report Bugs** and suggest features
- 📢 **Share** with the community
- 🤝 **Contribute** code or documentation

### 💎 Sponsorship Tiers
We offer multiple tiers with exclusive benefits:
- ☕ **Coffee Supporter** ($5/month) - Sponsor badge & early announcements
- 🥉 **Bronze Sponsor** ($10/month) - Priority bug reports & feature requests
- 🥈 **Silver Sponsor** ($25/month) - Priority support & logo in docs
- 🥇 **Gold Sponsor** ($50/month) - VIP support & prominent recognition
- 💎 **Diamond Sponsor** ($100/month) - Enterprise support & direct input
- 🌟 **Platinum Sponsor** ($250+/month) - 24/7 support & guaranteed features

**[View all benefits and details →](https://github.com/zviel/self-streme/blob/main/SPONSORS.md)**

Your support helps maintain and improve Self-Streme for everyone!

---

## 📊 Statistics

### Project Stats
- **Version:** 2.0
- **Contributors:** See [CONTRIBUTORS.md](https://github.com/zviel/self-streme/blob/main/CONTRIBUTORS.md)
- **Stars:** [GitHub Stars](https://github.com/zviel/self-streme)
- **License:** See [LICENSE](https://github.com/zviel/self-streme/blob/main/LICENSE)

### Feature Stats
- **Success Rate:** 95-100% (with premium services)
- **Time to Playback:** 3-5 seconds average
- **Download Speed:** 5-30 MB/s (configuration dependent)
- **Verified Sources:** 5 (premium + free + Google Drive)

---

## 🔗 External Resources

### Official Links
- **GitHub Repository:** https://github.com/zviel/self-streme
- **Issue Tracker:** https://github.com/zviel/self-streme/issues
- **Releases:** https://github.com/zviel/self-streme/releases
- **Documentation:** [docs/](https://github.com/zviel/self-streme/tree/main/docs)

### Premium Services
- **Real-Debrid:** https://real-debrid.com
- **AllDebrid:** https://alldebrid.com
- **Premiumize:** https://premiumize.me

### Community
- **Discussions:** GitHub Discussions (coming soon)
- **Support:** GitHub Issues

---

## 📝 Recent Updates

### Version 2.0 (2025-11-20)
**Major Performance & Reliability Update**

**New Features:**
- ✨ Instant streaming (3-5 second playback start)
- ✨ Parallel source racing (2-3x faster source selection)
- ✨ Multi-part downloads (5-10x faster downloads)
- ✨ Google Drive integration (100% reliability for cached content)

**Improvements:**
- ✅ Fixed all premium service APIs
- ✅ Removed 13 broken sources
- ✅ Added detailed error messages
- ✅ Improved success rate: 60% → 95-100%
- ✅ Reduced playback start time: 43 min → 3-5 seconds

**Documentation:**
- 📚 Created comprehensive guides (10,000+ lines)
- 📚 Organized documentation structure
- 📚 Added troubleshooting guides
- 📚 Created this wiki!

**See:** [Version 2.0 Update](Version-2.0-Update)

---

## 🎓 Learning Path

### For New Users
1. [Getting Started](Getting-Started) - Install and configure
2. [Quick Start Guide](Quick-Start-Guide) - First steps
3. [Configuration](Configuration) - Understand settings
4. [Instant Streaming](Instant-Streaming) - Key feature
5. [Premium Services](Premium-Services) - Improve reliability

### For Power Users
1. [Performance Tuning](Performance-Tuning) - Optimize everything
2. [Advanced Configuration](Advanced-Configuration) - Expert settings
3. [Custom Sources](Custom-Sources) - Add your own sources
4. [Monitoring](Monitoring) - Track performance
5. [API Reference](API-Reference) - Integrate with other tools

### For Developers
1. [Source Code Guide](Source-Code-Guide) - Understand the code
2. [API Reference](API-Reference) - API documentation
3. [Contributing](Contributing) - How to contribute
4. [Development Setup](Development-Setup) - Local development

---

## 💬 Getting Help

### Before Asking
1. **Search the wiki** - Answer might be here
2. **Check FAQ** - Common questions answered
3. **Search issues** - Someone might have asked already

### How to Ask
1. **Use GitHub Issues** - For bugs and features
2. **Be specific** - Include error messages, logs, config
3. **Be patient** - We're a small team, might take time

### What to Include
- Self-Streme version
- Operating system
- Node.js version
- Configuration (sanitized, no API keys!)
- Error messages/logs
- Steps to reproduce

---

## ⭐ Star the Project

If you find Self-Streme useful, please star it on GitHub!

[⭐ Star on GitHub](https://github.com/zviel/self-streme)

It helps others discover the project!

---

## 📄 License

Self-Streme is open source software. See [LICENSE](https://github.com/zviel/self-streme/blob/main/LICENSE) for details.

---

**Last Updated:** 2025-11-20  
**Wiki Version:** 1.0  
**Self-Streme Version:** 2.0

**Quick Links:**
- [Getting Started](Getting-Started)
- [Configuration](Configuration)
- [Troubleshooting](Troubleshooting)
- [API Reference](API-Reference)