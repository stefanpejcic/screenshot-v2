import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });
    const screenshot = await page.screenshot();

    await browser.close();

    res.setHeader("Content-Type", "image/png");
    res.status(200).send(screenshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
