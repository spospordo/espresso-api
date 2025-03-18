// Import required modules
const fs = require('fs');
const path = require('path');

// Dynamic import for `node-fetch` to support ES modules
(async () => {
    const fetch = (await import('node-fetch')).default; // Fetch dynamically loaded

    const { JSDOM } = require('jsdom'); // Import JSDOM after dynamic import of fetch
    const { htmlConfig } = require('./config'); // Import the HTML configuration from config.js

    // Use the values from config.js for the file paths and server URL
    const originalHTMLPath = htmlConfig.originalHTMLPath;
    const outputHTMLPath = htmlConfig.outputHTMLPath;
    const serverURL = htmlConfig.serverURL;

    // Fetch the dynamic text values from the server
    const textValues = await fetch(serverURL)  // Use the server URL from config.js
        .then(response => response.json())
        .catch(err => {
            console.error('Error fetching text values:', err);
            return {};  // Return an empty object if fetching fails
        });

    // Read the original HTML file
    fs.readFile(originalHTMLPath, 'utf8', (err, htmlContent) => {
        if (err) {
            console.error('Error reading the original HTML file:', err);
            return;
        }

        // Use JSDOM to manipulate the HTML content
        const dom = new JSDOM(htmlContent);

        // Strip all <script> tags from the DOM
        const scripts = dom.window.document.querySelectorAll('script');
        scripts.forEach(script => script.remove());

        // Loop through the text values and update the corresponding elements
        for (const key in textValues) {
            const element = dom.window.document.getElementById(key);
            if (element) {
                element.textContent = textValues[key];  // Set the updated text value
            }
        }

        // Save the updated HTML to the output path
        fs.writeFile(outputHTMLPath, dom.window.document.documentElement.outerHTML, 'utf8', (err) => {
            if (err) {
                console.error('Error saving the updated HTML file:', err);
            } else {
                console.log('HTML file generated successfully: ' + outputHTMLPath);
            }
        });
    });
})();
