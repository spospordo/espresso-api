import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from './config.cjs';
const { github } = config;

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the path to your local GitHub Pages repo from config
const repoPath = github.repoLocalPath || '/home/pi/pages/spospordo.github.io';

// Validate repository path exists
if (!repoPath) {
  console.error('❌ No repository path configured in github.repoLocalPath');
  process.exit(1);
}

// Check if the directory exists (but don't exit, just warn)
try {
  if (!fs.existsSync(repoPath)) {
    console.warn(`⚠️  Repository path does not exist: ${repoPath}`);
    console.warn('⚠️  Git operations will fail until this path is created or corrected');
  } else {
    console.log(`📁 Using repository path: ${repoPath}`);
  }
} catch (err) {
  console.warn('⚠️  Could not verify repository path:', err.message);
}

// Function to check if there are changes to commit or if local is ahead of remote
function hasChanges() {
  console.log(`🔍 Checking for changes in: ${repoPath}`);
  
  // First, check for uncommitted local changes
  const statusResult = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoPath,
    encoding: 'utf8'
  });

  if (statusResult.error) {
    console.error('❌ Error running git status:', statusResult.error);
    return false;
  }
  
  if (statusResult.status !== 0) {
    console.error('❌ git status failed with status:', statusResult.status);
    console.error('stderr:', statusResult.stderr);
    return false;
  }

  const hasLocalChanges = statusResult.stdout && statusResult.stdout.trim().length > 0;
  if (hasLocalChanges) {
    console.log('📋 Local working directory changes detected:');
    console.log(statusResult.stdout.trim());
    return true;
  }

  // Check if local repository is ahead of remote (has commits that haven't been pushed)
  console.log('🔍 Checking if local repository is ahead of remote...');
  
  // Get current branch name
  const currentBranchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (currentBranchResult.status !== 0) {
    console.log('📋 No changes detected (cannot determine current branch)');
    return false;
  }

  const currentBranch = currentBranchResult.stdout.trim();
  console.log(`📊 Current branch: ${currentBranch}`);
  
  // Check if we have any remotes configured
  const remotesResult = spawnSync('git', ['remote'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (remotesResult.status === 0 && remotesResult.stdout.trim().length > 0) {
    // We have remotes, so we can check properly
    const remotes = remotesResult.stdout.trim().split('\n');
    const defaultRemote = remotes[0]; // Use first remote (usually 'origin')
    console.log(`📊 Found remote: ${defaultRemote}`);
    
    // Check if remote branch exists
    const remoteBranchCheck = spawnSync('git', ['rev-parse', '--verify', `${defaultRemote}/${currentBranch}`], {
      cwd: repoPath,
      encoding: 'utf8'
    });
    
    if (remoteBranchCheck.status === 0) {
      // Remote branch exists, check if we're ahead
      const aheadResult = spawnSync('git', ['rev-list', '--count', `${defaultRemote}/${currentBranch}..HEAD`], {
        cwd: repoPath,
        encoding: 'utf8'
      });
      
      if (aheadResult.status === 0) {
        const aheadCount = parseInt(aheadResult.stdout.trim()) || 0;
        console.log(`📊 Local repository is ${aheadCount} commits ahead of ${defaultRemote}/${currentBranch}`);
        
        if (aheadCount > 0) {
          console.log('📋 Local repository has unpushed commits, push needed');
          return true;
        }
      }
    } else {
      // Remote branch doesn't exist, so we definitely need to push
      console.log(`📊 Remote branch ${defaultRemote}/${currentBranch} doesn't exist, push needed`);
      return true;
    }
  } else {
    // No remotes configured - this usually means we need to set up and push
    console.log('📊 No remotes configured in repository');
    
    // Check if we have any commits at all
    const commitCountResult = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: repoPath,
      encoding: 'utf8'
    });
    
    if (commitCountResult.status === 0) {
      const commitCount = parseInt(commitCountResult.stdout.trim()) || 0;
      console.log(`📊 Repository has ${commitCount} commits but no remote configured`);
      
      if (commitCount > 0) {
        console.log('📋 Repository has commits but no remote - this may need manual setup');
        // In this case, we'll return false since we can't push without a remote
        // but log it as an issue that needs attention
        console.log('⚠️  Warning: Repository has commits but no remote configured for pushing');
        return false;
      }
    }
  }

  console.log('📋 No changes detected (no local changes and repository is up to date with remote)');
  return false;
}

