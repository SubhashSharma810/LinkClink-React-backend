const ytdlp = require('yt-dlp-exec');

const fetchFormats = async (url) => {
  const info = await ytdlp(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCallHome: true,
    preferFreeFormats: true,
  });

  const { title, thumbnail, formats } = info;

  if (!formats || formats.length === 0) {
    throw new Error('No formats returned by yt-dlp');
  }

  // Accept mp4/webm formats with a valid filesize
  const filteredFormats = formats.filter(
    (f) =>
      f.filesize &&
      ['mp4', 'webm'].includes(f.ext) &&
      f.vcodec !== 'none' // exclude audio-only here
  );

  if (!filteredFormats || filteredFormats.length === 0) {
    const err = new Error('No downloadable formats found');
    err.code = '404';
    throw err;
  }

  return {
    title,
    thumbnail,
    formats: filteredFormats.map((f) => ({
      format_id: f.format_id,
      resolution: f.resolution || `${f.width}x${f.height}`,
      filesize: f.filesize,
      with_audio: f.asr ? 'with_audio' : 'no_audio',
    })),
  };
};

module.exports = fetchFormats;