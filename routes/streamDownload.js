const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

router.post('/', async (req, res) => {
  const { url, format_id } = req.body;

  if (!url || !format_id) {
    return res.status(400).json({ error: 'Missing URL or format_id' });
  }

  const finalFormat = format_id === 'fallback' ? 'best' : format_id;
  const args = ['-f', finalFormat, '--no-playlist', '-o', '-', url];

  const ytdlp = spawn('yt-dlp', args);

  let usedFallback = false;
  let filename = 'video';
  let extension = 'mp4';

  let ytdlpFailed = false;

  ytdlp.stderr.on('data', (data) => {
    const msg = data.toString();
    console.error('yt-dlp:', msg);

    // Watch for yt-dlp errors
    if (msg.includes('HTTP Error') || msg.includes('403') || msg.includes('404')) {
      ytdlpFailed = true;
      ytdlp.kill();
    }

    // Optional: Extract file name if available
    const match = msg.match(/Destination: (.+)\.(\w+)/);
    if (match) {
      filename = match[1].replace(/[^a-zA-Z0-9_-]/g, '_');
      extension = match[2];
    }
  });

  ytdlp.stdout.pipe(res);

  ytdlp.on('close', async (code) => {
    if (ytdlpFailed || code !== 0) {
      usedFallback = true;

      console.log('Falling back to Puppeteer for:', url);

      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Replace with custom logic per site
        const videoSrc = await page.evaluate(() => {
          const video = document.querySelector('video');
          return video ? video.src : null;
        });

        await browser.close();

        if (!videoSrc) {
          return res.status(500).json({ error: 'Could not extract video URL' });
        }

        console.log('Direct video URL from Puppeteer:', videoSrc);

        // Stream the video directly
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        const fallbackStream = spawn('curl', ['-L', videoSrc]);
        fallbackStream.stdout.pipe(res);
        fallbackStream.stderr.on('data', (d) => console.error('curl stderr:', d.toString()));
        fallbackStream.on('error', (err) => {
          console.error('Fallback download failed:', err);
          res.status(500).json({ error: 'Failed to fetch video using Puppeteer' });
        });

      } catch (err) {
        console.error('Puppeteer fallback failed:', err);
        return res.status(500).json({ error: 'Puppeteer fallback failed' });
      }
    }
  });
});

module.exports = router;