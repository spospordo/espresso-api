const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cron = require('node-cron');
const { outputFiles, vidiots } = require('./config.cjs');

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

// Generate HTML content from movies data
function generateHTML(movies) {
  return `<!DOCTYPE html>
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
  .poster { flex: 0 0 50px; margin-right: 8px; }
  .poster img { height: 75px; object-fit: contain; border: 1px solid #aaa; filter: grayscale(100%); }
  .info { flex: 1; overflow: hidden; }
  .title { font-weight: bold; font-size: 1.05em; margin-bottom: 2px; }
  .minidetails {
    font-size: 0.8em;
    color: #555;
    font-weight: normal;
    margin-left: 0.5em;
    white-space: nowrap;
  }
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
        ${m.posterUrl ? `<img src="${vidiots.posterBaseUrl}${m.posterFile}" alt="${m.title} poster">` : ''}
      </div>
      <div class="info">
        <div class="title">${m.title}${m.minidetails || ''}</div>
        <div class="schedule">${m.schedule}</div>
        ${m.pills && m.pills.length > 0 ? `<div class="pills">${m.pills.join(', ')}</div>` : ''}
        <div class="description">${m.description}</div>
      </div>
    </div>`).join('')}
</body>
</html>`;
}

// Generate error HTML when scraping fails
function generateErrorHTML(errorMessage) {
  const timestamp = new Date().toISOString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Coming Soon — Vidiots (Error)</title>
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
  body { padding: 20px; box-sizing: border-box; text-align: center; }
  h1 { color: #d32f2f; font-size: 1.4em; margin: 0 0 20px; }
  .error-message { background: #ffebee; border: 1px solid #ffcdd2; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
  .timestamp { font-size: 0.9em; color: #666; }
</style>
</head>
<body>
  <h1>Coming Soon at Vidiots</h1>
  <div class="error-message">
    <p><strong>Unable to load movie listings</strong></p>
    <p>Error: ${errorMessage}</p>
  </div>
  <div class="timestamp">Last attempted: ${timestamp}</div>
</body>
</html>`;
}

