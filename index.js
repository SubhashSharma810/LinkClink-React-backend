const express = require('express');
const cors = require('cors');
const formatRoutes = require('./routes/formats');
const downloadHandler = require('./routes/download');
const imageRoute = require('./routes/image');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// REST API routes
app.use('/formats', formatRoutes);

// Serve image files from the downloads directory
app.use('/image', imageRoute);

// Start express server
app.listen(PORT, () => console.log(`HTTP server running on http://localhost:${PORT}`));



// Start WebSocket download server
downloadHandler();