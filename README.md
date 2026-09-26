# SplitImage Engine

[Online website](https://splitimage.io/) · [MIT license](LICENSE)

A UI-free JavaScript library for splitting images in the browser. It provides grid and crop geometry, Canvas rendering, cover padding, seam detection and ZIP export, with no runtime dependencies.

This is the MIT-licensed image processing library used by SplitImage.io. The website's interface, marketing copy, preview artwork, brand assets and server code are **not** included or licensed by this repository. This library does not reproduce the complete website.

## Scope

- Equal grids, custom split boundaries and partial-image crops.
- Consistently sized 3:4 grid tiles and 4:5 carousel slides.
- Top/bottom or side padding using a solid color, blurred source pixels or a background image.
- Pixel-based seam detection for stitched images; this is a heuristic, not an AI model.
- PNG, JPEG and WebP output, numbered tiles, and uncompressed ZIP archives.
- No components, styles, application state, download buttons or analytics.

## Online tools

For ready-to-use browser tools built with this engine:

- [Instagram Grid Maker](https://splitimage.io/instagram-grid-maker/) — split a photo into connected profile-grid tiles.
- [TikTok Banner Splitter](https://splitimage.io/tiktok-banner-splitter/) — create a three-part profile banner.
- [Instagram Carousel Splitter](https://splitimage.io/instagram-carousel-splitter/) — turn a wide image into sequential carousel slides.

The library below provides the processing APIs; the website provides the editing interface.

## Use the source

This project can be used directly from source; an npm publication is not required.

```sh
git clone https://github.com/WanderZil/splitimage-engine.git
cd splitimage-engine
npm ci
npm test
```

Copy its `src/` directory into your application's source tree. The examples below assume it is available at `./splitimage-engine/src/`.

```js
import { splitImageToZip } from './splitimage-engine/src/index.js';

// `file` is a File supplied by your application's own file picker.
export async function splitFile(file) {
  return splitImageToZip(file, {
    layoutKey: '3x3',
    format: 'png',
    numberFromBottomRight: true,
  });
}
// Returns { blob, fileName, tileCount }.
// Your application decides how to save or display the result.
```

You can also install a local checkout into a bundler-based application:

```sh
npm install /absolute/path/to/splitimage-engine
```

Then import from `@splitimage/engine`. The package name is metadata; this README does not assume that name has been published or reserved on npm. When using native browser modules, serve files over HTTP and use relative imports rather than a bare package name.

## API

### `splitImageToBlobs(source, options?)`

Accepts a `File`, `Blob`, object URL, data URL, or image URL readable by the browser. Returns a promise of `{ index, tile, blob, fileName }[]`. Each `tile` contains `index`, `row`, `column`, `x`, `y`, `width`, and `height` in source-image pixels.

| Option | Default | Meaning |
| --- | --- | --- |
| `layoutKey` | `'3x3'` | Preset such as `'2x2'`, `'1x3'`, or `'custom-2x7'` |
| `fileName` | File name or `'image.png'` | Base name for exported tiles |
| `format` | Inferred from name | `'png'`, `'jpeg'` / `'jpg'`, `'webp'`; other extensions fall back to JPEG |
| `numberFromBottomRight` | `false` | Reverse file numbering for profile-grid publishing |
| `partialCrop` | — | Normalized `{ left, top, width, height }` to split as an equal grid |
| `tileRects` | — | Explicit pixel rectangles, each with a positive `index` |
| `crop` | — | Normalized crop for identical aspect-ratio tiles |
| `tileAspect` | `{ width: 3, height: 4 }` | Tile ratio when using `crop` |
| `gridBoundaries` | — | Normalized `{ x: number[], y: number[] }` boundaries |
| `boundaries` | — | Normalized horizontal boundaries for one row |
| `reelsCover` / `postCover` | `false` | Add vertical / horizontal padding; choose only one |
| `paddingMode` | `'color'` | `'color'`, `'blur'`, or `'image'` |
| `paddingColor` | `'#000000'` | Canvas fill color |
| `paddingBlurStrength` | `60` | Blur strength from 0 to 100 |
| `paddingBackgroundUrl` | `null` | Background image source for image padding |
| `paddingBackgroundOffsetX/Y` | `0` | Background pan offset, from -1 to 1 |

Use one geometry option at a time. If several are supplied, precedence is `partialCrop`, `tileRects`, `crop`, `gridBoundaries`, `boundaries`, then the equal grid. Crop coordinates and boundaries refer to the original image, not a scaled preview. Arrays are returned in geometric order; reversed numbering changes filenames, not array order.

### `splitImageToZip(sourceOrSources, options?)`

Accepts one source, or an array of sources / `{ source, fileName? }` entries. Returns `{ blob, fileName, tileCount }`. All images use the supplied options. For a batch with different crop geometry per image, call `splitImageToBlobs` separately and pass the resulting entries to `createZipBlob`.

`zipFileName` sets the archive name for a batch. Single-image archives use `<base>_split.zip`. Duplicate entry names receive numeric suffixes, including case-insensitive collisions. ZIP entries are flat filenames, with path separators replaced by underscores.

### Geometry and analysis

```js
import {
  getInstagramDefaultCrop,
  getInstagramCarouselAspectRatio,
  splitImageToBlobs,
  detectSplitSeams,
} from './splitimage-engine/src/index.js';

export async function makeCarousel(file, sourceWidth, sourceHeight) {
  const slides = 5;
  const crop = getInstagramDefaultCrop(
    { width: sourceWidth, height: sourceHeight },
    1, slides, getInstagramCarouselAspectRatio(slides),
  );
  return splitImageToBlobs(file, {
    layoutKey: 'custom-1x5', crop,
    tileAspect: { width: 4, height: 5 }, format: 'png',
  });
}

export async function splitAtSeams(file) {
  const { x, y, confidence } = await detectSplitSeams(file, { rows: 1, columns: 3 });
  // Review confidence and preview proposed boundaries in your application.
  const tiles = await splitImageToBlobs(file, { gridBoundaries: { x, y } });
  return { tiles, confidence };
}
```

Other exports include:

- `getTileRects(width, height, rows, columns)` and boundary variants: pixel geometry without decoding or rendering.
- `getInstagramTileRects`, `getInstagramCarouselTileRects`, `constrainInstagramCrop`, `moveInstagramCrop`, `zoomInstagramCrop`: aspect-constrained crop math.
- `getInstagramPostCoverPadding`, `getInstagramReelsCoverPadding`: integer padding dimensions.
- `createTileBlob(image, rect, mimeType, options?)`: render one rectangle from an already decoded image.
- `drawReelsCoverTile` / `drawPostCoverTile`: draw on a caller-owned Canvas context. Their options use `mode`, `color`, `blurStrength`, `backgroundImage`, `backgroundOffsetX/Y`.
- `getSeamScores`, `findSeams`, `findProminentSeams`: analysis of RGBA pixels and seam scores.
- `createZipBlob([{ fileName, blob }])`: ZIP packaging independent of the browser DOM.
- Layout and filename helpers exported from `src/index.js`.

## Runtime and limits

Image decoding/rendering requires a browser with ES modules, Canvas 2D, `Image`, `Blob` and `URL.createObjectURL`. It does not run unchanged in Node.js, SSR, or a Web Worker. Geometry and ZIP helpers can run in Node.js 22+. Node.js 22+ is required for the development tools.

- General custom layouts support 1–10 rows and columns. One-row strips support up to 20 columns. `getSplitLayout` preserves the website's fallback to `3x3` for unknown keys.
- For low-level geometry helpers, supply finite positive dimensions, valid increasing boundaries in `[0, 1]`, and valid row/column counts. Rendered rectangles must be nonempty and inside the source image; invalid exports reject.
- A regular grid distributes remainder pixels. Aspect-constrained tiles may discard a few edge pixels to keep every tile identical. Padding is rounded to integer pixels, so tiny outputs can deviate slightly from the target ratio.
- Input formats depend on the browser decoder. HEIC/AVIF support is not guaranteed; there is no bundled codec. This is a static-image tool, not an animated GIF/video processor.
- PNG preserves alpha. JPEG does not preserve transparency; JPEG/WebP use encoder quality `0.92`. Output is re-encoded, so original metadata and byte-identical files are not preserved. Unsupported output encoders reject instead of silently mislabeling a PNG.
- Blur rendering depends on Canvas filter support. Validate it in the browsers you target; the automated browser suite currently runs Chromium.
- Tiles and ZIP contents are held in memory. There is no streaming encoder or ZIP64 support. ZIP filenames are UTF-8; archives are uncompressed, not a file-size optimization.
- Social-media constants describe this library's export geometry, not a guarantee about how another platform will display every post.

## Privacy boundary

The engine has no image-upload API, analytics or telemetry. `File`/`Blob` processing happens locally. Passing an HTTP image URL (including a padding background URL) can cause a network request; cross-origin images must be readable by Canvas or decoding/export can fail. Prefer local `File`/`Blob` inputs and object URLs. Revoke object URLs you create after processing; the engine revokes only URLs it creates itself.

These statements apply to this library. They do not independently audit the hosting website, its dependencies, or code an application adds around the engine.

## Development

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm pack --dry-run
```

`npm run check` runs unit and browser tests. Tests generate their own images; no brand artwork or website screenshots are included. The browser test server serves only an empty test document and engine modules. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution boundary.

## License

[MIT](LICENSE) applies to the files in this repository. You may reuse the engine commercially while retaining the required license notice. No website backlink is required. SplitImage.io's website UI, content and brand assets are outside this repository and this license.
