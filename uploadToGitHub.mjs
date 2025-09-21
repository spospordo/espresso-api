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
    return false;
  }
  
  console.log('✅ Successfully pulled changes from remote');
  if (pullResult.stdout && pullResult.stdout.trim()) {
    console.log('📊 Pull output:', pullResult.stdout.trim());
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
      
      // Try to pull changes from remote
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
        console.error('❌ Failed to pull remote changes, cannot retry push');
        retryAttempts = 0; // Reset for next time
        return;
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

// If run directly, perform a push
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--validate') {
    validateGitSetup();
  } else {
    (async () => {
      await pushToGitHub(process.argv[2] || 'Automated commit and push');
    })();
  }
}
