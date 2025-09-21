# Force Repository Sync Feature

## Overview

The enhanced `uploadToGitHub.mjs` now includes an aggressive force sync functionality that automatically resolves git repository synchronization issues by discarding local changes and forcing the local repository to exactly match the remote origin/main branch.

## Problem Solved

When the remote repository (github.io) has commits that the local repository doesn't have, regular git operations can fail with errors like:

```
❌ git push failed with status: 1
stderr: ! [rejected] main -> main (fetch first)
error: failed to push some refs to repository
hint: Updates were rejected because the remote contains work that you do
hint: not have locally.
```

This new feature automatically resolves these issues using the exact sequence of commands provided by the user.

## Force Sync Process

The force sync implements the following sequence:

1. **Create Backup Branch** - Creates a timestamped backup branch (`backup/local-YYYYMMDD-HHMMSS`)
2. **Cleanup Old Backups** - Automatically removes old backup branches, keeping only the last 2 backups to prevent storage bloat
3. **Abort Operations** - Aborts any in-progress git merge or rebase operations
4. **Fetch with Prune** - Runs `git fetch --prune origin` to update remote tracking
5. **Force Checkout** - Runs `git checkout -B main origin/main` to force local main to match origin/main
6. **Hard Reset** - Runs `git reset --hard origin/main` to discard any local changes
7. **Clean Untracked** - Runs `git clean -fd` to remove untracked files and directories
8. **Verify Sync** - Verifies the repository is in sync using `git rev-list --left-right --count HEAD...origin/main`
9. **Test Pull** - Tests that `git pull --ff-only origin main` is now a no-op
10. **Restart Logic** - Automatically restarts the vidiots scraper logic after sync

## Integration with Existing Retry Logic

The force sync is automatically triggered as a fallback when:

1. A git push fails with "fetch first" or "Updates were rejected" errors
2. The regular `pullFromRemote()` function fails
3. Retry attempts are still under the maximum limit (`MAX_RETRY_ATTEMPTS = 2`)

### Flow:
1. Push fails with conflict
2. Attempts regular `pullFromRemote()`
3. If pull fails, attempts `forceSync()`
4. If force sync succeeds, regenerates content and retries push
5. If force sync fails or max retries reached, gives up

## Manual Usage

### Command Line
```bash
# Force sync the repository manually
node uploadToGitHub.mjs --force-sync

# Validate git repository setup
node uploadToGitHub.mjs --validate
```

### Programmatic Usage
```javascript
import { forceSync, validateGitSetup } from './uploadToGitHub.mjs';

// Validate repository
const isValid = validateGitSetup();

// Force sync if needed
if (isValid) {
  await forceSync();
}
```

## Safety Features

1. **Backup Creation** - Always creates a backup branch before making destructive changes
2. **Automatic Backup Cleanup** - Keeps only the last 2 backup branches to prevent local storage bloat
3. **Maximum Retries** - Limited to 2 retry attempts to prevent infinite loops  
4. **Error Detection** - Only triggers on specific recoverable error types
5. **Detailed Logging** - Comprehensive logging for monitoring and troubleshooting
6. **Verification** - Multiple verification steps to ensure sync was successful

## Backup Management

The system automatically manages backup branches to prevent local storage from being consumed by old backups:

- **Backup Format**: `backup/local-YYYYMMDD-HHMMSS` (e.g., `backup/local-20241221-143022`)
- **Retention Policy**: Only the 2 most recent backup branches are kept
- **Automatic Cleanup**: Old backups are deleted immediately after each successful backup creation
- **Manual Access**: You can manually run the cleanup function if needed:

```javascript
import { cleanupOldBackups } from './uploadToGitHub.mjs';
cleanupOldBackups(); // Manually clean up old backup branches
```

## Expected Log Output

### Successful Force Sync
```
🚨 Starting force sync - this will discard any local changes and commits...
💾 Creating backup branch: backup/local-20241221-143022
✅ Backup branch created successfully
🧹 Cleaning up old backup branches...
📊 Found 4 backup branches
🗑️  Deleting 2 old backup branches:
   Deleting: backup/local-20241220-120000
✅ Deleted backup branch: backup/local-20241220-120000
   Deleting: backup/local-20241220-130000
✅ Deleted backup branch: backup/local-20241220-130000
✅ Backup cleanup completed - kept 2 most recent backups
🛑 Aborting any in-progress git operations...
📥 Fetching from origin with prune...
✅ Fetch completed successfully
🔄 Forcing local main to match origin/main...
✅ Checked out main branch from origin/main
🔄 Hard reset to origin/main...
✅ Hard reset completed
🧹 Cleaning untracked files and directories...
✅ Cleaned untracked files
🔍 Verifying repository is in sync...
📊 Sync status: 0	0 (should be "0	0")
✅ Repository is perfectly in sync with origin/main
🔍 Testing if pull is now a no-op...
✅ Pull test successful - repository is properly synced
✅ Confirmed: Already up to date
🔄 Triggering server.js and vidiots logic restart...
🌐 Re-running vidiots scraper after sync...
✅ Vidiots logic restarted successfully
🎉 Force sync completed successfully!
```

### Force Sync in Retry Logic
```
🔄 Detected remote changes, attempting recovery (attempt 1/2)...
❌ git pull failed with status: 1
🚨 Regular pull failed, attempting force sync to resolve repository issues...
🚨 Starting force sync - this will discard any local changes and commits...
[... force sync process ...]
🔄 Force sync successful, regenerating content and retrying push...
🔄 Triggering content regeneration...
🔄 Retrying push after force sync and content regeneration...
🎉 Successfully pushed changes to GitHub!
```

## Configuration

No additional configuration is required. The force sync uses the existing `github.repoLocalPath` configuration from `config.cjs`.

## Monitoring

Watch for these log patterns to monitor force sync operations:

- **Success**: `🎉 Force sync completed successfully!`
- **Backup Created**: `💾 Creating backup branch: backup/local-*`
- **Triggered**: `🚨 Regular pull failed, attempting force sync`
- **Verification**: `✅ Repository is perfectly in sync with origin/main`

## Warning

⚠️ **DESTRUCTIVE OPERATION**: Force sync will permanently discard any local changes and commits that haven't been pushed to the remote repository. However, a backup branch is always created before any destructive operations.

The backup branch can be used to recover discarded work if needed:
```bash
git checkout backup/local-YYYYMMDD-HHMMSS
git checkout -b recover-work
# Review and cherry-pick needed commits
```