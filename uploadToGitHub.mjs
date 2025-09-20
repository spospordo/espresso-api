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

// Function to check if there are changes to commit
function hasChanges() {
  console.log(`🔍 Checking for changes in: ${repoPath}`);
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoPath,
    encoding: 'utf8'
  });

  if (result.error) {
    console.error('❌ Error running git status:', result.error);
    return false;
  }
  
  if (result.status !== 0) {
    console.error('❌ git status failed with status:', result.status);
    console.error('stderr:', result.stderr);
    return false;
  }

  const hasChanges = result.stdout && result.stdout.trim().length > 0;
  if (hasChanges) {
    console.log('📋 Changes detected:');
    console.log(result.stdout.trim());
  } else {
    console.log('📋 No changes detected');
  }
  
  return hasChanges;
}

// Function to push changes to GitHub
function pushToGitHub(commitMessage = 'Automated commit and push') {
  console.log(`🚀 Starting git upload process with message: "${commitMessage}"`);
  console.log(`📁 Repository path: ${repoPath}`);
  
  if (!hasChanges()) {
    console.log('📋 No changes to commit.');
    return;
  }

  console.log('📝 Changes detected, proceeding with git operations...');

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

  // git push
  console.log('⬆️  Pushing to GitHub...');
  result = spawnSync('git', ['push'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  if (result.error) {
    console.error('❌ Error running git push:', result.error);
    return;
  }
  if (result.status !== 0) {
    console.error('❌ git push failed with status:', result.status);
    console.error('stderr:', result.stderr);
    return;
  }
  
  // Git push can have output in stderr that's not an error (like progress info)
  if (result.stdout && result.stdout.trim()) {
    console.log('✅ Push successful:', result.stdout.trim());
  }
  if (result.stderr && result.stderr.trim()) {
    // stderr might contain progress information, not necessarily errors
    console.log('📊 Push info:', result.stderr.trim());
  }
  
  if (result.status === 0) {
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
  pushTimeout = setTimeout(() => {
    console.log('⏰ Debounce period expired, executing push now...');
    pushToGitHub(commitMessage);
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
    pushToGitHub(process.argv[2] || 'Automated commit and push');
  }
}
