const puppeteer = require('puppeteer');
const ftp = require('basic-ftp');
const path = require('path');
const { ftpConfig, fileConfig } = require('./config'); // Import FTP and file configuration from config.js

async function captureScreenshot() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser', // Use the system-installed Chromium
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Useful for restricted environments
  });
  
  const page = await browser.newPage();

  const filePath = fileConfig.localFilePath; // Use the URL from config.js
  try {
    // Increase the timeout and wait until DOM is loaded
    await page.goto(filePath, { waitUntil: 'domcontentloaded', timeout: 60000 }); // 60 seconds timeout
    await page.setViewport({ width: 800, height: 400 });

    const outputPath = fileConfig.localOutputPath; // Use the local file path from config.js

    // Take a screenshot and save it as JPEG
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: 100, // You can adjust the quality (0-100)
    });

    console.log('Screenshot taken successfully!');

    // FTP upload after the screenshot is saved
    await uploadToFTP(outputPath);

  } catch (error) {
    console.error('Error while navigating:', error);
  } finally {
    await browser.close();
  }
}

async function uploadToFTP(filePath) {
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enable verbose logging (optional, helpful for debugging)

  try {
    // Connect to the FTP server using values from config.js
    await client.access({
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
      secure: ftpConfig.secure,
      pasv: ftpConfig.pasv
    });

    // Upload the JPEG file to the remote server using the remote path from config.js
    console.log(`Uploading ${filePath} to FTP server...`);
    await client.uploadFrom(filePath, fileConfig.remoteOutputPath); // Remote path from config.js
    console.log('File uploaded successfully!');
    
  } catch (error) {
    console.error('Error uploading file to FTP:', error);
  } finally {
    client.close();
  }
}

captureScreenshot().catch(console.error);
