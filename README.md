# FillCue

Offline-first fuel log. Point the phone at a pump receipt and the instrument cluster. Numbers are read **on the device**, reviewed, then stored in this browser. No account. No server. No photo upload.

**Current app is [GarageBook](https://github.com/wilsonsamiano/garagebook)** — multi-vehicle garage book with shop receipts, EV charging, VIN/EPA lookup, and a PWA.

**[Open GarageBook](https://wilsonsamiano.github.io/garagebook/)**

This repo is the original static FillCue PWA.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/wilsonsamiano)

MIT licensed. [Buy me a coffee](https://buymeacoffee.com/wilsonsamiano)

## What it does

- Camera / photo roll intake for **receipts** and **cluster** shots
- On-device OCR with [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0 / other OSS pieces)
- Parsers for Costco-style gas slips and Toyota multi-info displays (`Range`, `ODO`, `After Reset`, `Outside`)
- Confirm screen — OCR is a draft, you own the save
- Running gallons, spend, $/gal, MPG (needs two fill-ups with odometer), estimated range
- IndexedDB on the phone, JSON / CSV export
- Installable PWA (Add to Home Screen on iOS / Android)

## What it does not do

- It does not send pictures anywhere
- It does not invent MPG from one fill — first row is the baseline
- It will misread faded thermal paper and reflections on the cluster glass. That is why the review form exists

## Run it

No build step.

```bash
cd fillcue
python3 -m http.server 8765
```

Open `http://localhost:8765`. Modules and the service worker need `http://` or `https://`, not `file://`.

### iPhone

1. Serve it over HTTPS (GitHub Pages works) or use the same Wi-Fi `http://<your-laptop>:8765`
2. Safari → Share → **Add to Home Screen**
3. First launch: let it load Tesseract (a few MB)
4. After that, airplane mode still reads photos and saves fills

Camera capture uses the phone file picker (`capture="environment"`). iOS will ask for Photos access.

## Offline model

| Piece | Where it lives |
| --- | --- |
| App shell | Service worker cache |
| Fill log + settings | IndexedDB (`fillcue`) |
| OCR engine + `eng` traineddata | Cached from jsDelivr on first use |
| Photos | Never stored as blobs (previews are session-only). Raw OCR text can be kept with the fill |

First visit needs a network. After the engine is cached, recognition works offline.

To vendor Tesseract instead of the CDN, drop `tesseract.min.js` + worker/wasm/traineddata into `vendor/` and point `js/ocr.js` at those paths.

## Project layout

```
fillcue/
  index.html
  manifest.json
  sw.js
  LICENSE                 MIT
  css/app.css
  js/app.js               UI
  js/db.js                IndexedDB
  js/ocr.js               Tesseract wrapper + preprocess
  js/parse.js             Receipt + cluster parsers
  js/stats.js             MPG / range / CSV
  icons/
```

## How a good capture works

1. Fill to the first click-off
2. Photo of the receipt **while it is still dark and flat**
3. Photo of the cluster that shows **ODO + Range** (info page, not the analog gauges)
4. Check gallons, $/gal, total, and odometer before Save
5. Next fill does the same — MPG is `this odo − last odo` ÷ gallons

Cluster DTE is the computer’s recent-driving guess. It is not tank MPG.

## Seed data

On first launch FillCue seeds the 20 Sep 2026 Costco #483 San Diego fill (14.418 gal @ $5.799, odo 112,464, cluster range 309 after a 4.2-mile hop to National City) so the dashboard is not empty. Delete that row if you want a blank book.

## Privacy

Everything stays in the origin’s storage. Clearing Safari data for the site wipes the log — export JSON first. There are no analytics, no fonts-from-Google, no phone-home.

## Support

FillCue is free and stays offline. If it saves you a spreadsheet evening:

**[Buy me a coffee](https://buymeacoffee.com/wilsonsamiano)** — https://buymeacoffee.com/wilsonsamiano

## License

[MIT](LICENSE) © 2026 Wilson Samiano. Tesseract.js is separately licensed; see that project.

## Contributing

PRs welcome for:

- Better receipt templates (Safeway, Murphy, military stations)
- Cluster layouts from other years / makes
- A vendored Tesseract path so the first run is also offline
- Tests around `js/parse.js`

Keep it static. No required bundler, no backend.
