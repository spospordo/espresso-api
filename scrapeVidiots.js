const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const cron = require('node-cron');

const url = 'https://vidiotsfoundation.org/coming-soon/';

function truncateText(text, maxLength = 180) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength).trim() + '…';
  }
  return text;
}

async function scrapeComingSoon() {
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const movies = [];

    // Grab the first 6 movie blocks
    $('div.showtimes-description').slice(0, 6).each((i, el) => {
      const title = $(el).find('h2.show-title a.title').text().trim();

      // Collect all showtimes
      const times = [];
      $(el).find('ol.showtimes.showtime-button-row li a.showtime').each((j, st) => {
        times.push($(st).text().trim());
      });

      // Description (truncate)
      let description = $(el).find('div.show-content p').first().text().trim();
      description = truncateText(description, 180);

      // Poster image
      const poster = $(el).find('div.show-poster img').attr('src') || '';

      if (title) {
        movies.push({
          title,
          times: times.join(', '),
          description,
          poster,
        });
      }
    });

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
      height: auto;
      object-fit: cover;
      border: 1px solid #555;
    }
    .info {
      flex: 1;
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
        ${m.poster ? `<img src="${m.poster}" alt="${m.title} poster">` : ''}
      </div>
      <div class="info">
        <div class="title">${m.title}</div>
        <div class="times">${m.times}</div>
        <div class="description">${m.description}</div>
      </div>
    </div>
  `).join('')}
</body>
</html>`;

    fs.writeFileSync('outputScrapeVidiots.html', htmlContent.trim());
    console.log(`[${new Date().toLocaleString()}] Output written to output.html`);
  } catch (err) {
    console.error('Error scraping:', err);
  }
}

// Run at 6 AM and 12 PM every day
cron.schedule('0 6,12 * * *', () => {
  console.log('Running scheduled scrape...');
  scrapeComingSoon();
});

// Run immediately at startup
scrapeComingSoon();

