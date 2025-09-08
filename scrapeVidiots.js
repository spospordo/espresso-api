const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const sharp = require('sharp');
const cron = require('node-cron');

const BASE_URL = 'https://vidiotsfoundation.org';
const url = `${BASE_URL}/coming-soon/`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36',
  'Referer': BASE_URL
};

function truncateText(text, maxLength = 180) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength).trim() + '…' : text;
}

async function downloadAndResizeImage(imageUrl, localFile) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', headers: HEADERS });
    if (!response.headers['content-type'] || !response.headers['content-type'].startsWith('image')) {
      throw new Error('Not an image content-type: ' + response.headers['content-type']);
    }
    await sharp(response.data)
      .resize(100, 150, { fit: 'inside', withoutEnlargement: true })
      .toFile(localFile);
    console.log(`✅ Image saved and resized: ${localFile}`);
  } catch (err) {
    console.error(`❌ Download/resize failed for ${imageUrl}: ${err.message}`);
  }
}

async function scrapeComingSoon() {
  try {
    console.log(`🌐 Fetching: ${url}`);
    const { data: html } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(html);

    const movies = [];

    $('div.showtimes-description').slice(0, 6).each((i, el) => {
      const title = $(el).find('h2.show-title a.title').text().trim();

      // Find poster image: previous .show-details > .show-poster > .show-poster-inner > img
      let posterUrl = '';
      let parentShowDetails = $(el).closest('.show-details');
      if (parentShowDetails.length) {
        const img = parentShowDetails.find('.show-poster-inner img').attr('src');
        if (img) posterUrl = img;
      }
      if (posterUrl) {
        console.log(`🖼 Poster URL for "${title}": ${posterUrl}`);
      }

      // Save in current folder, not images/
      const posterFile = `vidiotsPoster${i + 1}.jpg`;

      // --- NEW: Robust Dates and Times Extraction (no pairing logic) ---
      const uniqueDates = new Set();
      // All .show-date spans (multi-date)
      parentShowDetails.find('ul.datelist li.show-date span').each((j, span) => {
        const dateTxt = $(span).text().replace(/\s+/g, ' ').replace(' ,', ',').trim();
        if (dateTxt) uniqueDates.add(dateTxt);
      });
      // Single-date fallback
      parentShowDetails.find('.selected-date.show-datelist.single-date span').each((j, span) => {
        const dateTxt = $(span).text().replace(/\s+/g, ' ').replace(' ,', ',').trim();
        if (dateTxt) uniqueDates.add(dateTxt);
      });

      const uniqueTimes = new Set();
      parentShowDetails.find('a.showtime').each((j, a) => {
        const timeTxt = $(a).text().trim();
        if (timeTxt) uniqueTimes.add(timeTxt);
      });

      // Format: date1, date2 — time1, time2, time3 (if both present)
      let schedule = '';
      if (uniqueDates.size && uniqueTimes.size) {
        schedule = Array.from(uniqueDates).join(', ') + ' — ' + Array.from(uniqueTimes).join(', ');
      } else if (uniqueDates.size) {
        schedule = Array.from(uniqueDates).join(', ');
      } else if (uniqueTimes.size) {
        schedule = Array.from(uniqueTimes).join(', ');
      }

      // Description
      let description = $(el).find('div.show-content p').first().text().trim();
      description = truncateText(description, 180);

      // Unique pills
      const pillsSet = new Set();
      $(el).find('.pill-container .pill').each((_, pill) => {
        const pillText = $(pill).text().trim();
        if (pillText) pillsSet.add(pillText);
      });
      const pills = Array.from(pillsSet);

      if (title) {
        movies.push({
          title,
          schedule,
          description,
          posterUrl,
          posterFile,
          pills
        });
      }
    });

    // Download and resize posters
    for (const m of movies) {
      if (m.posterUrl) {
        console.log(`⬇️ Downloading poster for "${m.title}" -> ${m.posterUrl}`);
        await downloadAndResizeImage(m.posterUrl, m.posterFile);
      } else {
        console.log(`⚠️ No poster URL for "${m.title}"`);
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
  html, body {
    width: 800px;
    height: 480px;
    max-width: 800px;
    max-height: 480px;
    min-width: 800px;
    min-height: 480px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #fff;
    color: #000;
    font-family: sans-serif;
  }
  body { padding: 10px; box-sizing: border-box; }
  h1 { text-align: center; font-size: 1.4em; margin: 0 0 8px; }
  .movie { display: flex; flex-direction: row; align-items: flex-start; margin-bottom: 8px; }
  .poster { flex: 0 0 100px; margin-right: 8px; }
  .poster img { width: 100px; height: 150px; object-fit: contain; border: 1px solid #aaa; filter: grayscale(100%); }
  .info { flex: 1; overflow: hidden; }
  .title { font-weight: bold; font-size: 1.05em; margin-bottom: 2px; }
  .schedule { font-style: italic; font-size: 0.9em; margin-bottom: 3px; }
  .description { font-size: 0.85em; line-height: 1.2em; }
  .pills { font-size: 0.85em; margin-bottom: 2px; color: #fff; background: #444; border-radius: 8px; padding: 2px 8px; display: inline-block; }
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
        <div class="schedule">${m.schedule}</div>
        ${m.pills && m.pills.length > 0 ? `<div class="pills">${m.pills.join(', ')}</div>` : ''}
        <div class="description">${m.description}</div>
      </div>
    </div>`).join('')}
</body>
</html>`;

    fs.writeFileSync('outputScrapeVidiots.html', htmlContent.trim());
    console.log(`📝 HTML generated: outputScrapeVidiots.html`);
  } catch (err) {
    console.error('❌ Error scraping:', err.message);
  }
}

// Schedule scraping
cron.schedule('0 6,12 * * *', () => {
  console.log('⏰ Running scheduled scrape...');
  scrapeComingSoon();
});

// Run immediately
scrapeComingSoon();
