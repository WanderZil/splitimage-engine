import {
  getInstagramGridTileNumber,
  getSplitLayout,
  getTileFileName,
  getTileRects,
  getTileRectsFromBoundaries,
  getTileRectsFromGridBoundaries,
  getZipFileName
} from './split-utils.js';
import { createZipBlob } from './zip.js';

import { getOutputSpec, loadImage, createTileBlob } from './image.js';
import { getInstagramTileRects } from './geometry.js';

function resolveTiles(dimensions, layout, options) {
  const { width, height } = dimensions;
  const { rows, columns } = layout;

  if (options.partialCrop) {
    const { left, top, width: cropWidth, height: cropHeight } = options.partialCrop;
    return getTileRectsFromGridBoundaries(
      width,
      height,
      Array.from({ length: columns + 1 }, (_, index) => left + (cropWidth * index) / columns),
      Array.from({ length: rows + 1 }, (_, index) => top + (cropHeight * index) / rows)
    );
  }

  if (options.tileRects) return options.tileRects;
  if (options.crop) return getInstagramTileRects(dimensions, options.crop, rows, columns, options.tileAspect);

  if (options.gridBoundaries) {
    return getTileRectsFromGridBoundaries(width, height, options.gridBoundaries.x, options.gridBoundaries.y);
  }

  if (options.boundaries) {
    return getTileRectsFromBoundaries(width, height, options.boundaries);
  }

  return getTileRects(width, height, rows, columns);
}

/**
 * Split one image into tile blobs. All work happens in the browser — no network upload.
 * @param {Blob|string} imageSource - Blob/File, object URL, data URL, or browser-loadable URL.
 * @param {object} [options]
 * @param {string} [options.layoutKey='3x3']
 * @param {string} [options.fileName='image.png']
 * @param {string} [options.format] - Force png, jpeg, or webp output.
 * @param {boolean} [options.numberFromBottomRight=false] - Instagram grid publish order.
 * @param {Array} [options.tileRects] - Precomputed tile rectangles.
 * @param {number[]} [options.boundaries] - Normalized strip boundaries (0–1).
 * @param {{x: number[], y: number[]}} [options.gridBoundaries] - Normalized grid boundaries.
 * @param {{left: number, top: number, width: number, height: number}} [options.partialCrop] - Normalized crop region.
 */
export async function splitImageToBlobs(imageSource, options = {}) {
  const layout = getSplitLayout(options.layoutKey);
  const image = await loadImage(imageSource);
  const dimensions = { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  const fileName = options.fileName || imageSource?.name || 'image.png';
  const output = getOutputSpec(fileName, options.format);
  const tiles = resolveTiles(dimensions, layout, options);
  const results = [];

  if (!tiles.length) throw new RangeError('Image is too small for this layout.');
  for (const tile of tiles) {
    const blob = await createTileBlob(image, tile, output.mimeType, options);
    const index = options.numberFromBottomRight
      ? getInstagramGridTileNumber(tile.index, tiles.length)
      : tile.index;
    results.push({
      index,
      tile,
      blob,
      fileName: getTileFileName(fileName, index, output.extension)
    });
  }

  return results;
}

/**
 * Split one or more images and package tiles into a ZIP blob.
 * @param {string|Array<{source: string, fileName?: string}>} imageInput
 */
export async function splitImageToZip(imageInput, options = {}) {
  const images = Array.isArray(imageInput)
    ? imageInput.map((item, index) => (typeof item === 'string' || item instanceof Blob
      ? { source: item, fileName: options.fileName || item?.name || `image_${index + 1}.png` }
      : { ...item, fileName: item.fileName || item.source?.name || `image_${index + 1}.png` }))
    : [{ source: imageInput, fileName: options.fileName || imageInput?.name || 'image.png' }];

  if (!images.length) throw new RangeError('Provide at least one image.');
  const entries = [];
  for (const image of images) {
    const tiles = await splitImageToBlobs(image.source, { ...options, fileName: image.fileName });
    entries.push(...tiles.map(({ fileName, blob }) => ({ fileName, blob })));
  }

  const zipBlob = await createZipBlob(entries);
  const zipFileName = images.length === 1
    ? getZipFileName(images[0].fileName)
    : (options.zipFileName || 'split_images.zip');

  return { blob: zipBlob, fileName: zipFileName, tileCount: entries.length };
}
