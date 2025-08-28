import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // Join all parts of the catch-all route into a single URL
  let urlParts = req.query.url; // this is an array
  if (!urlParts || urlParts.length === 0) {
    return res.status(400).json({ error: "URL is required" });
  }

  let url = urlParts.join("/");

  // Add https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Optional: decode URL-encoded parts
  url = decodeURIComponent(url);

  // Cache setup
  const safeFileName = encodeURIComponent(url);
  const filePath = path.join("/tmp", `${safeFileName}.png`);

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtimeMs;

    if (age < 24 * 60 * 60 * 1000) {
      const cached = fs.readFileSync(filePath);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("X-Cache", "HIT");
      return res.status(200).send(cached);
    }
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    const viewportWidth = 1280;
    const viewportHeight = 720;

    await page.setViewport({ width: viewportWidth, height: viewportHeight });

    await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });

    const screenshot = await page.screenshot({ fullPage: true });

    await browser.close();

    fs.writeFileSync(filePath, screenshot);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).send(screenshot);
  } catch (error) {
    await browser?.close();
    return res.status(500).json({ error: error.message });
  }
}
