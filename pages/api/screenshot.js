import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const { url, width, height, fullPage } = req.query;

  if (!url) return res.status(400).json({ error: "URL is required" });

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

    // Go to URL with 5-second timeout (5000 ms)
    await page.goto(url, { waitUntil: "networkidle0", timeout: 5000 });

    const screenshot = await page.screenshot({
      fullPage: fullPage === "true",
    });

    await browser.close();

    res.setHeader("Content-Type", "image/png");
    res.status(200).send(screenshot);
  } catch (error) {
    await browser?.close();
    res.status(500).json({ error: error.message });
  }
}
