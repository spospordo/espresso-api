const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // Make sure to install node-fetch
const config = require('./config.js');

// Function to upload content to GitHub Pages
async function uploadToGitHub() {
    const { username, token, repo, branch } = config.github;
    const { sourceFile, destinationFolder } = config.file;

    // Read the content of the HTML file you want to upload
    const fileContent = fs.readFileSync(sourceFile, 'utf-8');
    
    // API URL for uploading content to the GitHub Pages repo
    const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${destinationFolder}/output.html`;

    // Prepare the request body with the file content in base64
    const encodedContent = Buffer.from(fileContent).toString('base64');

    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Automated upload of output.html',
            content: encodedContent,
            branch: branch,
        }),
    });

    if (!response.ok) {
        console.error('Failed to upload to GitHub Pages:', response.statusText);
    } else {
        console.log('File uploaded successfully to GitHub Pages');
    }
}

uploadToGitHub().catch(console.error);
