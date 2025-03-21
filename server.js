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
        if (textValues[key] !== undefined) {
            textValues[key] = updatedTextValues[key];  // Update the value in the object
            console.log(`Updated ${key} to ${updatedTextValues[key]}`);
        } else {
            console.error(`Invalid key: ${key}`);
        }
    });

    saveTextValues();  // Save the updated values to the JSON file
    res.status(200).send('Text values updated successfully');

    // After the update, wait for 5 seconds and then run the generateHTML script
    setTimeout(() => {
        if (!htmlConfig.originalHTMLPath) {
            console.log("Skipping generateHTML.js as originalHTMLPath is blank or null.");
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
        });
    }, 5000); // Delay of 5 seconds (5000 milliseconds)

    // After running generateHTML.js, wait for 5 seconds and run convertToJpeg.js
    setTimeout(() => {
        if (!fileConfig.localFilePath) {
            console.log("Skipping convertToJpeg.js as localFilePath is blank or null.");
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
        });
    }, 10000); // Delay of 10 seconds (5000 + 5000) before running convertToJpeg.js

    // After running convertToJpeg.js, wait for another 5 seconds and run uploadToGitHub.mjs
    setTimeout(() => {
        if (!ftpConfig.Host) {
            console.log("Skipping uploadToGitHub.mjs as Host is blank or null.");
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
    }, 15000); // Delay of 15 seconds (5000 + 5000 + 5000) before running uploadToGitHub.mjs

    // Add return here to prevent any further code from executing after response is sent
    return;
});

// Start the server (using the port from config.js)
app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${serverConfig.port}`);
});
