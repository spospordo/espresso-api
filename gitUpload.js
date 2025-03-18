const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const git = simpleGit();
const config = require('./config'); // Import configuration from config.js

// Function to upload file to the Git repo
async function uploadFile() {
    // Access the grouped git upload configurations
    const { sourceFilePath, targetFolderInRepo, gitRepoDir, gitBranch, commitMessage, gitRemote, gitUsername, gitPassword } = config.gitUploadConfig;

    // Ensure the file exists before proceeding
    if (!fs.existsSync(sourceFilePath)) {
        console.error(`The file does not exist: ${sourceFilePath}`);
        return;
    }

    try {
        // Change to the git repository directory
        process.chdir(gitRepoDir);
        console.log(`Changed directory to: ${gitRepoDir}`);

        // Get the file name from the source file path
        const fileName = path.basename(sourceFilePath); 
        
        // Define the destination path in the Git repo
        const destFilePath = path.join(gitRepoDir, targetFolderInRepo, fileName); // Combine target folder and file name

        // Ensure the target folder exists in the repo, create if necessary
        const targetFolder = path.dirname(destFilePath);
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
            console.log(`Created target folder: ${targetFolder}`);
        }

        // Copy the file to the repository folder
        fs.copyFileSync(sourceFilePath, destFilePath);
        console.log(`File copied to: ${destFilePath}`);

        // Stage the file in Git
        await git.add(destFilePath);
        console.log(`File staged: ${destFilePath}`);

        // Commit the file
        await git.commit(commitMessage);
        console.log('File committed');

        // Modify remote URL with authentication credentials (username and personal access token)
        const remoteUrl = `https://${gitUsername}:${gitPassword}@github.com/${gitRemote}/${gitRepoDir}.git`;
        
        // Add the remote URL with the credentials
        await git.addRemote('origin', remoteUrl);
        console.log('Git remote set with authentication credentials');

        // Push to the remote repository
        await git.push('origin', gitBranch);  // Push to the remote repo and specified branch
        console.log('File pushed to remote repository');
    } catch (err) {
        console.error(`Error during file upload: ${err}`);
    }
}

// Run the upload function
uploadFile();
