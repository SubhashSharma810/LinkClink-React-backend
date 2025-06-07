const puppeteer = require('puppeteer-core');

const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome';

async function puppeteerScraper(url) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

  const result = await page.evaluate(() => {
    const video = document.querySelector('video');
    const src = video?.src || video?.querySelector('source')?.src;
    const thumbnail = document.querySelector('meta[property="og:image"]')?.content;
    const title = document.querySelector('title')?.innerText || 'Unknown Title';

    return {
      mediaSrc: src || null,
      thumbnail,
      title,
    };
  });

  await browser.close();
  return result;
}

module.exports = puppeteerScraper;