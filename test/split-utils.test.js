import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bannerSplitLayoutKeys,
  generalSplitLayoutKeys,
  getInstagramGridTileNumber,
  getCarouselLayoutKey,
  getSplitLayout,
  getTileFileName,
  getTileRects,
  getTileRectsFromGridBoundaries
} from '../src/split-utils.js';
import { createZipBlob } from '../src/zip.js';

test('uses a 3 by 3 layout when no preset has been selected', () => {
  assert.deepEqual(getSplitLayout(), { key: '3x3', rows: 3, columns: 3 });
});

test('maps a selected layout to its equal rows and columns', () => {
  assert.deepEqual(getSplitLayout('1x2'), { key: '1x2', rows: 1, columns: 2 });
  assert.deepEqual(getSplitLayout('1x4'), { key: '1x4', rows: 1, columns: 4 });
  assert.deepEqual(getSplitLayout('1x6'), { key: '1x6', rows: 1, columns: 6 });
  assert.deepEqual(getSplitLayout('3x1'), { key: '3x1', rows: 3, columns: 1 });
});

test('keeps banner presets to one horizontal row', () => {
  assert.deepEqual(bannerSplitLayoutKeys, ['1x2', '1x3', '1x4', '1x6']);
});

test('keeps long carousel presets out of the general splitter presets', () => {
  assert.deepEqual(generalSplitLayoutKeys, ['2x2', '3x3', '2x3', '1x2', '1x3', '2x1', '3x2', '3x1']);
});

test('supports a custom grid with one to ten rows and columns', () => {
  assert.deepEqual(getSplitLayout('custom-10x7'), { key: 'custom-10x7', rows: 10, columns: 7 });
  assert.deepEqual(getSplitLayout('custom-11x1'), { key: '3x3', rows: 3, columns: 3 });
});

test('accepts a custom carousel count from 1 through 20', () => {
  assert.equal(getCarouselLayoutKey(''), null);
  assert.equal(getCarouselLayoutKey('0'), null);
  assert.equal(getCarouselLayoutKey('7'), 'custom-1x7');
  assert.equal(getCarouselLayoutKey('10'), 'custom-1x10');
  assert.equal(getCarouselLayoutKey('20'), 'custom-1x20');
  assert.equal(getCarouselLayoutKey('21'), null);
});

test('maps carousel presets up to twenty slides', () => {
  assert.deepEqual(getSplitLayout('1x20'), { key: '1x20', rows: 1, columns: 20 });
  assert.deepEqual(getSplitLayout('custom-1x15'), { key: 'custom-1x15', rows: 1, columns: 15 });
});

test('creates contiguous integer tile boundaries that cover the full image', () => {
  assert.deepEqual(getTileRects(10, 7, 2, 3), [
    { index: 1, row: 0, column: 0, x: 0, y: 0, width: 3, height: 3 },
    { index: 2, row: 0, column: 1, x: 3, y: 0, width: 3, height: 3 },
    { index: 3, row: 0, column: 2, x: 6, y: 0, width: 4, height: 3 },
    { index: 4, row: 1, column: 0, x: 0, y: 3, width: 3, height: 4 },
    { index: 5, row: 1, column: 1, x: 3, y: 3, width: 3, height: 4 },
    { index: 6, row: 1, column: 2, x: 6, y: 3, width: 4, height: 4 }
  ]);
});

test('uses adjusted horizontal and vertical boundaries for matrix exports', () => {
  assert.deepEqual(getTileRectsFromGridBoundaries(1000, 800, [0, 0.25, 1], [0, 0.6, 1]), [
    { index: 1, row: 0, column: 0, x: 0, y: 0, width: 250, height: 480 },
    { index: 2, row: 0, column: 1, x: 250, y: 0, width: 750, height: 480 },
    { index: 3, row: 1, column: 0, x: 0, y: 480, width: 250, height: 320 },
    { index: 4, row: 1, column: 1, x: 250, y: 480, width: 750, height: 320 }
  ]);
});

test('adds a zero-padded tile number before the original extension', () => {
  assert.equal(getTileFileName('family.photo.JPG', 1), 'family.photo_001.jpg');
  assert.equal(getTileFileName('poster', 12), 'poster_012.png');
});

test('numbers Instagram grid tiles from bottom-right to top-left for publishing', () => {
  const tiles = getTileRects(900, 900, 3, 3);
  const numbers = tiles.map((tile) => getInstagramGridTileNumber(tile.index, tiles.length));

  assert.deepEqual(numbers, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(getTileFileName('grid.png', numbers[0]), 'grid_009.png');
  assert.equal(getTileFileName('grid.png', numbers.at(-1)), 'grid_001.png');
});

test('packages numbered image tiles in a standards-compliant ZIP archive', async () => {
  const zip = await createZipBlob([
    { fileName: 'image_001.png', blob: new Blob(['first']) },
    { fileName: 'image_002.png', blob: new Blob(['second']) }
  ]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(new TextDecoder().decode(bytes).includes('image_001.png'), true);
  assert.equal(new TextDecoder().decode(bytes).includes('image_002.png'), true);
});
