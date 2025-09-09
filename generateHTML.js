// generateHTML.js
const fs = require('fs');
const { outputFiles, htmlConfig } = require('./config');
const { JSDOM } = require('jsdom');

// Use dynamic import for node-fetch (ESM only, works in CommonJS this way)
async function main() {
  const fetch = (await import('node-fetch')).default;

  const originalHTMLPath = htmlConfig.originalHTMLPath;
  const serverURL = htmlConfig.serverURL;
  const imagePaths = htmlConfig.imagePaths;

  // Fetch the dynamic text values from the server
  const textValues = await fetch(serverURL)
    .then(response => response.json())
    .catch(err => {
      console.error('Error fetching text values:', err);
      return {};
    });

  // Read the original HTML file
  fs.readFile(originalHTMLPath, 'utf8', (err, htmlContent) => {
    if (err) {
      console.error('Error reading the original HTML file:', err);
      return;
    }

    const dom = new JSDOM(htmlContent, {
      contentType: 'text/html',
      includeNodeLocations: true,
    });

    // Remove all <script> tags
    const scripts = dom.window.document.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Update text values
    for (const key in textValues) {
      const element = dom.window.document.getElementById(key);
      if (element) {
        element.textContent = textValues[key];
      }
    }

    // Update images
    const imageElements = dom.window.document.querySelectorAll('img');
    imageElements.forEach((imgElement) => {
      const altText = imgElement.alt?.toLowerCase() || '';
      const imageKey = altText.replace(' ', '').toLowerCase();
      if (imagePaths && imagePaths[imageKey]) {
        imgElement.src = imagePaths[imageKey];
      }
    });

    // Save updated HTML to the externalized output HTML path in the Pages repo
    fs.writeFile(outputFiles.html, dom.serialize(), 'utf8', (err) => {
      if (err) {
        console.error('Error saving the updated HTML file:', err);
      } else {
        console.log('HTML file generated successfully:', outputFiles.html);
      }
    });
  });
}

main().catch(console.error);
