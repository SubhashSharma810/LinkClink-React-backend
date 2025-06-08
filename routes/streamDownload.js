const express = require('express');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const router = express.Router();

router.post('/', async (req, res) => {
  const { url, format_id } = req.body;

  console.log('Received /stream-download request:', req.body);

  if (!url || !format_id) {
    return res.status(400).json({ error: 'Missing URL or format_id' });
  }

  const finalFormat = format_id === 'fallback' ? 'best' : format_id;
  const args = [
    '-f', finalFormat,
    '--no-playlist',
    '--no-part',
    '--no-mtime',
    '--retries', '3',
    '--fragment-retries', '3',
    '-o', '-',
    url
  ];

  console.log('Spawning yt-dlp with args:', args);

  try {
    const ytdlp = spawn('yt-dlp', args);

    let filename = 'video';
    let extension = 'mp4';
    let sentHeaders = false;
    let validated = false;
    let buffer = [];

    ytdlp.stderr.on('data', (data) => {
      const msg = data.toString();
      const match = msg.match(/Destination: (.+)\.(\w+)/);
      if (match) {
        filename = match[1].replace(/[^a-zA-Z0-9_-]/g, '_');
        extension = match[2];
      }
    });

    ytdlp.stdout.on('data', (chunk) => {
      if (!validated) {
        const text = chunk.toString('utf8');
        if (text.includes('#EXTM3U')) {
          console.log('Detected HLS playlist — falling back to Puppeteer');
          ytdlp.kill();
          return fallbackWithPuppeteer(url, res);
        }

        validated = true;
        if (!sentHeaders) {
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          sentHeaders = true;
        }

        res.write(chunk);
      } else {
        res.write(chunk);
      }
    });

    ytdlp.stdout.on('end', () => {
      if (!res.writableEnded) res.end();
    });

    ytdlp.on('error', (err) => {
      console.error('yt-dlp error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'yt-dlp execution failed' });
      }
    });

    ytdlp.on('close', (code) => {
      if (code !== 0 && !res.headersSent) {
        console.log('yt-dlp exited with code', code, ', using Puppeteer fallback...');
        fallbackWithPuppeteer(url, res);
      }
    });

  } catch (err) {
    console.error('yt-dlp crashed, fallback to Puppeteer:', err);
    fallbackWithPuppeteer(url, res);
  }
});

async function fallbackWithPuppeteer(url, res) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await page.waitForSelector('video', { timeout: 10000 });

    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src || video?.querySelector('source')?.src;
    });

    await browser.close();

    if (!videoSrc) {
      console.log('Puppeteer: No video source found.');
      return res.status(404).json({ error: 'Video URL not found in fallback' });
    }

    console.log('Puppeteer found video src:', videoSrc);

    const fallbackStream = spawn('curl', ['-L', videoSrc]);

    let timeoutId = setTimeout(() => {
      console.error('Fallback curl timed out');
      fallbackStream.kill();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Fallback curl timed out' });
      }
    }, 20000);

    fallbackStream.stdout.once('data', () => {
      clearTimeout(timeoutId);
      if (!res.headersSent) {
        res.setHeader('Content-Disposition', `attachment; filename="fallback.mp4"`);
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    });

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