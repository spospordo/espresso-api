const fs = require('fs');
const simpleGit = require('simple-git');
const chokidar = require('chokidar');
const path = require('path');
const config = require('./config');  // Import the externalized config

// Initialize simple-git
const git = simpleGit(config.gitUploadConfig.repoDir);

// Watch for changes in the output.html file
chokidar.watch(config.gitUploadConfig.localFilePath).on('change', async (filePath) => {
    console.log(`File ${filePath} has changed!`);

    // Copy the updated file into the GitHub repository folder's TRMNL subfolder
    const destFolderPath = path.join(config.gitUploadConfig.repoDir, config.gitUploadConfig.targetFolder);
    const destFilePath = path.join(destFolderPath, 'output.html');

    // Ensure the TRMNL folder exists in the local repo
    if (!fs.existsSync(destFolderPath)) {
        fs.mkdirSync(destFolderPath, { recursive: true });
    }

    fs.copyFileSync(config.gitUploadConfig.localFilePath, destFilePath);
    console.log(`File copied to: ${destFilePath}`);

    try {
        // Navigate to the git repository directory
        process.chdir(config.gitUploadConfig.repoDir);

        // Add, commit, and push the changes to GitHub
        await git.add(destFilePath);
        await git.commit(config.gitUploadConfig.commitMessage);
        await git.push(config.gitUploadConfig.gitRemote, config.gitUploadConfig.gitBranch);

        console.log('Successfully pushed updated file to GitHub!');
    } catch (error) {
        console.error('Error during file upload:', error);
    }
});

console.log(`Watching for changes in ${config.gitUploadConfig.localFilePath}`);
