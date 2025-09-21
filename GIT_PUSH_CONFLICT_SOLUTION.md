# Git Push Conflict Resolution Solution

## Problem Addressed

The system was experiencing git push failures when the remote repository (github.io) had newer commits than the local repository. The error appeared in logs as:

```
❌ git push failed with status: 1
stderr: To github.com:spospordo/spospordo.github.io.git
 ! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'github.com:spospordo/spospordo.github.io.git'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally. This is usually caused by another repository pushing
hint: to the same ref. You may want to first integrate the remote changes
hint: (e.g., 'git pull ...') before pushing again.
```

Previously, when this error occurred, the system would simply log the error and stop, leaving local changes uncommitted and unpushed.

## Solution Implemented

The solution implements an intelligent retry mechanism that:

1. **Detects push conflicts** - Specifically identifies "fetch first" and "Updates were rejected" errors
2. **Performs git pull** - Automatically pulls and merges remote changes
3. **Regenerates content** - Re-runs the content generation process to incorporate any remote changes
4. **Retries the push** - Attempts to push again with the updated local repository
5. **Prevents infinite loops** - Limits retry attempts to prevent endless retries

## Key Components

### 1. Enhanced Push Function (`pushToGitHub`)

- Now async to support the retry workflow
- Detects specific push failure types
- Implements retry logic with attempt counting
- Handles both committed and uncommitted changes

### 2. Pull Functionality (`pullFromRemote`)

- Executes `git pull` to integrate remote changes
- Validates pull success and handles pull-specific errors
- Provides detailed logging for troubleshooting

### 3. Content Regeneration (`triggerContentRegeneration`)

- Re-runs the scraper with upload disabled to prevent circular calls
- Uses `SKIP_UPLOAD=true` environment variable
- Ensures fresh content generation after pulling remote changes

### 4. Loop Prevention

- Maximum retry attempts: `MAX_RETRY_ATTEMPTS = 2`
- Retry counter resets on successful operations
- Prevents infinite retry loops in edge cases

## Code Changes Made

### `uploadToGitHub.mjs`

1. **Added `pullFromRemote()` function**
   - Handles git pull operations
   - Validates success and provides error handling

2. **Added `forceSync()` function** *(NEW)*
   - Implements aggressive repository sync resolution
   - Creates backup branches before destructive operations
   - Forces local repository to exactly match origin/main
   - Automatically restarts vidiots logic after sync

3. **Enhanced `pushToGitHub()` function**
   - Made async to support retry workflow
   - Added error type detection for "fetch first" errors
   - Implemented retry logic with content regeneration
   - Added retry attempt tracking
   - **NEW**: Falls back to `forceSync()` when `pullFromRemote()` fails

4. **Added `triggerContentRegeneration()` function**
   - Uses subprocess execution with `SKIP_UPLOAD=true`
   - Prevents circular upload calls during retry

5. **Updated `schedulePush()` function**
   - Made async to support the new async `pushToGitHub`

6. **Added command line support** *(NEW)*
   - `--validate` flag for repository validation
   - `--force-sync` flag for manual force sync operations

### `scrapeVidiots.cjs`

1. **Modified `runScrapeAndUpload()` function**
   - Added `skipUpload` parameter
   - Added environment variable check for `SKIP_UPLOAD`
   - Prevents circular upload calls during content regeneration

2. **Added module exports**
   - Exported key functions for use by other modules

## How It Works

### Normal Operation Flow
1. Content changes detected
2. `schedulePush()` called with debounce
3. `pushToGitHub()` commits and pushes changes
4. Success - process complete

### Conflict Resolution Flow (Enhanced)
1. Content changes detected
2. `schedulePush()` called with debounce  
3. `pushToGitHub()` commits changes
4. Push fails with "fetch first" error
5. **NEW**: Error type detected as recoverable
6. **NEW**: `pullFromRemote()` executed
7. **IF PULL FAILS**: `forceSync()` executed (aggressive resolution)
8. **NEW**: `triggerContentRegeneration()` re-runs content generation
9. **NEW**: Push retried with updated content
10. Success or max retries reached

### Force Sync Process (New)
When `pullFromRemote()` fails, the system now automatically triggers `forceSync()` which:
1. Creates backup branch with timestamp
2. Aborts any in-progress git operations  
3. Fetches from origin with prune
4. Forces local main to exactly match origin/main (discards local changes)
5. Cleans untracked files
6. Verifies repository sync
7. Restarts vidiots logic

## Error Types Handled

### Recoverable Errors (triggers retry)
- `! [rejected] main -> main (fetch first)`
- `Updates were rejected because the remote contains work`

### Non-Recoverable Errors (no retry)
- Authentication failures
- No configured remote repository
- Repository access rights issues
- Network connectivity issues

## Safety Features

1. **Maximum Retry Limit**: Only 2 retry attempts to prevent infinite loops
2. **Error Type Detection**: Only retries for specific conflict scenarios
3. **Upload Prevention**: Uses `SKIP_UPLOAD=true` to prevent circular calls
4. **Detailed Logging**: Comprehensive logging for troubleshooting

## Testing

The solution has been tested with:
- ✅ Error detection logic (all test cases pass)
- ✅ Basic git operations (commit, push, pull)
- ✅ Integration with existing codebase
- ✅ Loop prevention mechanisms
- ✅ Content regeneration workflow

## Usage

No configuration changes are required. The system works automatically when:
- Git push conflicts occur due to remote changes
- The error is of a recoverable type (fetch first, updates rejected)
- Retry attempts are under the maximum limit

The system will automatically:
1. Pull remote changes
2. Regenerate content  
3. Retry the push operation
4. Log the entire process for monitoring

## Monitoring

Watch for these log messages to monitor the retry functionality:

```bash
🔄 Detected remote changes, attempting recovery (attempt 1/2)...
🔄 Pull successful, regenerating content and retrying push...
🔄 Triggering content regeneration...
🌐 Re-running scraper to regenerate content...
📤 Content was updated, but skipping git upload as requested
🔄 Retrying push after content regeneration...
```

Success indicators:
```bash
✅ Successfully pulled changes from remote
✅ Content regeneration completed
🎉 Successfully pushed changes to GitHub!
```

Error indicators:
```bash
❌ Maximum retry attempts (2) reached, giving up
❌ Failed to pull remote changes, cannot retry push
❌ Content regeneration failed, cannot retry push
```