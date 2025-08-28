import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export default async function handler(req, res) {
  const { url: urlSegments, width, height, fullPage } = req.query;

  if (!urlSegments || urlSegments.length === 0) {
    return res.status(400).json({ error: "URL path is required" });
  }

  // Reconstruct URL from path segments
  const url = decodeURIComponent(urlSegments.join("/"));

  // Create hashed filename for caching
  const hash = crypto.createHash("md5").update(url).digest("hex");
  const filePath = path.join("/tmp", `${hash}.png`);

  // Serve cached screenshot if exists and fresh
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

    // Set viewport if width/height provided
    const viewport = {};
    if (width && !isNaN(parseInt(width, 10))) viewport.width = parseInt(width, 10);
    if (height && !isNaN(parseInt(height, 10))) viewport.height = parseInt(height, 10);
    if (Object.keys(viewport).length) await page.setViewport(viewport);

    await page.goto(url, { waitUntil: "networkidle0", timeout: 5000 });

    const screenshot = await page.screenshot({
      fullPage: fullPage === "true" || fullPage === true,
    });

    await browser.close();

    fs.writeFileSync(filePath, screenshot);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).send(screenshot);
  } catch (error) {
    if (browser) await browser.close();
    return res.status(500).json({ error: error.message });
  }
}
