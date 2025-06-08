// routes/streamDownload.js
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

  console.log('Received /stream-download request:', { url, format_id });
  console.log('Spawning yt-dlp with args:', args);

  try {
    const ytdlp = spawn('yt-dlp', args);

    let sentHeaders = false;
    let filename = 'video';
    let extension = 'mp4';

    ytdlp.stderr.on('data', (data) => {
      const msg = data.toString();
      // Extract filename and extension from yt-dlp logs
      const match = msg.match(/Destination: (.+)\.(\w+)/);
      if (match) {
        filename = match[1].replace(/[^a-zA-Z0-9_-]/g, '_');
        extension = match[2];
        console.log(`Detected filename: ${filename}.${extension}`);
      }
      // Optional: log yt-dlp stderr for debugging
      // console.error('yt-dlp stderr:', msg);
    });

    ytdlp.stdout.once('data', () => {
      if (!sentHeaders) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        sentHeaders = true;
        console.log('Response headers sent for download');
      }
    });

    ytdlp.stdout.pipe(res);

    ytdlp.on('error', (err) => {
      console.error('yt-dlp process error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'yt-dlp execution failed' });
      }
    });

    ytdlp.on('close', (code) => {
      console.log(`yt-dlp exited with code ${code}`);
      if (code !== 0 && !res.headersSent) {
        console.log('yt-dlp failed, falling back to Puppeteer');
        fallbackWithPuppeteer(url, res);
      }
    });
  } catch (err) {
    console.error('yt-dlp crashed, fallback to Puppeteer', err);
    fallbackWithPuppeteer(url, res);
  }
});

async function fallbackWithPuppeteer(url, res) {
  let browser;
  try {
    console.log('Starting Puppeteer fallback for URL:', url);
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
      console.error('Video URL not found in Puppeteer fallback');
      if (!res.headersSent) {
        return res.status(404).json({ error: 'Video URL not found in fallback' });
      }
      return;
    }

    console.log('Video URL found by Puppeteer fallback:', videoSrc);

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
      console.log(`Fallback curl exited with code ${code}`);
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