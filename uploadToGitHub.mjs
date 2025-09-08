import { execSync } from "child_process";
import config from './config.js';

const {
  username,
  token,
  repo,
  branch,
  repoLocalPath
} = config.github;

let pushTimeout = null;
const DEBOUNCE_TIME = 30000; // 30 seconds

/**
 * Checks if there are uncommitted changes in the repo.
 * @param {string} repoPath - The local path to the git repository.
 * @returns {boolean} - True if changes exist, false otherwise.
 */
function hasChanges(repoPath) {
  const output = execSync("git status --porcelain", { cwd: repoPath }).toString();
  return output.trim().length > 0;
}

/**
 * Adds, commits, and pushes changes to GitHub if there are changes.
 * @param {string} repoPath - The local path to the git repository.
 * @param {string} commitMessage - The commit message.
 */
function pushToGitHub(repoPath, commitMessage = "Automated Commit and push from server.js project") {
  if (!hasChanges(repoPath)) {
    console.log("No changes to push.");
    return;
  }
  try {
    execSync("git add .", { cwd: repoPath });
    execSync(`git commit -m "${commitMessage}"`, { cwd: repoPath });
    execSync("git push", { cwd: repoPath });
    console.log("Pushed changes to GitHub.");
  } catch (e) {
    console.error("Error during git push:", e.stderr?.toString() || e.message);
  }
}

/**
 * Debounced function to schedule a push.
 * Multiple calls within DEBOUNCE_TIME will only result in a single push.
 * @param {string} commitMessage - The commit message.
 */
export function schedulePush(commitMessage) {
  const repoPath = repoLocalPath;
  if (!repoPath) {
    console.warn("No repoLocalPath configured, skipping git push.");
    return;
  }
  if (pushTimeout) clearTimeout(pushTimeout);
  pushTimeout = setTimeout(() => {
    pushToGitHub(repoPath, commitMessage);
    pushTimeout = null;
  }, DEBOUNCE_TIME);
}

// For CLI usage, allow node uploadToGitHub.mjs to trigger an immediate push
if (process.argv[1] === new URL(import.meta.url).pathname) {
  schedulePush("Automated Commit and push from server.js project");
}
