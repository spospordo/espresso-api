const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');  // Import exec to run the script
const app = express();
const { serverConfig, htmlConfig, fileConfig, ftpConfig, github } = require('./config'); // Import necessary settings

// Enable CORS
app.use(cors());

// Serve static files from the directory (from config.js)
app.use(express.static(serverConfig.staticFilesDirectory));

// Path to the JSON file where text values are stored (from config.js)
const textFilePath = serverConfig.textFilePath;

// Read the current text values from the JSON file
let textValues = {};

// Function to load text values from the JSON file
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

// Function to save text values to the JSON file
function saveTextValues() {
    fs.writeFileSync(textFilePath, JSON.stringify(textValues, null, 2));
}

// Load the text values when the server starts
loadTextValues();

// Endpoint to GET the dynamic text values
app.get('/get-text', (req, res) => {
    console.log('GET /get-text');
    res.json(textValues);  // Sends the text values as JSON to the client
});

// Endpoint to POST and update multiple dynamic text values
app.post('/update-texts', express.json(), (req, res) => {
    const updatedTextValues = req.body;  // Expecting an object with multiple key-value pairs
    
    if (!updatedTextValues || typeof updatedTextValues !== 'object') {
        return res.status(400).send('Invalid data format');
    }

    // Loop through each key-value pair and update them in the textValues object
    Object.keys(updatedTextValues).forEach(key => {
    textValues[key] = updatedTextValues[key];  // Add or update
    console.log(`Set ${key} to ${updatedTextValues[key]}`);
});


    saveTextValues();  // Save the updated values to the JSON file
    res.status(200).send('Text values updated successfully');

    // Run generateHTML.js first
    setTimeout(() => {
        if (!htmlConfig.originalHTMLPath) {
            console.log("Skipping generateHTML.js as originalHTMLPath is blank or null.");
            runConvertToJpeg(); // Move to the next step even if generateHTML.js is skipped
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

            // After generateHTML.js is done, run convertToJpeg.js
            runConvertToJpeg();
        });
    }, 3000); // 3-second delay after update-texts

    // Function to run convertToJpeg.js after a 3-second delay
    function runConvertToJpeg() {
        setTimeout(() => {
            if (!fileConfig.localFilePath) {
                console.log("Skipping convertToJpeg.js as localFilePath is blank or null.");
                runFtpFile(); // Move to the next step even if convertToJpeg.js is skipped
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

                // After convertToJpeg.js is done, run ftpFile.js and uploadToGitHub.mjs
                runFtpFile();
            });
        }, 3000); // 3-second delay after generateHTML.js
    }

    // Function to run ftpFile.js and uploadToGitHub.mjs after a 3-second delay
    function runFtpFile() {
        setTimeout(() => {
            if (!ftpConfig.host) {
                console.log("Skipping ftpFile.js as FTP settings are missing.");
                runUploadToGitHub(); // Move to the next step even if ftpFile.js is skipped
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

                // After ftpFile.js is done, run uploadToGitHub.mjs
                runUploadToGitHub();
            });
        }, 3000); // 3-second delay after convertToJpeg.js
    }

    // Function to run uploadToGitHub.mjs after a 3-second delay
    function runUploadToGitHub() {
        setTimeout(() => {
            if (!github.username) {
                console.log("Skipping uploadToGitHub.mjs as GitHub settings are missing.");
                return;
            }
            console.log('Running the uploadToGitHub.mjs script...');
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
        }, 3000); // 3-second delay after ftpFile.js
    }
});

// Start the server (using the port from config.js)
app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${serverConfig.port}`);
});
