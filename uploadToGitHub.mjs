// uploadToGitHub.mjs
import axios from 'axios';
import fs from 'fs';
import config from './config.js';

const { username, token, repo, branch } = config.github;
const filesToUpload = config.file.filesToUpload;

async function uploadFile({ sourceFile, destinationPath }) {
  try {
    const fileContent = fs.readFileSync(sourceFile, 'utf-8');
    const encodedContent = Buffer.from(fileContent).toString('base64');
    const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${destinationPath}`;

    // Step 1: Try to get the file SHA
    let existingFileSha = null;
    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      existingFileSha = response.data.sha;
    } catch (err) {
      if (err.response?.status !== 404) {
        throw err; // Unexpected error
      }
      console.log(`${destinationPath} does not exist, creating new file.`);
    }

    // Step 2: Upload or update the file
    const uploadResponse = await axios.put(apiUrl, {
      message: `Automated upload of ${destinationPath}`,
      content: encodedContent,
      branch,
      ...(existingFileSha && { sha: existingFileSha }),
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Uploaded: ${destinationPath}`);
  } catch (error) {
    console.error(`❌ Failed to upload ${sourceFile}:`, error.response?.data || error.message);
  }
}

async function uploadToGitHub() {
  for (const file of filesToUpload) {
    await uploadFile(file);
  }
}

uploadToGitHub().catch(console.error);
