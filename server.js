const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');  // Import exec to run the script
const app = express();
const { serverConfig } = require('./config'); // Import the server configuration from config.js

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

    res.status(200).send('Text values updated and HTML generation triggered.');

    setTimeout(() => {
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
    }, 5000); // Delay of 5 seconds (5000 milliseconds) before running convertToJpeg.js

   //Add return here to prevent any further code from executing after response is sent
   return;
});

// Start the server (using the port from config.js)
app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${serverConfig.port}`);
});
