"""Records docs/editor-demo.gif: editing the text of a real PDF in the web app.

    npm run build:web && python3 scripts/record-demo.py

Needs Python Playwright, Pillow and a local Chrome (CHROME_PATH).
"""
import asyncio
import http.server
import os
import pathlib
import threading
from functools import partial

from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "docs" / "sample-service-agreement.pdf"
OUT = ROOT / "docs" / "editor-demo.gif"
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")
VIEW = {"width": 1100, "height": 980}
WIDTH = 760
FONT_PATHS = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def serve():
    site = ROOT / ".demo-site"
    if site.exists():
        import shutil

        shutil.rmtree(site)
    site.mkdir()
    (site / "pdf-editor").symlink_to(ROOT / "dist")
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(site))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, site


class Recorder:
    def __init__(self, page, clip):
        self.page = page
        self.clip = clip
        self.frames = []
        self.caption = ""
        self.font = next(
            (ImageFont.truetype(p, 22) for p in FONT_PATHS if os.path.exists(p)),
            ImageFont.load_default(),
        )

    async def shot(self, hold=110):
        path = "/tmp/pdf-demo-frame.png"
        await self.page.screenshot(path=path, clip=self.clip)
        image = Image.open(path).convert("RGB")
        image = image.resize((WIDTH, int(image.height * WIDTH / image.width)), Image.LANCZOS)
        canvas = Image.new("RGB", (image.width, image.height + 46), "#0E1116")
        canvas.paste(image, (0, 0))
        draw = ImageDraw.Draw(canvas)
        draw.text((16, image.height + 11), self.caption, fill="#C9A227", font=self.font)
        self.frames.append((canvas, hold))

    async def pause(self, ms, step=500):
        for _ in range(max(1, ms // step)):
            await self.shot(step)

    async def type(self, locator, text, every=2):
        for index, char in enumerate(text):
            await locator.press_sequentially(char)
            if index % every == every - 1:
                await self.shot(90)
        await self.shot(400)

    def save(self):
        images = [frame for frame, _ in self.frames]
        # Each frame gets its own palette, so colours that only show up
        # mid-way (the blue text selection) are kept exactly.
        quantized = [
            im.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            for im in images
        ]
        quantized[0].save(
            OUT,
            save_all=True,
            append_images=quantized[1:],
            duration=[hold for _, hold in self.frames],
            loop=0,
            optimize=True,
        )


async def edit(rec, text):
    line = rec.page.get_by_text(text, exact=True)
    await line.click()
    await rec.shot(500)
    await line.click()
    field = rec.page.get_by_label("Edit text")
    await field.wait_for()
    await field.evaluate(
        "el => new Promise(done => { const check = () => el.selectionStart === 0 && el.selectionEnd === el.value.length ? done() : requestAnimationFrame(check); check(); })"
    )
    await rec.shot(800)
    return field


async def main():
    server, site = serve()
    url = f"http://127.0.0.1:{server.server_address[1]}/pdf-editor/"
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
            page = await (await browser.new_context(viewport=VIEW, device_scale_factor=2)).new_page()
            await page.goto(url)
            async with page.expect_file_chooser() as chooser:
                await page.get_by_text("Open PDF").click()
            await (await chooser.value).set_files(str(SAMPLE))
            await page.get_by_text("Client: Contoso Bakery Ltd.", exact=True).wait_for()
            await page.wait_for_timeout(2500)
            # The page sheet: the largest white element on screen. Frame its
            # upper part (heading to totals) so the text reads at GIF size.
            box = await page.evaluate(
                """() => {
                  let best = null;
                  for (const el of document.querySelectorAll('div')) {
                    const r = el.getBoundingClientRect();
                    const bg = getComputedStyle(el).backgroundColor;
                    if (bg === 'rgb(246, 241, 231)' && (!best || r.width * r.height > best.width * best.height)) {
                      best = { x: r.x, y: r.y, width: r.width, height: r.height };
                    }
                  }
                  return best;
                }"""
            )
            clip = {
                "x": box["x"] + box["width"] * 0.06,
                "y": box["y"] + box["height"] * 0.05,
                "width": box["width"] * 0.88,
                "height": box["height"] * 0.42,
            }
            rec = Recorder(page, clip)

            rec.caption = "A real PDF (printed from Chrome) — every line is editable text"
            await rec.pause(2000)

            rec.caption = "Click a line, click again: it opens selected — type to overwrite"
            field = await edit(rec, "Client: Contoso Bakery Ltd.")
            await rec.type(field, "Client: Gilău Pastry House SRL")
            await field.press("Enter")
            await page.wait_for_timeout(1200)
            await rec.pause(1200)

            rec.caption = "Select one word, like in a document, and replace it"
            sentence = "Delivery is planned within six weeks of the signed agreement."
            field = await edit(rec, sentence)
            await field.press("Home")
            for _ in range(len("Delivery is planned within ")):
                await field.press("ArrowRight")
            await rec.shot(400)
            for _ in range(3):
                await field.press("Shift+ArrowRight")
                await rec.shot(250)
            await rec.shot(500)
            await rec.type(field, "four", every=1)
            await field.press("Enter")
            await page.wait_for_timeout(1200)
            await rec.pause(1200)

            rec.caption = "Fix a price: put the caret at the end, delete, retype"
            field = await edit(rec, "2,400 EUR")
            await field.press("End")
            await rec.shot(300)
            for _ in range(len("2,400 EUR")):
                await field.press("Backspace")
                await rec.shot(70)
            await rec.type(field, "2,000 EUR", every=1)
            await field.press("Enter")
            await page.wait_for_timeout(1000)

            field = await edit(rec, "Total: 4,240 EUR")
            await field.press("End")
            for _ in range(len("4,240 EUR")):
                await field.press("Backspace")
            await rec.type(field, "3,840 EUR", every=1)
            await field.press("Enter")
            await page.wait_for_timeout(1200)

            rec.caption = "Saved back into the PDF itself — Save as PDF, Word, HTML, CSV"
            await rec.pause(2500)
            await browser.close()
            rec.save()
    finally:
        server.shutdown()
        import shutil

        shutil.rmtree(site, ignore_errors=True)
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(rec.frames)} frames)")


asyncio.run(main())
