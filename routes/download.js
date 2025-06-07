const WebSocket = require('ws');
const downloadVideo = require('../services/downloadVideo');

function downloadHandler() {
  const wss = new WebSocket.Server({ port: 5001 });

  console.log('WebSocket running at ws://localhost:5001');

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', async (message) => {
      try {
        const parsed = JSON.parse(message);

        if (parsed.type === 'download') {
          const { url, format_id } = parsed.data;

          if (!format_id || !url) {
            console.error('Missing format_id or url:', parsed.data);
            return ws.send(JSON.stringify({ type: 'error', error: 'Invalid format_id or URL' }));
          }

          console.log("Download request received for URL:", url, "Format:", format_id);

          // Use 'best' as fallback format if needed
          const finalFormat = format_id === 'fallback' ? 'best' : format_id;
          downloadVideo(url, finalFormat, ws);
        }

      } catch (err) {
        console.error("Error parsing message:", err);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });
  });
}

module.exports = downloadHandler;