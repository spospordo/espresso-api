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

// --- Save image with debug logging ---
async function downloadImage(imageUrl, localFile) {
  try {
    console.log(`➡️  Attempting to download: ${imageUrl}`);
    const writer = fs.createWriteStream(localFile);
    const response = await axios.get(imageUrl, { responseType: 'stream' });
    console.log(`📥 Response status for ${imageUrl}: ${response.status}`);

    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Image saved: ${localFile}`);
        resolve();
      });
      writer.on('error', (err) => {
        console.error(`❌ Write error for ${localFile}:`, err.message);
        reject(err);
      });
    });
  } catch (err) {
    console.error(`❌ Download failed for ${imageUrl}: ${err.message}`);
  }
}

async function scrapeComingSoon() {
  try {
    console.log(`🌐 Fetching: ${url}`);
    const { data: html } = await axios.get(url);
    console.log(`📄 Page downloaded, length=${html.length} chars`);

    const $ = cheerio.load(html);

    const movies = [];

    // Ensure images folder exists
    const imgDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir);
      console.log(`📂 Created images folder at: ${imgDir}`);
    }

    $('div.showtimes-description').slice(0, 6).each((i, el) => {
      const title = $(el).find('h2.show-title a.title').text().trim();
      console.log(`🎬 Movie found: "${title}"`);

      // --- Dates + times ---
      const dateTimePairs = [];
      $(el).find('ul.datelist li.show-date').each((j, li) => {
        const dateTxt = $(li).find('span').text().trim();
        const dateAttr = $(li).attr('data-date');
        const times = [];
        $(el).find(`ol.showtimes.showtime-button-row li a.showtime[data-date='${dateAttr}']`).each((k, st) => {
          const t = $(st).text().trim();
          if (t) times.push(t);
        });
        if (dateTxt) {
          if (times.length > 0) {
            dateTimePairs.push(`${dateTxt} (${times.join(', ')})`);
          } else {
            dateTimePairs.push(dateTxt);
          }
        }
      });

      if (dateTimePairs.length === 0) {
        const dateTxt = $(el).find('div.selected-date.show-datelist.single-date span').text().trim();
        const times = [];
        $(el).find('ol.showtimes.showtime-button-row li a.showtime').each((j, st) => {
          const t = $(st).text().trim();
          if (t) times.push(t);
        });
        if (dateTxt) {
          if (times.length > 0) {
            dateTimePairs.push(`${dateTxt} (${times.join(', ')})`);
          } else {
            dateTimePairs.push(dateTxt);
          }
        }
      }

      // --- Description ---
      let description = $(el).find('div.show-content p').first().text().trim();
      description = truncateText(description, 180);

      // --- Poster (use first <img> in block) ---
      let posterUrl = $(el).find('img').first().attr('src') || '';
      if (posterUrl.startsWith('//')) posterUrl = 'https:' + posterUrl;
      else if (posterUrl.startsWith('/')) posterUrl = BASE_URL + posterUrl;

      console.log(`🖼 Poster URL chosen for "${title}": ${posterUrl}`);

      const posterFile = path.join(imgDir, `vidiotsPoster${i + 1}.jpg`);

      if (title) {
        movies.push({
          title,
          schedule: dateTimePairs.join('; '),
          description,
          posterUrl,
          posterFile
        });
      }
    });

    // --- Download posters ---
    for (const m of movies) {
      if (m.posterUrl) {
        console.log(`⬇️ Queueing download for "${m.title}" -> ${m.posterUrl}`);
        await downloadImage(m.posterUrl, m.posterFile);
      } else {
        console.log(`⚠️ No poster URL for "${m.title}"`);
      }
    }

    // --- Build HTML ---
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Coming Soon — Vidiots</title>
<style>
  body { width: 800px; height: 480px; margin: 0; padding: 10px; background: #fff; color: #000; font-family: sans-serif; overflow: hidden; }
  h1 { text-align: center; font-size: 1.4em; margin: 0 0 8px; }
  .movie { display: flex; flex-direction: row; align-items: flex-start; margin-bottom: 8px; }
  .poster { flex: 0 0 100px; margin-right: 8px; }
  .poster img { width: 100px; height: 150px; object-fit: cover; border: 1px solid #aaa; filter: grayscale(100%); }
  .info { flex: 1; overflow: hidden; }
  .title { font-weight: bold; font-size: 1.05em; margin-bottom: 2px; }
  .schedule { font-style: italic; font-size: 0.9em; margin-bottom: 3px; }
  .description { font-size: 0.85em; line-height: 1.2em; }
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
        <div class="schedule">${m.schedule}</div>
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
