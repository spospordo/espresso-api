# Force Update Troubleshooting Guide

## Problem
When force update is enabled for the Vidiots page (`vidiots.forceUpdate = true`), the local files are successfully updated, but changes are not reflected on the GitHub.io site after 10+ minutes.

## Root Causes and Solutions

### 1. Missing Configuration Options
**Problem**: The `forceUpdate` and `maxAgeHours` options were referenced in code but missing from the configuration template.

**Solution**: These options have been added to `config.cjs.example`:
```javascript
vidiots: {
  posterBaseUrl: "https://example.github.io/TRMNL/",
  posterDirectory: "/home/pi/pages/example.github.io",
  forceUpdate: false,        // Set to true to always push updates
  maxAgeHours: 24           // Force update if file is older than this
}
```

### 2. Git Repository Path Not Configured
**Problem**: The `github.repoLocalPath` in your config.cjs points to a non-existent directory.

**Solution**: 
1. Check your `config.cjs` file
2. Ensure `github.repoLocalPath` points to your actual GitHub Pages repository directory
3. Example: `"/home/username/projects/username.github.io"`

**Validation**: Run this command to check your git setup:
```bash
node uploadToGitHub.mjs --validate
```

### 3. Async/Await Issue Fixed
**Problem**: The git upload was not properly awaited, causing silent failures.

**Solution**: The `runScrapeAndUpload` function now properly awaits the import and handles errors.

### 4. Poor Error Handling
**Problem**: Git operations could fail silently without reporting the issue.

**Solution**: Enhanced logging and error handling now provides detailed output:
- ✅ Clear success messages
- ❌ Detailed error messages with status codes
- 📊 Progress tracking for git operations

## How to Enable and Test Force Updates

### Step 1: Configure Force Update
Edit your `config.cjs`:
```javascript
vidiots: {
  forceUpdate: true,        // Enable force updates
  maxAgeHours: 1,          // Optional: force update if file is older than 1 hour
  // ... other options
}
```

### Step 2: Verify Git Repository Setup
```bash
# Validate your git configuration
node uploadToGitHub.mjs --validate

# Should show:
# ✅ Git repository validation passed
```

### Step 3: Test Force Update
```bash
# Run the scraper manually to see detailed output
node scrapeVidiots.cjs
```

**Expected output with force update enabled:**
```
📄 Force update enabled in configuration, updating file
📝 HTML updated: /path/to/vidiots.html (123 movies, 45678 characters)
📤 Content was updated, triggering git upload...
⏰ Scheduling git push with debounce: "Automated Commit and push from scrapeVidiots.cjs - content updated"
🚀 Starting git upload process with message: "Automated Commit and push..."
📁 Repository path: /your/repo/path
📝 Changes detected, proceeding with git operations...
📤 Adding files to git...
✅ Files added successfully
💾 Committing changes...
✅ Commit successful: [main abc1234] Automated Commit and push...
⬆️  Pushing to GitHub...
✅ Push successful
🎉 Successfully pushed changes to GitHub!
```

## Common Issues and Solutions

### Issue: "Repository directory does not exist"
```bash
❌ Repository directory does not exist: /path/to/repo
```
**Solution**: Update `github.repoLocalPath` in your `config.cjs` to point to your actual GitHub Pages repository directory.

### Issue: "Directory is not a git repository"
```bash
❌ Directory is not a git repository: /path/to/repo
```
**Solution**: 
1. Navigate to the directory
2. Run `git init` if it's a new repository
3. Or ensure you're pointing to the correct git repository directory

### Issue: Force update not triggering
- Verify `vidiots.forceUpdate = true` in your config.cjs
- Check the console output for the "Force update enabled" message
- If not seeing this message, the configuration may not be loading correctly

### Issue: Git sync problems and repository conflicts
```bash
❌ git push failed with status: 1
stderr: ! [rejected] main -> main (fetch first)
```
**Solution**: The system now includes automatic force sync functionality that will:
1. Create a backup branch
2. Force local repository to match origin/main
3. Discard any conflicting local changes
4. Restart the vidiots logic

**Manual force sync**: If automatic retry doesn't work, run:
```bash
node uploadToGitHub.mjs --force-sync
```

**See**: `FORCE_SYNC_DOCUMENTATION.md` for complete details on the force sync feature.

### Issue: Changes not appearing on GitHub.io after push
- GitHub Pages can take 5-10 minutes to update after a successful push
- Check the GitHub repository to confirm the files were actually updated
- Verify the file paths in your configuration match your repository structure

## Testing Your Setup

Use the provided integration test to verify everything is working:
```bash
node test-integration.cjs
```

This will validate:
- ✅ Configuration completeness
- ✅ Module loading
- ✅ Git repository setup
- ✅ Function availability