// Check if file content should be updated (returns true if content is different)
async function shouldUpdateFile(filePath, newContent) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log('📄 No existing file found, will create new one');
      return true; // No existing file, so update
    }
    
    // Check if force update is enabled
    if (vidiots.forceUpdate) {
      console.log('📄 Force update enabled in configuration, updating file');
      return true;
    }
    
    // Check file age - force update if file is too old
    const stats = fs.statSync(filePath);
    const fileAgeHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
    const maxAgeHours = vidiots.maxAgeHours || 24;
    
    if (fileAgeHours > maxAgeHours) {
      console.log(`📄 File is ${fileAgeHours.toFixed(1)} hours old (max: ${maxAgeHours}), forcing update`);
      return true;
    }
    
    const existingContent = fs.readFileSync(filePath, 'utf8');
    
    // Basic content comparison logging
    console.log(`🔍 Comparing content: existing ${existingContent.length} chars vs new ${newContent.length} chars, age ${fileAgeHours.toFixed(1)}h`);
    
    // Normalize content for comparison - remove extra whitespace and normalize line endings
    const normalizeContent = (content) => {
      return content
        .trim()
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\s+/g, ' ')    // Normalize multiple spaces to single space
        .replace(/\s*\n\s*/g, '\n') // Clean up line breaks
    };
    
    const existingNormalized = normalizeContent(existingContent);
    const newNormalized = normalizeContent(newContent);
    
    // Try both strict comparison and normalized comparison
    const strictlyIdentical = existingContent.trim() === newContent.trim();
    const normalizedIdentical = existingNormalized === newNormalized;
    
    if (strictlyIdentical && normalizedIdentical) {
      console.log('📄 Content identical, no update needed');
      return false;
    }
    
    // If only normalized content is identical, we'll still consider it a change to be safe
    if (!strictlyIdentical && normalizedIdentical) {
      console.log('📄 Content differs only in whitespace, updating to preserve formatting');
      return true;
    }
    
    // For more sophisticated comparison, compare movie data
    // Extract movie titles from both versions to see if the content meaningfully changed
    const existingTitles = extractMovieTitles(existingContent);
    const newTitles = extractMovieTitles(newContent);
    
    const titlesChanged = JSON.stringify(existingTitles.sort()) !== JSON.stringify(newTitles.sort());
    
    if (titlesChanged) {
      console.log(`📄 Movie lineup changed: ${existingTitles.length} -> ${newTitles.length} movies`);
      return true;
    }
    
    // Extract additional content for comparison - schedules and descriptions
    const extractMovieData = (htmlContent) => {
      const movies = [];
      try {
        // Extract schedule information
        const scheduleMatches = htmlContent.match(/<div class="schedule">([^<]*)<\/div>/g);
        if (scheduleMatches) {
          scheduleMatches.forEach(match => {
            const scheduleMatch = match.match(/<div class="schedule">([^<]*)<\/div>/);
            if (scheduleMatch) movies.push({ schedule: scheduleMatch[1].trim() });
          });
        }
        
        // Extract description information  
        const descriptionMatches = htmlContent.match(/<div class="description">([^<]*)<\/div>/g);
        if (descriptionMatches) {
          descriptionMatches.forEach((match, index) => {
            const descriptionMatch = match.match(/<div class="description">([^<]*)<\/div>/);
            if (descriptionMatch && movies[index]) {
              movies[index].description = descriptionMatch[1].trim();
            }
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error extracting movie data: ${error.message}`);
      }
      return movies;
    };
    
    const existingMovieData = extractMovieData(existingContent);
    const newMovieData = extractMovieData(newContent);
    
    const movieDataChanged = JSON.stringify(existingMovieData) !== JSON.stringify(newMovieData);
    
    if (movieDataChanged) {
      console.log('📄 Movie schedules or descriptions updated');
      return true;
    }
    
    // If titles are the same but content differs, it might be other updates
    console.log('📄 Content differs, updating file');
    return true;
    
  } catch (error) {
    console.warn(`⚠️ Error comparing file content: ${error.message}, proceeding with update`);
    return true; // If we can't compare, err on the side of updating
  }
}

// Extract movie titles from HTML content for comparison
function extractMovieTitles(htmlContent) {
  try {
    // Look for the title div pattern used in our generated HTML
    const titleMatches = htmlContent.match(/<div class="title">([^<]+?)(?:<span|<\/div>)/g);
    if (!titleMatches) return [];
    
    return titleMatches.map(match => {
      const titleMatch = match.match(/<div class="title">([^<]+?)(?:<span|<\/div>)/);
      return titleMatch ? titleMatch[1].trim() : '';
    }).filter(title => title.length > 0);
  } catch (error) {
    console.warn(`⚠️ Error extracting titles: ${error.message}`);
    return [];
  }
}

function cleanupOldPosterImages() {
  try {
    const posterDir = vidiots.posterDirectory || process.cwd();
    const files = fs.readdirSync(posterDir);
    
    // Find and remove old poster images (vidiotsPoster*.jpg)
    const posterFiles = files.filter(file => 
      file.match(/^vidiotsPoster\d+\.jpg$/)
    );
    
    if (posterFiles.length > 0) {
      console.log(`🧹 Cleaning up ${posterFiles.length} old poster image(s) from ${posterDir}...`);
      posterFiles.forEach(file => {
        const filePath = path.join(posterDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️ Removed: ${file}`);
      });
    } else {
      console.log(`🧹 No old poster images to clean up in ${posterDir}`);
    }
  } catch (err) {
    console.error(`❌ Error during cleanup: ${err.message}`);
    // Don't fail the entire process if cleanup fails
  }
}

async function downloadAndResizeImage(imageUrl, localFile) {
  try {
    console.log(`⬇️ Downloading: ${imageUrl}`);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', headers: HEADERS });
    if (!response.headers['content-type'] || !response.headers['content-type'].startsWith('image')) {
      throw new Error('Not an image content-type: ' + response.headers['content-type']);
    }
    await sharp(response.data)
      .resize(100, 150, { fit: 'inside', withoutEnlargement: true })
      .toFile(localFile);
    console.log(`✅ Image saved and resized: ${localFile}`);
    return true;
  } catch (err) {
    console.error(`❌ Download/resize failed for ${imageUrl}: ${err.message}`);
    return false;
  }
}

