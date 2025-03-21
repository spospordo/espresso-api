const axios = require('axios');
const fs = require('fs');
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

    try {
        // Step 1: Check if the file already exists in the repository
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        // If file exists, get the SHA of the existing file
        const existingFileSha = response.data.sha;

        // Step 2: Upload the new file (update if file exists, create if it doesn't)
        const uploadResponse = await axios.put(apiUrl, {
            message: 'Automated upload of output.html',
            content: encodedContent,
            branch: branch,
            sha: existingFileSha, // This tells GitHub to overwrite the file if it exists
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (uploadResponse.status === 201) {
            console.log('File uploaded successfully to GitHub Pages');
        }
    } catch (error) {
        // If the file doesn't exist, the GET request will throw an error (404). 
        // We will catch that error and proceed to upload a new file.
        if (error.response && error.response.status === 404) {
            console.log('File does not exist, uploading a new file...');
            try {
                const uploadResponse = await axios.put(apiUrl, {
                    message: 'Automated upload of output.html',
                    content: encodedContent,
                    branch: branch,
                }, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (uploadResponse.status === 201) {
                    console.log('File uploaded successfully to GitHub Pages');
                }
            } catch (uploadError) {
                console.error('Failed to upload to GitHub Pages:', uploadError.response ? uploadError.response.data : uploadError.message);
            }
        } else {
            console.error('Failed to upload to GitHub Pages:', error.response ? error.response.data : error.message);
        }
    }
}

uploadToGitHub().catch(console.error);
