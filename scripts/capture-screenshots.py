"""Captures docs/editor-web.jpg and docs/editor-mobile.jpg from the built web app.

    npm run build:web && python3 scripts/capture-screenshots.py
"""
import asyncio
import http.server
import os
import pathlib
import shutil
import threading
from functools import partial

from PIL import Image
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "docs" / "sample-service-agreement.pdf"
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")


async def capture(browser, url, viewport, scale, out, width):
    context = await browser.new_context(
        viewport=viewport, device_scale_factor=scale, has_touch=viewport["width"] < 500
    )
    page = await context.new_page()
    await page.goto(url)
    async with page.expect_file_chooser() as chooser:
        await page.get_by_text("Open PDF").click()
    await (await chooser.value).set_files(str(SAMPLE))
    line = page.get_by_text("Delivery is planned within six weeks of the signed agreement.", exact=True)
    await line.wait_for()
    await page.wait_for_timeout(2500)
    await line.click()
    await line.click()
    field = page.get_by_label("Edit text")
    await field.press("Home")
    for _ in range(len("Delivery is planned within ")):
        await field.press("ArrowRight")
    for _ in range(3):
        await field.press("Shift+ArrowRight")
    await page.wait_for_timeout(300)
    await page.screenshot(path="/tmp/pdf-shot.png")
    image = Image.open("/tmp/pdf-shot.png").convert("RGB")
    image = image.resize((width, int(image.height * width / image.width)), Image.LANCZOS)
    image.save(out, quality=85)
    await context.close()


async def main():
    site = ROOT / ".demo-site"
    shutil.rmtree(site, ignore_errors=True)
    site.mkdir()
    (site / "pdf-editor").symlink_to(ROOT / "dist")
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(site))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/pdf-editor/"
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
            await capture(browser, url, {"width": 1100, "height": 860}, 1, ROOT / "docs" / "editor-web.jpg", 900)
            await capture(browser, url, {"width": 390, "height": 844}, 2, ROOT / "docs" / "editor-mobile.jpg", 390)
            await browser.close()
    finally:
        server.shutdown()
        shutil.rmtree(site, ignore_errors=True)


asyncio.run(main())
