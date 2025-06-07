// LinkClink Backend Server
import express, { json } from 'express';
import cors from 'cors';
import { Server } from 'ws';

// Import routes
import formatRoutes from './routes/formats';
import downloadHandler from './routes/download';
import imageRoute from './routes/image';
import { http } from 'get-uri/dist/http';
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(json());

// REST API routes
app.use('/formats', formatRoutes);

// Serve image files from the downloads directory
app.use('/image', imageRoute);

// create HTTP server and attach Express app
const server = http.createServer(app);

// create WebSocket server on the same HTTP server
const wss = new Server({ server });

// Start WebSocket + HTTP server
server.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
});

// Start WebSocket download server
downloadHandler(wss);