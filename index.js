// LinkClink Backend Server

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

// Import routes
const formatRoutes = require('./routes/formats');
const downloadHandler = require('./routes/download');
const imageRoute = require('./routes/image');
const { router: streamDownloadRoute } = require('./routes/streamDownload'); // ✅ Fix here

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// REST API routes
app.use('/formats', formatRoutes);
app.use('/image', imageRoute);
app.use('/stream-download', streamDownloadRoute); // ✅ Proper mount

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Create WebSocket server on the same HTTP server
const wss = new WebSocket.Server({ server });

// Start HTTP + WebSocket server
server.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
});

// Start WebSocket-based download handling
downloadHandler(wss);