async function scrapeComingSoon() {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      // Clean up old poster images before downloading new ones (only on first attempt)
      if (retryCount === 0) {
        cleanupOldPosterImages();
      }
      
      console.log(`🌐 Fetching: ${url} (attempt ${retryCount + 1}/${maxRetries})`);
      const { data: html } = await axios.get(url, { 
        headers: HEADERS,
        timeout: 30000 // 30 second timeout
      });
      
      if (!html || html.trim().length === 0) {
        throw new Error('Received empty HTML response');
      }
      
      const $ = cheerio.load(html);
      const movies = [];
      
      console.log(`📊 Parsing HTML content (${html.length} characters)`);
      
      // Check if we can find the expected container elements
      const showElements = $('div.showtimes-description');
      console.log(`🎬 Found ${showElements.length} show elements on page`);
      
      if (showElements.length === 0) {
        throw new Error('No movie show elements found - website structure may have changed');
      }

      $('div.showtimes-description').slice(0, 6).each((i, el) => {
        const title = $(el).find('h2.show-title a.title').text().trim();
        
        if (!title) {
          console.log(`⚠️ Skipping element ${i + 1}: no title found`);
          return; // Skip this element if no title
        }
        
        console.log(`🎭 Processing movie ${i + 1}: "${title}"`);

        // Find poster image: previous .show-details > .show-poster > .show-poster-inner > img
        let posterUrl = '';
        let parentShowDetails = $(el).closest('.show-details');
        if (parentShowDetails.length) {
          const img = parentShowDetails.find('.show-poster-inner img').attr('src');
          if (img) posterUrl = img;
        }
        if (posterUrl) {
          console.log(`🖼 Poster URL for "${title}": ${posterUrl}`);
        } else {
          console.log(`⚠️ No poster found for "${title}"`);
        }
        const posterFile = `vidiotsPoster${i + 1}.jpg`;
        const posterFilePath = path.join(vidiots.posterDirectory || process.cwd(), posterFile);

      // --- Robust Dates and Times Extraction (no pairing logic) ---
      const uniqueDates = new Set();
      parentShowDetails.find('ul.datelist li.show-date span').each((j, span) => {
        const dateTxt = $(span).text().replace(/\s+/g, ' ').replace(' ,', ',').trim();
        if (dateTxt) uniqueDates.add(dateTxt);
      });
      parentShowDetails.find('.selected-date.show-datelist.single-date span').each((j, span) => {
        const dateTxt = $(span).text().replace(/\s+/g, ' ').replace(' ,', ',').trim();
        if (dateTxt) uniqueDates.add(dateTxt);
      });

      const uniqueTimes = new Set();
      parentShowDetails.find('a.showtime').each((j, a) => {
        const timeTxt = $(a).text().trim();
        if (timeTxt) uniqueTimes.add(timeTxt);
      });

      let schedule = '';
      if (uniqueDates.size && uniqueTimes.size) {
        schedule = Array.from(uniqueDates).join(', ') + ' — ' + Array.from(uniqueTimes).join(', ');
      } else if (uniqueDates.size) {
        schedule = Array.from(uniqueDates).join(', ');
      } else if (uniqueTimes.size) {
        schedule = Array.from(uniqueTimes).join(', ');
      }

      // --- Extract director, format, runtime, release year (no labels) ---
      let director = '', format = '', runtime = '', year = '';
      // Find the .show-specs inside the nearest .show-details
      let showSpecs = parentShowDetails.find('.show-description .show-specs');
      if (!showSpecs.length) {
        showSpecs = $(el).find('.show-specs');
      }
      showSpecs.find('span').each((_, span) => {
        const labelSpan = $(span).find('.show-spec-label');
        if (labelSpan.length) {
          const label = labelSpan.text().trim().replace(':', '').toLowerCase();
          // Value: text after the labelSpan
          let value = '';
          // Remove the labelSpan from the span, get the remaining text
          const cloned = $(span).clone();
          cloned.find('.show-spec-label').remove();
          value = cloned.text().replace(/^[\s:]+/, '').trim();
          if (/director/.test(label)) director = value;
          if (/format/.test(label)) format = value;
          if (/run\s*time/.test(label)) runtime = value;
          if (/release\s*year/.test(label)) year = value;
        }
      });
      const detailsArr = [director, format, runtime, year].filter(Boolean);
      let minidetails = '';
      if (detailsArr.length) minidetails = `<span class="minidetails">${detailsArr.join(' &middot; ')}</span>`;

        // Description
        let description = $(el).find('div.show-content p').first().text().trim();
        description = truncateText(description, 180);
        
        if (!description) {
          console.log(`⚠️ No description found for "${title}"`);
        }

        // Unique pills
        const pillsSet = new Set();
        $(el).find('.pill-container .pill').each((_, pill) => {
          const pillText = $(pill).text().trim();
          if (pillText) pillsSet.add(pillText);
        });
        const pills = Array.from(pillsSet);
        
        console.log(`📄 Movie details - Schedule: "${schedule}", Description: ${description.length} chars, Pills: ${pills.length}`);

        if (title) {
          movies.push({
            title,
            minidetails,
            schedule,
            description,
            posterUrl,
            posterFile,
            posterFilePath,
            pills
          });
        }
      });
      
      console.log(`🎬 Successfully parsed ${movies.length} movies`);
      
      // Validate that we have meaningful content
      if (movies.length === 0) {
        throw new Error('No movies were successfully parsed from the page');
      }
      
      // Check if at least some movies have descriptions
      const moviesWithDescriptions = movies.filter(m => m.description && m.description.trim().length > 0);
      if (moviesWithDescriptions.length === 0) {
        console.warn('⚠️ Warning: No movies have descriptions - this might indicate a scraping issue');
      }

      // Download and resize posters
      let successCount = 0;
      let failureCount = 0;
      
      for (const m of movies) {
        if (m.posterUrl) {
          console.log(`⬇️ Downloading poster for "${m.title}" -> ${m.posterUrl}`);
          const success = await downloadAndResizeImage(m.posterUrl, m.posterFilePath);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          console.log(`⚠️ No poster URL for "${m.title}"`);
          failureCount++;
        }
      }
      
      console.log(`📊 Download summary: ${successCount} successful, ${failureCount} failed`);
      
      if (movies.length > 0 && successCount === 0) {
        console.warn('⚠️ Warning: No poster images were successfully downloaded!');
      }

      // Build HTML content
      const htmlContent = generateHTML(movies);
      
      // Check if we should update the file (compare with existing content)
      const shouldUpdate = await shouldUpdateFile(outputFiles.vidiots, htmlContent);
      
      if (shouldUpdate) {
        // Write the new content
        fs.writeFileSync(outputFiles.vidiots, htmlContent.trim());
        console.log(`📝 HTML updated: ${outputFiles.vidiots} (${movies.length} movies, ${htmlContent.length} characters)`);
        
        // Log a summary of what was updated
        console.log('🎬 Updated movies:');
        movies.forEach((movie, index) => {
          console.log(`   ${index + 1}. ${movie.title} - ${movie.schedule || 'No schedule'}`);
        });
        
        return true; // Indicate successful update
      } else {
        console.log(`📝 No changes detected, keeping existing file: ${outputFiles.vidiots}`);
        return false; // Indicate no update needed
      }
      
    } catch (err) {
      console.error(`❌ Scraping attempt ${retryCount + 1} failed:`, err.message);
      
      if (retryCount < maxRetries - 1) {
        const delayMs = (retryCount + 1) * 5000; // Exponential backoff: 5s, 10s, 15s
        console.log(`⏳ Retrying in ${delayMs/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        retryCount++;
        continue; // Try again
      } else {
        // All retries exhausted
        console.error('❌ All retry attempts exhausted. Preserving existing content if available.');
        
        // Check if we have an existing file to preserve
        if (fs.existsSync(outputFiles.vidiots)) {
          console.log(`📂 Existing file preserved: ${outputFiles.vidiots}`);
          return false; // Indicate no update, but file preserved
        } else {
          // No existing file, create a minimal error file
          const errorHTML = generateErrorHTML(err.message);
          fs.writeFileSync(outputFiles.vidiots, errorHTML);
          console.log(`📝 Error file created: ${outputFiles.vidiots}`);
          return false;
        }
      }
    }
  }
}

// call git upload only if content was actually updated
async function runScrapeAndUpload() {
  try {
    const wasUpdated = await scrapeComingSoon();
    
    if (wasUpdated) {
      console.log('📤 Content was updated, triggering git upload...');
      import('./uploadToGitHub.mjs').then(({ schedulePush }) => {
        schedulePush("Automated Commit and push from scrapeVidiots.cjs - content updated");
      }).catch(err => {
        console.error('❌ Error scheduling git upload:', err.message);
      });
    } else {
      console.log('📤 No content changes, skipping git upload');
    }
  } catch (error) {
    console.error('❌ Error in runScrapeAndUpload:', error.message);
  }
}

// Schedule scraping
cron.schedule('0 6,12 * * *', () => {
  console.log('⏰ Running scheduled scrape...');
  runScrapeAndUpload();
});

// Run immediately but don't block the module loading
setImmediate(() => {
  console.log('🚀 Running initial scrape...');
  runScrapeAndUpload();
});

