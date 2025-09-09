// convertToJpeg.js
const puppeteer = require('puppeteer');
const { outputFiles } = require('./config'); // Now using externalized output path

async function captureScreenshot() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser', // Use the system-installed Chromium
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // The file to capture from should be an HTML file in your output folder
  // If you want to use a URL, you can externalize that in config as well
  try {
    await page.goto('file://' + outputFiles.html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.setViewport({ width: 800, height: 480 });

    // Take a screenshot and save it as JPEG to the Pages repo
    await page.screenshot({
      path: outputFiles.jpeg,
      type: 'jpeg',
      quality: 100,
    });

    console.log('Screenshot taken successfully!');
  } catch (error) {
    console.error('Error while navigating:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshot().catch(console.error);
