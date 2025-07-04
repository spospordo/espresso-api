import axios from 'axios';
import fs from 'fs';
import config from './config.js';

const { username, token, repo, branch } = config.github;
const { filesToUpload } = config.file;

if (!filesToUpload || !Array.isArray(filesToUpload)) {
    console.error('❌ Invalid or missing filesToUpload array in config.');
    process.exit(1);
}

async function uploadFile({ sourceFile, destinationPath }) {
    if (!sourceFile || !destinationPath) {
        console.error(`❌ Missing sourceFile or destinationPath:\n  sourceFile: ${sourceFile}\n  destinationPath: ${destinationPath}`);
        return;
    }

    console.log(`📤 Preparing to upload: ${sourceFile} ➜ ${destinationPath}`);

    const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${destinationPath}`;

    let encodedContent;
    try {
        const fileContent = fs.readFileSync(sourceFile);  // Binary-safe read
        encodedContent = Buffer.from(fileContent).toString('base64');
    } catch (err) {
        console.error(`❌ Failed to read file ${sourceFile}:`, err.message);
        return;
    }

    let existingSha = null;

    try {
        const getResp = await axios.get(apiUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        existingSha = getResp.data.sha;
        console.log(`${destinationPath} exists, will update.`);
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log(`${destinationPath} does not exist, creating new file.`);
        } else {
            console.error(`❌ Failed to check if ${destinationPath} exists:`, err.message);
            return;
        }
    }

    try {
        const uploadResp = await axios.put(apiUrl, {
            message: `Automated upload of ${destinationPath}`,
            content: encodedContent,
            branch,
            ...(existingSha && { sha: existingSha }),  // Only include SHA if updating
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (uploadResp.status === 201 || uploadResp.status === 200) {
            console.log(`✅ Uploaded: ${destinationPath}`);
        } else {
            console.warn(`⚠️ Unexpected response status: ${uploadResp.status}`);
        }
    } catch (err) {
        console.error(`❌ Failed to upload ${sourceFile}:`, err.response?.data || err.message);
    }
}

async function uploadToGitHub() {
    for (const file of filesToUpload) {
        await uploadFile(file);
    }
}

uploadToGitHub().catch(err => {
    console.error('❌ Unexpected error in upload process:', err.message);
});
