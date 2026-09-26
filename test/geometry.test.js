import test from 'node:test';
import assert from 'node:assert/strict';
import { getTileRectsFromGridBoundaries, getTileRectsFromBoundaries, getInstagramDefaultCrop, getInstagramTileRects, getInstagramCarouselAspectRatio, getInstagramCarouselTileRects, getInstagramReelsCoverPadding } from '../src/index.js';

test('partial crops respect the final boundary instead of expanding to the image edge', () => {
  const tiles = getTileRectsFromGridBoundaries(1000, 800, [.25, .5, .75], [.25, .5, .75]);
  assert.equal(tiles.at(-1).x + tiles.at(-1).width, 750);
  assert.equal(tiles.at(-1).y + tiles.at(-1).height, 600);
  assert.equal(tiles.reduce((sum, t) => sum + t.width * t.height, 0), 500 * 400);
  const strip = getTileRectsFromBoundaries(1000, 800, [.25, .5, .75]);
  assert.equal(strip.at(-1).x + strip.at(-1).width, 750);
});

test('social grid geometry creates identical 3:4 tiles and 4:5 carousel slides', () => {
  const image = { width: 9000, height: 3000 };
  const grid = getInstagramTileRects(image, getInstagramDefaultCrop(image), 3, 3);
  assert.equal(grid.length, 9);
  assert.equal(new Set(grid.map(t => `${t.width}:${t.height}`)).size, 1);
  assert.ok(grid.every(t => t.width * 4 === t.height * 3));
  const crop = getInstagramDefaultCrop(image, 1, 7, getInstagramCarouselAspectRatio(7));
  const slides = getInstagramCarouselTileRects(image, crop, 7);
  assert.equal(slides.length, 7);
  assert.ok(slides.every(t => t.width * 5 === t.height * 4));
  assert.equal(getInstagramReelsCoverPadding(1440).outputHeight, 1920);
});
