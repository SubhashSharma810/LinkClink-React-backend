const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Ensure 'Downloads' directory exists
const downloadDir = path.join(os.homedir(), 'Downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

/**
 * Download video using yt-dlp
 * @param {string} url - The original video URL
 * @param {string} format_id - yt-dlp format ID (e.g. 'best', 'http-360p', 'audio')
 * @param {WebSocket} ws - WebSocket client
 */
function downloadVideo(url, format_id, ws) {
  const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');

  const impersonateSites = [
    'vimeo.com', 'facebook.com', 'tiktok.com',
    'instagram.com', 'pornhub.com', 'xvideos.com',
    'redtube.com', 'youjizz.com', 'xhamster.com'
  ];

  const args = [];

  if (format_id === 'audio') {
    args.push(
      '-x', '--audio-format', 'mp3',
      '--newline', '--retries', '3',
      '-o', outputTemplate,
      url
    );
  } else {
    args.push(
      '-f', format_id,
      '--no-playlist',
      '--newline', '--retries', '3',
      '-o', outputTemplate,
      url
    );
  }

  const proc = spawn('yt-dlp', args);

  proc.stdout.on('data', (data) => {
    const line = data.toString();
    const match = line.match(/(\d+\.\d+)%\s+of.*?at\s+([\d.]+[A-Z]?B\/s).*?ETA\s+([\d:]+)/);

    if (match) {
      const percent = parseFloat(match[1]);
      const speed = match[2];
      const timeLeft = match[3];

      ws.send(JSON.stringify({
        type: 'progress',
        data: { percent, speed, timeLeft }
      }));

      console.log('Progress:', percent, speed, timeLeft);
    } else {
      console.log('yt-dlp output:', line);
    }
  });

  proc.stderr.on('data', (data) => {
    const error = data.toString();
    console.error('yt-dlp error:', error);
    ws.send(JSON.stringify({ type: 'error', error }));
  });

  proc.on('close', (code) => {
    console.log(`yt-dlp exited with code ${code}`);
    if (code === 0) {
      ws.send(JSON.stringify({ type: 'done' }));
    } else {
      ws.send(JSON.stringify({ type: 'error', error: `yt-dlp exited with code ${code}` }));
    }
  });

  proc.on('error', (err) => {
    console.error('Failed to start yt-dlp:', err);
    ws.send(JSON.stringify({ type: 'error', error: err.message }));
  });
}

module.exports = downloadVideo;