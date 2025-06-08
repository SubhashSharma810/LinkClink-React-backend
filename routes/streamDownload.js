// routes/streamDownload.js

const express = require('express');
const { spawn } = require('child_process');

const router = express.Router();

router.post('/', (req, res) => {
  const { url, format_id } = req.body;

  if (!url || !format_id) {
    return res.status(400).json({ error: 'Missing URL or format_id' });
  }

  const finalFormat = format_id === 'fallback' ? 'best' : format_id;

  const args = ['-f', finalFormat, '--no-playlist', '-o', '-', url];

  const ytdlp = spawn('yt-dlp', args);

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

  ytdlp.on('error', (err) => {
    console.error('yt-dlp failed:', err);
    return res.status(500).json({ error: 'yt-dlp execution failed' });
  });

  ytdlp.stdout.on('error', (err) => {
    console.error('stdout error:', err);
    return res.status(500).json({ error: 'Download stream error' });
  });

  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  ytdlp.stdout.pipe(res);
});

module.exports = router;