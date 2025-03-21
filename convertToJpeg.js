// convertToJpeg.js
const puppeteer = require('puppeteer');
const { fileConfig } = require('./config'); // Import file configuration from config.js

async function captureScreenshot() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser', // Use the system-installed Chromium
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Useful for restricted environments
  });

  const page = await browser.newPage();

  const filePath = fileConfig.localFilePath; // URL to capture from
  try {
    // Increase the timeout and wait until DOM is loaded
    await page.goto(filePath, { waitUntil: 'domcontentloaded', timeout: 60000 }); // 60 seconds timeout
    await page.setViewport({ width: 800, height: 480 });

    const outputPath = fileConfig.localOutputPath; // Path to save the screenshot locally

    // Take a screenshot and save it as JPEG
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: 100, // You can adjust the quality (0-100)
    });

    console.log('Screenshot taken successfully!');

    // Now you can call the FTP upload function here if needed
    // import the uploadToFTP function if needed later, but this file is just for screenshot now.
    
  } catch (error) {
    console.error('Error while navigating:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshot().catch(console.error);
