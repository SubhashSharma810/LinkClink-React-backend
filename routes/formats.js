const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const puppeteerScraper = require('../services/puppeteerScraper');

router.post('/', async (req, res) => {
  const { url } = req.body;

  const cmd = `yt-dlp -J --no-playlist "${url}"`;

  exec(cmd, async (err, stdout, stderr) => {
    if (err || !stdout) {
      console.log("YT-DLP FAILED:", stderr || err.message);

      // Try Puppeteer fallback
      try {
        const scraped = await puppeteerScraper(url);
        if (!scraped || !scraped.mediaSrc) {
          console.log("Puppeteer Scraper failed:", scraped);
          return res.status(500).json({ error: "No downloadable video/audio URL found." });
        }

        return res.json({
          thumbnail: scraped.thumbnail,
          videoTitle: scraped.title,
          formats: [
            { format_id: "scraped", resolution: "unknown", mediaSrc: scraped.mediaSrc }
          ]
        });

      } catch (e) {
        console.log("Puppeteer scraping error:", e);
        return res.status(500).json({ error: "No downloadable video/audio URL found on this page." });
      }
    }

    // If yt-dlp worked, parse output
    try {
      const json = JSON.parse(stdout);
      const formats = json.formats.map(f => ({
        format_id: f.format_id,
        resolution: f.resolution || `${f.width}x${f.height}`,
        ext: f.ext,
        with_audio: !!f.acodec && f.acodec !== 'none',
        filesize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(1)}MB` : 'unknown',
      }));

      return res.json({
        thumbnail: json.thumbnail,
        videoTitle: json.title,
        formats
      });
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      return res.status(500).json({ error: "Failed to parse yt-dlp output." });
    }
  });
});

module.exports = router;