// Function to pull changes from remote repository
function pullFromRemote() {
  console.log('🔄 Pulling changes from remote repository...');
  
  const pullResult = spawnSync('git', ['pull'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (pullResult.error) {
    console.error('❌ Error running git pull:', pullResult.error);
    return false;
  }
  
  if (pullResult.status !== 0) {
    console.error('❌ git pull failed with status:', pullResult.status);
    console.error('stderr:', pullResult.stderr);
    
    // Check if this is a recoverable pull error
    const stderr = pullResult.stderr || '';
    const isRecoverablePullError = !stderr.includes('does not appear to be a git repository') && 
                                   !stderr.includes('Authentication failed') &&
                                   !stderr.includes('access rights');
    
    if (!isRecoverablePullError) {
      console.error('❌ Git pull failed with non-recoverable error, cannot retry');
    }
    
    return false;
  }
  
  console.log('✅ Successfully pulled changes from remote');
  if (pullResult.stdout && pullResult.stdout.trim()) {
    console.log('📊 Pull output:', pullResult.stdout.trim());
  }
  
  return true;
}

// Function to force sync with origin/main (aggressive approach that discards local changes)
async function forceSync() {
  console.log('🚨 Starting force sync - this will discard any local changes and commits...');
  
  // Step 1: Create backup branch with timestamp
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').substring(0, 15);
  const backupBranch = `backup/local-${timestamp}`;
  
  console.log(`💾 Creating backup branch: ${backupBranch}`);
  const backupResult = spawnSync('git', ['branch', backupBranch], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (backupResult.error) {
    console.warn('⚠️  Warning: Could not create backup branch:', backupResult.error);
  } else if (backupResult.status !== 0) {
    console.warn('⚠️  Warning: Backup branch creation failed:', backupResult.stderr);
  } else {
    console.log('✅ Backup branch created successfully');
  }
  
  // Step 2: Abort any in-progress operations (no error if none)
  console.log('🛑 Aborting any in-progress git operations...');
  
  // Abort merge
  const mergeAbort = spawnSync('git', ['merge', '--abort'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  if (mergeAbort.status === 0) {
    console.log('✅ Aborted in-progress merge');
  }
  
  // Abort rebase
  const rebaseAbort = spawnSync('git', ['rebase', '--abort'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  if (rebaseAbort.status === 0) {
    console.log('✅ Aborted in-progress rebase');
  }
  
  // Step 3: Fetch from origin with prune
  console.log('📥 Fetching from origin with prune...');
  const fetchResult = spawnSync('git', ['fetch', '--prune', 'origin'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (fetchResult.error) {
    console.error('❌ Error running git fetch:', fetchResult.error);
    return false;
  }
  
  if (fetchResult.status !== 0) {
    console.error('❌ git fetch failed with status:', fetchResult.status);
    console.error('stderr:', fetchResult.stderr);
    return false;
  }
  
  console.log('✅ Fetch completed successfully');
  
  // Step 4: Force local main to exactly match origin/main
  console.log('🔄 Forcing local main to match origin/main...');
  
  // Checkout main branch (create if doesn't exist)
  const checkoutResult = spawnSync('git', ['checkout', '-B', 'main', 'origin/main'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (checkoutResult.error) {
    console.error('❌ Error during checkout:', checkoutResult.error);
    return false;
  }
  
  if (checkoutResult.status !== 0) {
    console.error('❌ git checkout failed with status:', checkoutResult.status);
    console.error('stderr:', checkoutResult.stderr);
    return false;
  }
  
  console.log('✅ Checked out main branch from origin/main');
  
  // Step 5: Hard reset to origin/main
  console.log('🔄 Hard reset to origin/main...');
  const resetResult = spawnSync('git', ['reset', '--hard', 'origin/main'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (resetResult.error) {
    console.error('❌ Error during reset:', resetResult.error);
    return false;
  }
  
  if (resetResult.status !== 0) {
    console.error('❌ git reset failed with status:', resetResult.status);
    console.error('stderr:', resetResult.stderr);
    return false;
  }
  
  console.log('✅ Hard reset completed');
  
  // Step 6: Clean untracked files and directories
  console.log('🧹 Cleaning untracked files and directories...');
  const cleanResult = spawnSync('git', ['clean', '-fd'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (cleanResult.error) {
    console.warn('⚠️  Warning: Could not clean untracked files:', cleanResult.error);
  } else if (cleanResult.status !== 0) {
    console.warn('⚠️  Warning: git clean failed:', cleanResult.stderr);
  } else {
    console.log('✅ Cleaned untracked files');
    if (cleanResult.stdout && cleanResult.stdout.trim()) {
      console.log('📊 Removed files:', cleanResult.stdout.trim());
    }
  }
  
  // Step 7: Verify sync
  console.log('🔍 Verifying repository is in sync...');
  
  // Check rev-list count
  const revListResult = spawnSync('git', ['rev-list', '--left-right', '--count', 'HEAD...origin/main'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (revListResult.status === 0) {
    const counts = revListResult.stdout.trim();
    console.log(`📊 Sync status: ${counts} (should be "0\t0")`);
    
    if (counts === '0\t0') {
      console.log('✅ Repository is perfectly in sync with origin/main');
    } else {
      console.warn('⚠️  Warning: Repository may not be perfectly in sync');
    }
  }
  
  // Check git status
  const statusResult = spawnSync('git', ['status', '-b'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (statusResult.status === 0) {
    console.log('📊 Final status:');
    console.log(statusResult.stdout);
  }
  
  // Final verification: test if pull is now a no-op
  console.log('🔍 Testing if pull is now a no-op...');
  const testPullResult = spawnSync('git', ['pull', '--ff-only', 'origin', 'main'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (testPullResult.status === 0) {
    console.log('✅ Pull test successful - repository is properly synced');
    if (testPullResult.stdout && testPullResult.stdout.includes('Already up to date')) {
      console.log('✅ Confirmed: Already up to date');
    }
  } else {
    console.warn('⚠️  Warning: Pull test failed, manual intervention may be needed');
    console.warn('stderr:', testPullResult.stderr);
  }
  
  console.log('🎉 Force sync completed successfully!');
  
  // Trigger server.js and vidiots logic restart as requested
  console.log('🔄 Triggering server.js and vidiots logic restart...');
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Re-run the vidiots scraper to regenerate content with the synced repository
    console.log('🌐 Re-running vidiots scraper after sync...');
    await execAsync('SKIP_UPLOAD=true node scrapeVidiots.cjs', { 
      cwd: process.cwd(),
      env: { ...process.env, SKIP_UPLOAD: 'true' }
    });
    
    console.log('✅ Vidiots logic restarted successfully');
  } catch (error) {
    console.warn('⚠️  Warning: Could not restart vidiots logic:', error.message);
  }
  
  return true;
}

// Function to trigger content regeneration
async function triggerContentRegeneration() {
  console.log('🔄 Triggering content regeneration...');
  
  try {
    // Set an environment variable to prevent the scraper from triggering uploads
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Re-run the scraper to regenerate content with the updated local repository
    // Set SKIP_UPLOAD environment variable to prevent circular upload calls
    console.log('🌐 Re-running scraper to regenerate content...');
    await execAsync('SKIP_UPLOAD=true node scrapeVidiots.cjs', { 
      cwd: process.cwd(),
      env: { ...process.env, SKIP_UPLOAD: 'true' }
    });
    
    console.log('✅ Content regeneration completed');
    return true;
  } catch (error) {
    console.error('❌ Error during content regeneration:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return false;
  }
}

// Track retry attempts to prevent infinite loops
let retryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 2;

// Function to push changes to GitHub with retry logic
async function pushToGitHub(commitMessage = 'Automated commit and push', isRetry = false) {
  console.log(`🚀 Starting git upload process with message: "${commitMessage}"`);
  console.log(`📁 Repository path: ${repoPath}`);
  
  if (!hasChanges()) {
    console.log('📋 No changes to commit or push.');
    return;
  }

  console.log('📝 Changes detected, proceeding with git operations...');

  // Check if there are uncommitted changes that need to be added and committed
  const statusResult = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoPath,
    encoding: 'utf8'
  });

  const hasUncommittedChanges = statusResult.status === 0 && statusResult.stdout && statusResult.stdout.trim().length > 0;

  if (hasUncommittedChanges) {
    // git add -A
    console.log('📤 Adding files to git...');
    let result = spawnSync('git', ['add', '-A'], {
      cwd: repoPath,
      encoding: 'utf8'
    });
    if (result.error) {
      console.error('❌ Error running git add:', result.error);
      return;
    }
    if (result.status !== 0) {
      console.error('❌ git add failed with status:', result.status);
      console.error('stderr:', result.stderr);
      return;
    }
    console.log('✅ Files added successfully');

    // git commit -m "message"
    console.log('💾 Committing changes...');
    result = spawnSync('git', ['commit', '-m', commitMessage], {
      cwd: repoPath,
      encoding: 'utf8'
    });
    if (result.error) {
      console.error('❌ Error running git commit:', result.error);
      return;
    }
    if (result.status !== 0) {
      console.error('❌ git commit failed with status:', result.status);
      console.error('stderr:', result.stderr);
      return;
    }
    if (result.stdout) {
      console.log('✅ Commit successful:', result.stdout.trim());
    }
  } else {
    console.log('📝 No uncommitted changes, proceeding directly to push...');
  }

  // git push
  console.log('⬆️  Pushing to GitHub...');
  const pushResult = spawnSync('git', ['push'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (pushResult.error) {
    console.error('❌ Error running git push:', pushResult.error);
    return;
  }
  
  if (pushResult.status !== 0) {
    console.error('❌ git push failed with status:', pushResult.status);
    console.error('stderr:', pushResult.stderr);
    
    // Check if this is a "fetch first" error (remote has newer commits)
    const stderr = pushResult.stderr || '';
    const isFetchFirstError = stderr.includes('fetch first') || stderr.includes('Updates were rejected');
    
    if (isFetchFirstError && retryAttempts < MAX_RETRY_ATTEMPTS) {
      retryAttempts++;
      console.log(`🔄 Detected remote changes, attempting recovery (attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})...`);
      
      // Try to pull changes from remote first
      if (pullFromRemote()) {
        console.log('🔄 Pull successful, regenerating content and retrying push...');
        
        // Trigger content regeneration to incorporate any remote changes
        const regenSuccess = await triggerContentRegeneration();
        if (regenSuccess) {
          // Wait a moment for content to be generated
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Retry the push operation
          console.log(`🔄 Retrying push after content regeneration...`);
          return await pushToGitHub(commitMessage, true);
        } else {
          console.error('❌ Content regeneration failed, cannot retry push');
          retryAttempts = 0; // Reset for next time
          return;
        }
      } else {
        // Regular pull failed, try force sync as a last resort
        console.log('🚨 Regular pull failed, attempting force sync to resolve repository issues...');
        
        if (await forceSync()) {
          console.log('🔄 Force sync successful, regenerating content and retrying push...');
          
          // Trigger content regeneration after force sync
          const regenSuccess = await triggerContentRegeneration();
          if (regenSuccess) {
            // Wait a moment for content to be generated
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Retry the push operation
            console.log(`🔄 Retrying push after force sync and content regeneration...`);
            return await pushToGitHub(commitMessage, true);
          } else {
            console.error('❌ Content regeneration failed after force sync, cannot retry push');
            retryAttempts = 0; // Reset for next time
            return;
          }
        } else {
          console.error('❌ Force sync failed, cannot retry push');
          retryAttempts = 0; // Reset for next time
          return;
        }
      }
    } else if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
      console.error(`❌ Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached, giving up`);
      retryAttempts = 0; // Reset for next time
      return;
    } else {
      console.error('❌ Push failed for non-recoverable reason');
      return;
    }
  }
  
  // Reset retry counter on successful push
  retryAttempts = 0;
  
  // Git push can have output in stderr that's not an error (like progress info)
  if (pushResult.stdout && pushResult.stdout.trim()) {
    console.log('✅ Push successful:', pushResult.stdout.trim());
  }
  if (pushResult.stderr && pushResult.stderr.trim()) {
    // stderr might contain progress information, not necessarily errors
    console.log('📊 Push info:', pushResult.stderr.trim());
  }
  
  if (pushResult.status === 0) {
    console.log('🎉 Successfully pushed changes to GitHub!');
  }
}

// Debounce mechanism to avoid too frequent pushes
let pushTimeout = null;
export function schedulePush(commitMessage = 'Automated commit and push') {
  console.log(`⏰ Scheduling git push with debounce: "${commitMessage}"`);
  if (pushTimeout) {
    console.log('⏰ Clearing previous scheduled push');
    clearTimeout(pushTimeout);
  }
  pushTimeout = setTimeout(async () => {
    console.log('⏰ Debounce period expired, executing push now...');
    await pushToGitHub(commitMessage);
    pushTimeout = null;
  }, 5000); // 5 seconds debounce
  console.log('⏰ Push scheduled for 5 seconds from now');
}

// Function to validate git repository setup
export function validateGitSetup() {
  console.log('🔧 Validating git repository setup...');
  
  // Check if directory exists
  if (!fs.existsSync(repoPath)) {
    console.error(`❌ Repository directory does not exist: ${repoPath}`);
    return false;
  }
  
  // Check if it's a git repository
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    console.error(`❌ Directory is not a git repository: ${repoPath}`);
    return false;
  }
  
  // Check git status
  const result = spawnSync('git', ['status'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (result.error) {
    console.error('❌ Git status check failed:', result.error);
    return false;
  }
  
  if (result.status !== 0) {
    console.error('❌ Git status failed with status:', result.status);
    console.error('stderr:', result.stderr);
    return false;
  }
  
  console.log('✅ Git repository validation passed');
  return true;
}

// Export force sync function for external use
export { forceSync };

// If run directly, perform a push
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--validate') {
    validateGitSetup();
  } else if (process.argv[2] === '--force-sync') {
    console.log('🚨 Force sync requested via command line...');
    (async () => {
      await forceSync();
    })();
  } else {
    (async () => {
      await pushToGitHub(process.argv[2] || 'Automated commit and push');
    })();
  }
}
