import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPostCoverTile, drawReelsCoverTile, getInstagramCenterTileIndex, nudgeBackgroundOffset, resolveReelsBlurAmount, resolveReelsBlurScale } from '../src/padding.js';

test('maps blur strength to stronger blur radius and enlarge scale', () => {
  const soft = resolveReelsBlurAmount({ width: 1080, height: 1440 }, 10);
  const strong = resolveReelsBlurAmount({ width: 1080, height: 1440 }, 100);
  assert.ok(strong > soft);
  assert.ok(resolveReelsBlurScale(100) > resolveReelsBlurScale(0));
});

test('uses the source surrounding a tile as the blurred 9:16 Reels background', () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    fillRect() {},
    drawImage(...args) { calls.push(args); }
  };
  const image = { naturalWidth: 600, naturalHeight: 1200 };
  const rect = { x: 20, y: 400, width: 300, height: 400 };

  drawReelsCoverTile(context, image, rect, { mode: 'blur', blurStrength: 60 });

  assert.equal(calls.length, 2);
  const [background, mainTile] = calls;
  assert.equal(background[1], rect.x);
  assert.ok(background[2] < rect.y);
  assert.ok(background[4] > rect.height);
  assert.deepEqual(mainTile.slice(1, 5), [rect.x, rect.y, rect.width, rect.height]);
});

test('keeps the surrounding source pixels continuous at zero blur', () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    fillRect() {},
    drawImage(...args) { calls.push(args); }
  };
  const image = { naturalWidth: 600, naturalHeight: 1200 };
  const rect = { x: 20, y: 400, width: 300, height: 400 };

  drawReelsCoverTile(context, image, rect, { mode: 'blur', blurStrength: 0 });

  const [background, mainTile] = calls;
  assert.deepEqual(background.slice(1), [20, 333, 300, 534, 0, 0, 300, 534]);
  assert.deepEqual(mainTile.slice(5), [0, 67, 300, 400]);
});

test('extends and blurs the original image edge only when the 9:16 source area runs out', () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    fillRect() {},
    drawImage(...args) { calls.push(args); }
  };
  const image = { naturalWidth: 600, naturalHeight: 400 };
  const rect = { x: 20, y: 0, width: 300, height: 400 };

  drawReelsCoverTile(context, image, rect, { mode: 'blur', blurStrength: 60 });

  assert.equal(calls.length, 4);
  const [topEdge, sourceArea, bottomEdge, mainTile] = calls;
  assert.equal(topEdge[2], 0);
  assert.equal(sourceArea[2], 0);
  assert.ok(bottomEdge[2] > 0);
  assert.deepEqual(mainTile.slice(1, 5), [rect.x, rect.y, rect.width, rect.height]);
});

test('uses source pixels on either side of the 3:4 tile for a 4:5 post background', () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    fillRect() {},
    drawImage(...args) { calls.push(args); }
  };
  const image = { naturalWidth: 1200, naturalHeight: 900 };
  const rect = { x: 400, y: 120, width: 300, height: 400 };

  drawPostCoverTile(context, image, rect, { mode: 'blur', blurStrength: 0 });

  const [background, mainTile] = calls;
  assert.deepEqual(background.slice(1), [390, 120, 320, 400, 0, 0, 320, 400]);
  assert.deepEqual(mainTile.slice(1, 5), [400, 120, 300, 400]);
  assert.deepEqual(mainTile.slice(5), [10, 0, 300, 400]);
});

test('uses blurred source edges only when 4:5 side padding exceeds the original image', () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    fillRect() {},
    drawImage(...args) { calls.push(args); }
  };
  const image = { naturalWidth: 300, naturalHeight: 400 };
  const rect = { x: 0, y: 0, width: 300, height: 400 };

  drawPostCoverTile(context, image, rect, { mode: 'blur', blurStrength: 60 });

  assert.equal(calls.length, 4);
  const [leftEdge, sourceArea, rightEdge, mainTile] = calls;
  assert.equal(leftEdge[1], 0);
  assert.equal(sourceArea[1], 0);
  assert.ok(rightEdge[1] > 0);
  assert.deepEqual(mainTile.slice(1, 5), [0, 0, 300, 400]);
});

test('nudges background offsets within the -1 to 1 range', () => {
  const moved = nudgeBackgroundOffset({ backgroundOffsetX: 0, backgroundOffsetY: 0 }, 'x', 1);
  assert.equal(moved.backgroundOffsetX, 0.12);
  assert.equal(moved.backgroundOffsetY, 0);

  const clamped = nudgeBackgroundOffset({ backgroundOffsetX: 0.95, backgroundOffsetY: -0.95 }, 'y', -1);
  assert.equal(clamped.backgroundOffsetY, -1);
});

test('picks the geometric center tile for reels fill preview', () => {
  assert.equal(getInstagramCenterTileIndex(3, 3), 4);
  assert.equal(getInstagramCenterTileIndex(2, 3), 1);
});
