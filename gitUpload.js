// gitUpload.js
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { gitConfig } = require('./config'); // Import the configuration
const fsExtra = require('fs-extra'); // To copy files

// Initialize simple-git with the path to your local git repo
const git = simpleGit();

// Function to upload the file to the Git repo
async function uploadFile() {
  const { username, password, repoURL, folderPath, commitMessage, fileToUpload, targetFolder, branchName } = gitConfig;

  try {
    // Change to the folder where the git repository is located (if it's not already initialized)
    const repoPath = path.join(__dirname, folderPath);
    process.chdir(repoPath);

    // Clone the repo if it doesn't exist locally (you can skip this if it's already cloned)
    if (!fs.existsSync('.git')) {
      console.log('Cloning the repository...');
      await git.clone(repoURL);
      console.log('Repository cloned successfully.');
    }

    // Checkout to the specific branch if it's not already checked out
    await git.checkout(branchName);

    // Define the target file path where you want to copy the file in the repo
    const targetPath = path.join(repoPath, targetFolder, path.basename(fileToUpload));
    
    // Copy the file to the target folder in the repository
    console.log(`Copying file to ${targetPath}...`);
    await fsExtra.copy(fileToUpload, targetPath);

    // Add the copied file to the git staging area
    console.log('Adding file to git...');
    await git.add(path.join(targetFolder, path.basename(fileToUpload)));

    // Commit the changes
    console.log('Committing the changes...');
    await git.commit(commitMessage);

    // Push the changes to the remote repository
    console.log('Pushing the changes...');
    await git.push('origin', branchName);

    console.log('File uploaded successfully to Git repository!');
  } catch (error) {
    console.error('Error during file upload:', error);
  }
}

// Run the function to upload the file
uploadFile();
