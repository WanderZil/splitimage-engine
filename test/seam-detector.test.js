import test from 'node:test';
import assert from 'node:assert/strict';
import { findProminentSeams, findSeams, getSeamScores } from '../src/seam-detector.js';

function panelPixels(width, height, boundaries, colors) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const panel = boundaries.findIndex((boundary) => x < boundary);
      const color = colors[panel];
      const offset = (y * width + x) * 4;
      data.set([...color, 255], offset);
    }
  }
  return { data, width, height };
}

test('finds full-height vertical color seams near the expected panel positions', () => {
  const pixels = panelPixels(300, 90, [98, 203, 300], [[18, 70, 165], [244, 107, 0], [235, 247, 250]]);
  const scores = getSeamScores(pixels, 'x');
  const seams = findSeams(scores, 3, pixels.width);
  assert.deepEqual(seams.positions, [0, 98, 203, 300]);
  assert.equal(seams.confidence.length, 2);
  assert.deepEqual(findProminentSeams(scores, pixels.width), [98, 203]);
});

test('finds full-width horizontal color seams for grid layouts', () => {
  const width = 80;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const color = y < 102 ? [30, 70, 150] : [242, 125, 10];
    for (let x = 0; x < width; x += 1) data.set([...color, 255], (y * width + x) * 4);
  }
  const seams = findSeams(getSeamScores({ data, width, height }, 'y'), 2, height);
  assert.deepEqual(seams.positions, [0, 102, 200]);
});
