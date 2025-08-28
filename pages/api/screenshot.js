import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  let { url, width, height, fullPage } = req.query;

  if (!url) return res.status(400).json({ error: "URL is required" });

  // Add https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Create a safe filename for /tmp cache
  const safeFileName = encodeURIComponent(url);
  const filePath = path.join("/tmp", `${safeFileName}.png`);

  // Check cache
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtimeMs;

    if (age < 24 * 60 * 60 * 1000) { // 24h
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

    const viewportWidth = width ? parseInt(width, 10) : 1280;
    const viewportHeight = height ? parseInt(height, 10) : 720;

    await page.setViewport({ width: viewportWidth, height: viewportHeight });

    // Navigate with 10s timeout
    await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });

    const screenshot = await page.screenshot({ fullPage: fullPage === "true" });

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
