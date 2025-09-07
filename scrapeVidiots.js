// scrape.js
// Requires: axios, cheerio, node-cron
// Install: npm install axios cheerio node-cron

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const url = 'https://vidiotsfoundation.org/coming-soon/';

function truncateText(text, maxLength = 180) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength).trim() + '…' : text;
}

// Save image locally
async function downloadImage(url, filepath) {
  try {
    const response = await axios({ url, responseType: 'arraybuffer' });
    fs.writeFileSync(filepath, response.data);
  } catch (err) {
    console.error(`❌ Failed to download image ${url}:`, err.message);
  }
}

async function scrapeComingSoon() {
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const movies = [];

    // Create images folder if not exists
    const imgDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir);
    }

    $('div.showtimes-description').slice(0, 6).each((i, el) => {
      const title = $(el).find('h2.show-title a.title').text().trim();

      // Get all showtimes as array of strings
      const times = [];
      $(el).find('ol.showtimes.showtime-button-row li a.showtime').each((j, st) => {
        times.push($(st).text().trim());
      });

      let description = $(el).find('div.show-content p').first().text().trim();
      description = truncateText(description, 180);

      const posterUrl = $(el).find('div.show-poster img').attr('src') || '';

      if (title) {
        movies.push({
          title,
          times,
          description,
          posterUrl,
          posterFile: path.join('images', `movie${i + 1}.jpg`)
        });
      }
    });

    // Download posters locally
    for (let m of movies) {
      if (m.posterUrl) {
        await downloadImage(m.posterUrl, path.join(__dirname, m.posterFile));
      }
    }

    // Build HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Coming Soon — Vidiots</title>
  <style>
    body {
      width: 800px;
      height: 480px;
      margin: 0;
      padding: 10px;
      background: #222;
      color: #eee;
      font-family: sans-serif;
      filter: grayscale(100%);
      overflow: hidden;
    }
    h1 {
      text-align: center;
      font-size: 1.4em;
      margin: 0 0 8px;
    }
    .movie {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .poster {
      flex: 0 0 100px;
      margin-right: 8px;
    }
    .poster img {
      width: 100px;
      height: 150px;
      object-fit: cover;
      border: 1px solid #555;
    }
    .info {
      flex: 1;
      overflow: hidden;
    }
    .title {
      font-weight: bold;
      font-size: 1.05em;
      margin-bottom: 2px;
    }
    .times {
      font-style: italic;
      font-size: 0.9em;
      margin-bottom: 3px;
    }
    .description {
      font-size: 0.85em;
      line-height: 1.2em;
    }
  </style>
</head>
<body>
  <h1>Coming Soon at Vidiots</h1>
  ${movies.map(m => `
    <div class="movie">
      <div class="poster">
        ${m.posterUrl ? `<img src="${m.posterFile}" alt="${m.title} poster">` : ''}
      </div>
      <div class="info">
        <div class="title">${m.title}</div>
        <div class="times">
          ${m.times.map(t => `<div>${t}</div>`).join('')}
        </div>
        <div class="description">${m.description}</div>
      </div>
    </div>
  `).join('')}
</body>
</html>`;

    fs.writeFileSync('output.html', htmlContent.trim());
    console.log(`[${new Date().toLocaleString()}] ✅ Output written to output.html`);
  } catch (err) {
    console.error('❌ Error scraping:', err.message);
  }
}

// Run at 6 AM and 12 PM daily
cron.schedule('0 6,12 * * *', () => {
  console.log('⏰ Running scheduled scrape...');
  scrapeComingSoon();
});

// Run once immediately
scrapeComingSoon();
