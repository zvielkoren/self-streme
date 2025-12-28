# Pull Request

## Description
This PR is a comprehensive update that significantly improves the connectivity, deployment, and documentation of Self-Streme. It introduces a custom P2P Hole Punching service to resolve silent streaming failures, adds automated Docker CI/CD with version-based tagging, and overhauls all documentation and deployment files to reflect these architectural improvements.

## Type of Change
<!-- Mark the relevant option with an "x" -->

- [x] 🐛 Bug fix (non-breaking change which fixes an issue)
- [x] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [x] 📝 Documentation update
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [ ] ✅ Test addition or update
- [x] 🔧 Configuration change
- [ ] 🔒 Security fix

## Related Issues
- Fixes the "Nothing happening" issue when streaming behind NAT/Firewalls.
- Fixes Pterodactyl egg import errors (500 Server Error).
- Fixes Pterodactyl `run.sh` not found on startup.

## Changes Made
- **Connectivity:** 
  - Integrated `P2PCoordinator` into `TorrentService` for automatic NAT traversal.
  - Implemented UDP/TCP hole punching via STUN servers.
  - Fixed initialization race condition in `TorrentService`.
  - Fixed a bug in P2P initialization (`detectNAT` -> `detectNATType`).
- **CI/CD & Docker:**
  - Added GitHub Action for automated Docker image building and publishing.
  - Implemented automatic version tagging using `package.json` version.
  - Added support for `TORRENT_PORT` override in Docker, Pterodactyl, and Render.
- **Deployment:**
  - **Updated Pterodactyl Egg** to use the project's own Docker image as the default, significantly speeding up installation.
  - Cleaned and simplified the Pterodactyl egg, removing the redundant `SERVER_PORT` variable.
  - Modified Pterodactyl egg to create the `run.sh` script on every startup, ensuring it always exists.
  - **Fixed Pterodactyl Installation:** Updated installation script to use `sh` instead of `bash` for better compatibility and switched to `node:20-alpine` container.
  - **Enhanced Docker Image:** Added `bash` and `git` to the Dockerfile to support internal scripts and auto-updates.
- **Documentation:**
  - Redesigned `README.md` with a centered header and clear quick-start.
  - Updated `STREAMING-FLOW.md` with enhanced P2P logic.
  - Updated `TROUBLESHOOTING_P2P.md` with specific hole-punching debug steps.

## Testing

### Test Configuration
- Node.js version: 20
- OS: win32 / Linux (Docker)
- Self-Streme version: 1.0.0

### Test Steps
1. Import `deployment/pterodactyl-egg.json` into a Pterodactyl panel and verify it works without a 500 error.
2. Create a server using the egg and verify the installation and startup completes without a `run.sh not found` error.
3. Verify `docker ps` shows mapping for port 6881 (TCP/UDP).
4. Test streaming a torrent on a restricted network and verify peer discovery works via hole punching.

### Test Results
```
2025-12-28T20:00:00Z info: [P2P] Initializing P2P Coordinator...
2025-12-28T20:00:00Z info: [P2P] ✓ Hole punching initialized
2025-12-28T20:00:00Z info: [P2P]   NAT Type: Restricted Cone NAT
```

## Performance Impact
- [x] Performance improved: Connectivity success rate increased significantly for firewalled users.

## Breaking Changes
- [x] No breaking changes

## Checklist

### Code Quality
- [x] My code follows the project's code style
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have made corresponding changes to the documentation
- [x] My changes generate no new warnings or errors

### Documentation
- [x] I have updated the README.md
- [x] I have updated relevant documentation in `/docs`
- [x] I have updated the deployment configurations

### Dependencies
- [x] I have not added new dependencies

### Security
- [x] My code does not introduce security vulnerabilities
- [x] I have not committed sensitive information (API keys, passwords, etc.)

---

**By submitting this PR, I confirm that:**
- [x] I have read and followed the Contributing Guidelines
- [x] My contribution is original or properly attributed
- [x] I agree to license my contributions under the project's license
