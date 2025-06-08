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

  try {
    const ytdlp = spawn('yt-dlp', args);

    let sentHeaders = false;
    let filename = 'video';
    let extension = 'mp4';

    ytdlp.stderr.on('data', (data) => {
      const msg = data.toString();
      const match = msg.match(/Destination: (.+)\.(\w+)/);
      if (match) {
        filename = match[1].replace(/[^a-zA-Z0-9_-]/g, '_');
        extension = match[2];
      }
    });

    ytdlp.stdout.once('data', () => {
      if (!sentHeaders) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        sentHeaders = true;
      }
    });

    ytdlp.stdout.pipe(res);

    ytdlp.on('error', (err) => {
      console.error('yt-dlp failed:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'yt-dlp execution failed' });
      }
    });

    ytdlp.on('close', (code) => {
      if (code !== 0 && !res.headersSent) {
        fallbackWithPuppeteer(url, res);
      }
    });
  } catch (err) {
    console.error('yt-dlp crashed, fallback to Puppeteer');
    fallbackWithPuppeteer(url, res);
  }
});

async function fallbackWithPuppeteer(url, res) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Navigate with timeout 15 sec
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait max 10 sec for video tag
    await page.waitForSelector('video', { timeout: 10000 });

    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src || (video?.querySelector('source')?.src);
    });

    await browser.close();

    if (!videoSrc) {
      if (!res.headersSent) {
        return res.status(404).json({ error: 'Video URL not found in fallback' });
      } else {
        return;
      }
    }

    const fallbackStream = spawn('curl', ['-L', videoSrc]);

    let timeoutId = setTimeout(() => {
      console.error('Fallback curl timed out');
      fallbackStream.kill();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Fallback curl timed out' });
      }
    }, 20000); // 20 seconds timeout

    fallbackStream.stdout.once('data', () => {
      clearTimeout(timeoutId);
    });

    if (!res.headersSent) {
      res.setHeader('Content-Disposition', `attachment; filename="fallback.mp4"`);
      res.setHeader('Content-Type', 'application/octet-stream');
    }

    fallbackStream.stdout.pipe(res);

    fallbackStream.on('error', (err) => {
      console.error('Fallback curl failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Fallback download failed' });
      }
    });

    fallbackStream.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ error: `Fallback curl exited with code ${code}` });
      }
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error('Puppeteer fallback failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Puppeteer fallback failed' });
    }
  }
}

module.exports = router;