const fs = require('fs');
const axios = require('axios');

const downloadImage = async (url, outputPath) => {
  const response = await axios({
    url,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

module.exports = downloadImage;