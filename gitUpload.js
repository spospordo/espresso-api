// gitUpload3.js

const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { Client } = require('ssh2');
const config = require('./config');  // Import configuration from config.js

const git = simpleGit();

// Function to upload file via SSH to a specific folder in the Git repo
async function uploadFile() {
    // Destructure the git and SSH configuration from config.js
    const { sourceFilePath, targetFolderInRepo, gitRepoDir, gitBranch, commitMessage, gitRemote, sshConfig } = config.gitUploadConfig;

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

        // Upload the file to the Git repository folder via SSH
        await uploadFileViaSSH(sourceFilePath, destFilePath, sshConfig);
        console.log(`File uploaded to the Git repo folder via SSH: ${destFilePath}`);

        // Stage the file in Git
        await git.add(destFilePath);
        console.log(`File staged: ${destFilePath}`);

        // Commit the file
        await git.commit(commitMessage);
        console.log('File committed');

        // Check if the remote origin already exists
        const remotes = await git.getRemotes();
        const remoteUrl = `git@github.com:${gitRemote}.git`;

        // If 'origin' remote exists, update it. Otherwise, add it.
        if (remotes.some(remote => remote.name === 'origin')) {
            await git.remote(['set-url', 'origin', remoteUrl]);  // Update the remote URL
            console.log('Updated the remote URL for origin');
        } else {
            await git.addRemote('origin', remoteUrl);  // Add the remote if it doesn't exist
            console.log('Git remote set with SSH credentials');
        }

        // Push to the remote repository
        await git.push('origin', gitBranch);  // Push to the remote repo and specified branch
        console.log('File pushed to remote repository');
    } catch (err) {
        console.error(`Error during file upload: ${err}`);
    }
}

// Function to upload a file via SSH
function uploadFileViaSSH(sourceFilePath, destFilePath, sshConfig) {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            console.log('SSH Connection established.');

            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(`SFTP error: ${err}`);
                }

                // Upload the file using SFTP
                sftp.fastPut(sourceFilePath, destFilePath, (err) => {
                    if (err) {
                        return reject(`File upload failed: ${err}`);
                    }

                    console.log(`File uploaded successfully to: ${destFilePath}`);
                    conn.end();
                    resolve();
                });
            });
        }).on('error', (err) => {
            reject(`SSH connection error: ${err}`);
        }).connect(sshConfig);
    });
}

// Run the upload function
uploadFile();
