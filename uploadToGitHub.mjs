import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { github } from './config.js';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the path to your local GitHub Pages repo from config
const repoPath = github.repoLocalPath || '/home/pi/pages/spospordo.github.io';

// Function to check if there are changes to commit
function hasChanges() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoPath,
    encoding: 'utf8'
  });

  if (result.error) {
    console.error('Error running git status:', result.error);
    return false;
  }

  return result.stdout && result.stdout.trim().length > 0;
}

// Function to push changes to GitHub
function pushToGitHub(commitMessage = 'Automated commit and push') {
  if (!hasChanges()) {
    console.log('No changes to commit.');
    return;
  }

  // git add -A
  let result = spawnSync('git', ['add', '-A'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  if (result.error) {
    console.error('Error running git add:', result.error);
    return;
  }

  // git commit -m "message"
  result = spawnSync('git', ['commit', '-m', commitMessage], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  if (result.error) {
    console.error('Error running git commit:', result.error);
    return;
  }
  if (result.stdout) {
    console.log(result.stdout.trim());
  }
  if (result.stderr) {
    console.error(result.stderr.trim());
  }

  // git push
  result = spawnSync('git', ['push'], {
    cwd: repoPath,
    encoding: 'utf8'
  });
  if (result.error) {
    console.error('Error running git push:', result.error);
    return;
  }
  if (result.stdout) {
    console.log(result.stdout.trim());
  }
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
}

// Debounce mechanism to avoid too frequent pushes
let pushTimeout = null;
export function schedulePush(commitMessage = 'Automated commit and push') {
  if (pushTimeout) {
    clearTimeout(pushTimeout);
  }
  pushTimeout = setTimeout(() => {
    pushToGitHub(commitMessage);
    pushTimeout = null;
  }, 5000); // 5 seconds debounce
}

// If run directly, perform a push
if (import.meta.url === `file://${process.argv[1]}`) {
  pushToGitHub(process.argv[2] || 'Automated commit and push');
}
