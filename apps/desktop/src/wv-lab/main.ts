import { app, BrowserWindow, WebContentsView } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SCREENSHOT_DIR = "/tmp/seans-browser-wv-lab";
const CHROME_HEIGHT = 112;

interface PageProbe {
  url: string;
  title: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  cardText: string | null;
  bodyBackground: string;
}

function htmlDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function chromeHtml(): string {
  return `
    <!doctype html>
    <html>
      <head>
        <style>
          :root {
            color-scheme: dark;
            font-family: Avenir Next, Segoe UI, sans-serif;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background: linear-gradient(135deg, #0f172a, #172554);
            color: #f8fafc;
          }
          .bar {
            display: grid;
            grid-template-columns: 68px 1fr auto;
            align-items: center;
            gap: 12px;
            height: 100%;
            padding: 14px 18px;
            border-bottom: 1px solid rgba(125, 211, 252, 0.3);
          }
          .lights {
            display: flex;
            gap: 8px;
          }
          .light {
            width: 12px;
            height: 12px;
            border-radius: 999px;
          }
          .red { background: #fb7185; }
          .yellow { background: #fbbf24; }
          .green { background: #34d399; }
          .address {
            height: 52px;
            display: flex;
            align-items: center;
            padding: 0 18px;
            border-radius: 18px;
            background: rgba(2, 6, 23, 0.72);
            border: 1px solid rgba(148, 163, 184, 0.24);
            color: #bfdbfe;
            letter-spacing: 0.02em;
          }
          .badge {
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(34, 211, 238, 0.16);
            color: #67e8f9;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="bar">
          <div class="lights">
            <span class="light red"></span>
            <span class="light yellow"></span>
            <span class="light green"></span>
          </div>
          <div class="address">wv-lab://local-content-view</div>
          <div class="badge">Chrome View</div>
        </div>
      </body>
    </html>
  `;
}

function contentHtml(): string {
  return `
    <!doctype html>
    <html>
      <head>
        <title>WebContentsView Lab Content</title>
        <style>
          :root {
            font-family: Avenir Next, Segoe UI, sans-serif;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            overflow: hidden;
            background:
              linear-gradient(90deg, rgba(2, 6, 23, 0.08) 1px, transparent 1px),
              linear-gradient(180deg, rgba(2, 6, 23, 0.08) 1px, transparent 1px),
              linear-gradient(135deg, #f8fafc, #dbeafe 45%, #fef3c7);
            background-size: 64px 64px, 64px 64px, 100% 100%;
            color: #0f172a;
          }
          .page {
            min-height: 100vh;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 28px;
            padding: 48px;
          }
          .card {
            align-self: center;
            max-width: 620px;
            padding: 36px;
            border-radius: 32px;
            background: white;
            border: 4px solid #0ea5e9;
            box-shadow: 0 30px 80px rgba(15, 23, 42, 0.24);
          }
          h1 {
            margin: 0;
            font-size: 56px;
            line-height: 0.95;
            letter-spacing: -0.06em;
          }
          p {
            margin: 20px 0 0;
            max-width: 52ch;
            color: #475569;
            font-size: 20px;
            line-height: 1.5;
          }
          .target {
            align-self: stretch;
            border-radius: 32px;
            display: grid;
            place-items: center;
            background:
              radial-gradient(circle at 30% 30%, #22d3ee, transparent 28%),
              radial-gradient(circle at 70% 65%, #f97316, transparent 34%),
              #0f172a;
            color: white;
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="card" id="probe-card">
            <h1>WebContentsView content is visible.</h1>
            <p>
              If this screenshot looks clean, the native content view can be used as the browser
              page surface. If it is black, torn, mirrored, clipped, or scrambled, the issue is
              native view composition rather than tab logic.
            </p>
          </section>
          <section class="target">Render Target</section>
        </main>
      </body>
    </html>
  `;
}

async function probeView(view: WebContentsView): Promise<PageProbe> {
  return view.webContents.executeJavaScript(
    `({
      url: location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      cardText: document.querySelector("#probe-card")?.textContent?.trim() ?? null,
      bodyBackground: getComputedStyle(document.body).background
    })`,
    true
  ) as Promise<PageProbe>;
}

async function captureLab(
  win: BrowserWindow,
  chromeView: WebContentsView,
  contentView: WebContentsView
): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const windowImage = await win.capturePage();
  const chromeImage = await chromeView.webContents.capturePage();
  const contentImage = await contentView.webContents.capturePage();
  const windowPath = join(SCREENSHOT_DIR, "window.png");
  const chromePath = join(SCREENSHOT_DIR, "chrome.png");
  const contentPath = join(SCREENSHOT_DIR, "content.png");

  await writeFile(windowPath, windowImage.toPNG());
  await writeFile(chromePath, chromeImage.toPNG());
  await writeFile(contentPath, contentImage.toPNG());

  const probe = await probeView(contentView);
  console.info(`[wv-lab] window screenshot: ${windowPath}`);
  console.info(`[wv-lab] chrome screenshot: ${chromePath}`);
  console.info(`[wv-lab] content screenshot: ${contentPath}`);
  console.info(`[wv-lab] probe: ${JSON.stringify(probe)}`);
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    show: false,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const chromeView = new WebContentsView();
  const contentView = new WebContentsView();

  win.contentView.addChildView(contentView);
  win.contentView.addChildView(chromeView);

  const setBounds = () => {
    const bounds = win.getContentBounds();
    chromeView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: CHROME_HEIGHT
    });
    contentView.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width: bounds.width,
      height: Math.max(bounds.height - CHROME_HEIGHT, 0)
    });
  };

  setBounds();
  win.on("resize", setBounds);

  const contentUrl = process.env.WV_LAB_URL || htmlDataUrl(contentHtml());

  await Promise.all([
    chromeView.webContents.loadURL(htmlDataUrl(chromeHtml())),
    contentView.webContents.loadURL(contentUrl)
  ]);

  win.show();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await captureLab(win, chromeView, contentView);

  if (process.env.WV_LAB_HOLD === "1") {
    console.info("[wv-lab] holding window open because WV_LAB_HOLD=1");
  } else {
    app.quit();
  }
}

app.whenReady().then(() => {
  void createWindow().catch((error) => {
    console.error("[wv-lab] failed", error);
    app.exit(1);
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
