import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { url, width, height, fullPage } = req.query;

  if (!url) return res.status(400).json({ error: "URL is required" });

  // Create a safe filename for /tmp cache
  const safeFileName = encodeURIComponent(url);
  const filePath = path.join("/tmp", `${safeFileName}.png`);

  // Check if cached screenshot exists and is less than 24h old
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtimeMs;

    if (age < 24 * 60 * 60 * 1000) { // 24 hours
      const cached = fs.readFileSync(filePath);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("X-Cache", "HIT");
      return res.status(200).send(cached);
    }
  }

  // Otherwise, generate screenshot
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set viewport if width/height provided
    if (width && height) {
      await page.setViewport({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
      });
    }

    // Navigate with 5-second timeout
    await page.goto(url, { waitUntil: "networkidle0", timeout: 5000 });

    const screenshot = await page.screenshot({
      fullPage: fullPage === "true",
    });

    await browser.close();

    // Save screenshot to /tmp
    fs.writeFileSync(filePath, screenshot);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).send(screenshot);
  } catch (error) {
    await browser?.close();
    return res.status(500).json({ error: error.message });
  }
}
