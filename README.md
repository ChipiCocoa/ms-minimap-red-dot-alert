# Minimap Red Dot Alert

Watches a game's minimap through browser screen sharing, counts the red dots (other players), and sends a desktop notification once the count reaches a threshold you set.

Live: <https://chipicocoa.github.io/ms-minimap-red-dot-alert/>

Detection runs entirely in the browser. There is no backend, and captured frames never leave your machine. The page loads Google Analytics to count visits; what it sends is an ordinary page-view event, never any frame content.

## Running

```bash
pnpm install
pnpm serve
```

Open <http://localhost:8080>. `getDisplayMedia` only works on a secure origin, and `localhost` counts as one, so the page cannot be opened from `file://`.

`pnpm serve` serves the source files directly with no bundling, so what you run during development is exactly what the tests run. To see the deployed form:

```bash
pnpm build      # writes dist/
pnpm preview    # serves dist/ with the same server
```

## Usage

1. Click **開始分享螢幕** (start sharing) and pick the game window. A window is steadier than the whole screen.
2. Drag on the preview to frame the minimap. The region is saved to `localStorage` and applied automatically next time.
3. Check that the detected dots are boxed in green and the count is right, then switch back to the game.
4. When the threshold is reached you get a desktop notification, a chime and a red flash on the page. Each channel can be switched off on its own.

The **背景取樣** (background samples) counter exists so you can confirm the detector is still working while the tab is hidden: play for a while, come back, and the number should have gone up.

## How a red dot is recognised

Other players on the minimap are drawn in a highly saturated pure red (around `#FF0000`). Torches and wooden scenery are orange-red (`#E27304`, `#D53E06` and the like), and your own marker is yellow (`#FFFF00`).

The test is in HSV: hue within ±12° of pure red, saturation ≥ 0.75, value ≥ 0.85. The value floor is the decisive one. The darkest pixel of a real dot still sits at 0.87, while red shading on scenery tops out at 0.8, so the threshold falls between them. Passing pixels are grouped with 8-connectivity, and an area floor of 12 pixels discards specks of map art: a player dot is roughly 5×5 at native scale and 10×10 when the capture is upscaled, so anything of a few pixels cannot be a player. The parameters were tuned against three real captures.

If display scaling or a filter throws the detection off, adjust it under **進階：紅點判定參數** (advanced: detection parameters). The green boxes on the preview reflect the result immediately.

## Why a hidden tab matters

While you play, this tab is always in the background, and browsers throttle a hidden tab's timers to once a minute and stop `requestAnimationFrame` outright.

Sampling therefore prefers `MediaStreamTrackProcessor`: frames are pushed by the capture pipeline, independent of whether the page is being painted. Browsers without it fall back to a `<video>` element and a timer; in that mode the page plays an inaudible tone to keep itself from being throttled, and the status bar shows **相容模式** (compatibility mode).

## Tests

```bash
pnpm test
```

Unit tests cover the pure logic: colour classification, blob counting, alert debouncing and cooldown, region geometry, and settings validation. The colour tests run against real minimap screenshots.

The browser-side pipeline check needs a real browser: run `pnpm serve` and open
<http://localhost:8080/test/browser/pipeline-check.html>. It drives the full pipeline from a canvas-generated stream, so no screen-share permission is needed. This page is not included in `dist/`.

## Deployment

A push to `main` runs `.github/workflows/deploy.yml`: install, test, build, publish to GitHub Pages. If the tests fail, nothing is published.

The bundle is produced by esbuild, the only dependency. Output filenames carry a content hash; `sw.js` keeps its plain name because the page registers it by path.

## Known limitations

- Requires Chrome or Edge. Firefox lacks `MediaStreamTrackProcessor` and falls back to compatibility mode, where the tab has to stay visible.
- With Windows Focus Assist / Do Not Disturb on, the operating system swallows desktop notifications.
- Minimising the game window makes Windows stop drawing it, and the capture receives nothing. The track stays `live` and `muted` stays `false`, so the only usable signal is how long it has been since the last frame: after four sample intervals (at least 3 seconds) a "detection stopped" notification is sent. Timers are throttled while the tab is in the background, so this can take up to a minute to fire.
- Standing on the map's spawn point puts your own yellow marker on top of the red dot of whoever just arrived, hiding it at exactly the moment that matters. Stand somewhere else.
- Two players on the same spot merge into one blob. **估算重疊紅點人數** (estimate merged dots) infers a count from the area; it is off by default.
- **Some maps draw the minimap as a miniature of the real scenery rather than a schematic**, and it can contain pure-red art identical to a player dot. One real case is a red mushroom cap: the same `#FF0000` / `#EE0000` / `#DD0000` pixels, area 80 against a dot's 84, fill ratio 0.59 against 0.62. Colour, area, fill and aspect all fail to separate them, and a static frame cannot. On such maps either raise the threshold or accept the fixed baseline.
- The default area floor of 12 assumes a native or upscaled capture. If the shared window is scaled below native resolution a dot can fall under 12 pixels and be discarded; lower the floor in the advanced panel.
