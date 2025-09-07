// vidiots.js
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const BASE_URL = 'https://vidiotsfoundation.org';
const url = `${BASE_URL}/coming-soon/`;

function truncateText(text, maxLength = 180) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength).trim() + '…' : text;
}

// Save image locally
async function downloadImage(imageUrl, localFile) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(localFile, response.data);
    console.log(`✅ Saved image: ${localFile}`);
  } catch (err) {
    console.error(`❌ Failed to download image ${imageUrl}: ${err.message}`);
  }
}

async function scrapeComingSoon() {
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const movies = [];

    // Ensure images folder exists
    const imgDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir);
    }

    $('div.showtimes-description').slice(0, 6).each((i, el) => {
      const title = $(el).find('h2.show-title a.title').text().trim();

      // Collect all showtimes (date + time)
      const times = [];
      $(el).find('ol.showtimes.showtime-button-row li a.showtime').each((j, st) => {
        const txt = $(st).text().trim();
        if (txt) times.push(txt);
      });

      let description = $(el).find('div.show-content p').first().text().trim();
      description = truncateText(description, 180);

      // Get poster URL and normalize
      let posterUrl = $(el).find('div.show-poster img').attr('src') || '';
      if (posterUrl.startsWith('//')) {
        posterUrl = 'https:' + posterUrl;
      } else if (posterUrl.startsWith('/')) {
        posterUrl = BASE_URL + posterUrl;
      }

      const posterFile = path.join(imgDir, `vidiotsPoster${i + 1}.jpg`);

      if (title) {
        movies.push({ title, times, description, posterUrl, posterFile });
      }
    });

    // Download posters locally
    for (const m of movies) {
      if (m.posterUrl) {
        await downloadImage(m.posterUrl, m.posterFile);
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
      background: #fff;
      color: #000;
      font-family: sans-serif;
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
      border: 1px solid #aaa;
      filter: grayscale(100%);
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
        ${m.posterUrl ? `<img src="images/${path.basename(m.posterFile)}" alt="${m.title} poster">` : ''}
      </div>
      <div class="info">
        <div class="title">${m.title}</div>
        <div class="times">${m.times.map(t => `<div>${t}</div>`).join('')}</div>
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

// Schedule scraping at 6 AM and 12 PM daily
cron.schedule('0 6,12 * * *', () => {
  console.log('⏰ Running scheduled scrape...');
  scrapeComingSoon();
});

// Run immediately when script is executed
scrapeComingSoon();
