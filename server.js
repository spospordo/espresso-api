import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { exec } from 'child_process';
import config from './config.js';

// Destructure config objects
const { serverConfig, htmlConfig, fileConfig, ftpConfig, github } = config;

// Dynamically import the schedulePush function for debounced git pushes
let schedulePush;
(async () => {
  try {
    const mod = await import('./uploadToGitHub.mjs');
    schedulePush = mod.schedulePush;
  } catch (err) {
    console.error('Could not import schedulePush:', err);
  }
})();

const app = express();

app.use(cors());
app.use(express.static(serverConfig.staticFilesDirectory));
const textFilePath = serverConfig.textFilePath;
let textValues = {};

function loadTextValues() {
    try {
        const data = fs.readFileSync(textFilePath, 'utf8');
        textValues = JSON.parse(data);
    } catch (err) {
        console.error("Could not read the text values file, using defaults.");
        textValues = {
            weight1: "test1",
            grind1: "test2",
            tempIn1: "test3",
            soak1: "test4"
        };
    }
}

function saveTextValues() {
    fs.writeFileSync(textFilePath, JSON.stringify(textValues, null, 2));
}

loadTextValues();

app.get('/get-text', (req, res) => {
    console.log('GET /get-text');
    res.json(textValues);
});

app.post('/update-texts', express.json(), (req, res) => {
    const updatedTextValues = req.body;
    if (!updatedTextValues || typeof updatedTextValues !== 'object') {
        return res.status(400).send('Invalid data format');
    }
    Object.keys(updatedTextValues).forEach(key => {
        textValues[key] = updatedTextValues[key];
        console.log(`Set ${key} to ${updatedTextValues[key]}`);
    });
    saveTextValues();
    res.status(200).send('Text values updated successfully');

    // Run generateHTML.js first
    setTimeout(() => {
        if (!htmlConfig.originalHTMLPath) {
            console.log("Skipping generateHTML.js as originalHTMLPath is blank or null.");
            runConvertToJpeg();
            return;
        }
        console.log('Running the generateHTML.js script...');
        exec('node generateHTML.js', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing generateHTML.js: ${error}`);
                return;
            }
            console.log(`generateHTML.js output: ${stdout}`);
            if (stderr) {
                console.error(`generateHTML.js stderr: ${stderr}`);
            }
            runConvertToJpeg();
        });
    }, 3000);

    function runConvertToJpeg() {
        setTimeout(() => {
            if (!fileConfig.localFilePath) {
                console.log("Skipping convertToJpeg.js as localFilePath is blank or null.");
                runFtpFile();
                return;
            }
            console.log('Running the convertToJpeg.js script...');
            exec('node convertToJpeg.js', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing convertToJpeg.js: ${error}`);
                    return;
                }
                console.log(`convertToJpeg.js output: ${stdout}`);
                if (stderr) {
                    console.error(`convertToJpeg.js stderr: ${stderr}`);
                }
                runFtpFile();
            });
        }, 3000);
    }

    function runFtpFile() {
        setTimeout(() => {
            if (!ftpConfig.host) {
                console.log("Skipping ftpFile.js as FTP settings are missing.");
                runUploadToGitHub();
                return;
            }
            console.log('Running the ftpFile.js script...');
            exec('node ftpFile.js', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing ftpFile.js: ${error}`);
                    return;
                }
                console.log(`ftpFile.js output: ${stdout}`);
                if (stderr) {
                    console.error(`ftpFile.js stderr: ${stderr}`);
                }
                runUploadToGitHub();
            });
        }, 3000);
    }

    function runUploadToGitHub() {
        setTimeout(async () => {
            if (!github.username) {
                console.log("Skipping uploadToGitHub.mjs as GitHub settings are missing.");
                return;
            }
            if (schedulePush) {
                console.log('Scheduling debounced GitHub push...');
                schedulePush("Automated Commit and push from server.js project");
            } else {
                console.log('Falling back to running uploadToGitHub.mjs directly...');
                exec('node --experimental-modules uploadToGitHub.mjs', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error executing uploadToGitHub.mjs: ${error}`);
                        return;
                    }
                    console.log(`uploadToGitHub.mjs output: ${stdout}`);
                    if (stderr) {
                        console.error(`uploadToGitHub.mjs stderr: ${stderr}`);
                    }
                });
            }
        }, 3000);
    }
});

app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${serverConfig.port}`);
});
