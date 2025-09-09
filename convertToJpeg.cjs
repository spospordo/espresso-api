// convertToJpeg.js
const puppeteer = require('puppeteer');
const { outputFiles } = require('./config.cjs');
const path = require('path');

async function captureScreenshot() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser', // Adjust if your chromium path is different
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    // Load the HTML file from the externalized path
    await page.goto('file://' + outputFiles.html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.setViewport({ width: 800, height: 480 });

    // Take a screenshot and save it as JPEG to the Pages repo
    await page.screenshot({
      path: outputFiles.jpeg,
      type: 'jpeg',
      quality: 100,
    });

    console.log('Screenshot taken successfully!', outputFiles.jpeg);
  } catch (error) {
    console.error('Error while capturing screenshot:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshot().catch(console.error);
