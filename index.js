// LinkClink Backend Server
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

// Import routes
const formatRoutes = require('./routes/formats');
const downloadHandler = require('./routes/download');
const imageRoute = require('./routes/image');
const http = require('http'); // ✅ Node.js built-in module
require('dotenv').config();
const streamDownloadRoute = require('./routes/streamDownload');



const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// REST API routes
app.use('/formats', formatRoutes);

// Serve image files from the downloads directory
app.use('/image', imageRoute);

app.use('/stream-download', streamDownloadRoute);

// create HTTP server and attach Express app
const server = http.createServer(app);

// create WebSocket server on the same HTTP server
const wss = new WebSocket.Server({ server });

// Start WebSocket + HTTP server
server.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
});

// Start WebSocket download server
downloadHandler(wss);