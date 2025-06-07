const express = require('express');
const path = require('path');
const fs = require('fs');
const downloadImage = require('../services/imageDownload');

const router = express.Router();

router.post('/', async (req, res) => {
  const { url } = req.body;

  if (!url || !/\.(jpeg|jpg|png|gif|bmp|webp|svg)$/i.test(url)) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }

  const extension = url.split('.').pop().split('?')[0];
  const filename = `image_${Date.now()}.${extension}`;
  const outputPath = path.join(__dirname, '../downloads', filename);

  try {
    await downloadImage(url, outputPath);

    res.download(outputPath, filename, () => {
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    console.error('Image download failed:', err.message);
    res.status(500).json({ error: 'Image download failed' });
  }
});

module.exports = router;