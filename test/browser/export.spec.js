import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('PNG cuts preserve pixels and transparency; a partial crop ends at its requested boundary', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { splitImageToBlobs } = await import('/src/index.js');
    const canvas = document.createElement('canvas');
    canvas.width = 12; canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 6, 8);
    const file = new File([await new Promise(resolve => canvas.toBlob(resolve))], 'source.png', { type: 'image/png' });
    async function inspect(blob) {
      const bitmap = await createImageBitmap(blob);
      const output = document.createElement('canvas'); output.width = bitmap.width; output.height = bitmap.height;
      const context = output.getContext('2d'); context.drawImage(bitmap, 0, 0);
      return { width: bitmap.width, height: bitmap.height, pixel: [...context.getImageData(0, 0, 1, 1).data] };
    }
    const tiles = await splitImageToBlobs(file, { layoutKey: '1x2' });
    const crop = await splitImageToBlobs(file, { layoutKey: '1x2', partialCrop: { left: .25, top: .25, width: .5, height: .5 } });
    return { names: tiles.map(t => t.fileName), tiles: await Promise.all(tiles.map(t => inspect(t.blob))), crop: await Promise.all(crop.map(t => inspect(t.blob))) };
  });
  expect(result.names).toEqual(['source_001.png', 'source_002.png']);
  expect(result.tiles).toEqual([{ width: 6, height: 8, pixel: [255, 0, 0, 255] }, { width: 6, height: 8, pixel: [0, 0, 0, 0] }]);
  expect(result.crop.map(t => [t.width, t.height])).toEqual([[3, 4], [3, 4]]);
});

test('cover padding preserves the sharp center, adds requested color, and exports correct formats', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { splitImageToBlobs } = await import('/src/index.js');
    const source = document.createElement('canvas'); source.width = 90; source.height = 40;
    const context = source.getContext('2d'); context.fillStyle = 'red'; context.fillRect(0, 0, 90, 40);
    const blob = await new Promise(resolve => source.toBlob(resolve));
    const base = { layoutKey: '1x3', crop: { left: 0, top: 0, width: 1, height: 1 }, format: 'png', paddingColor: '#0000ff' };
    const reels = await splitImageToBlobs(blob, { ...base, reelsCover: true });
    const posts = await splitImageToBlobs(blob, { ...base, postCover: true });
    async function inspect(tile) {
      const bitmap = await createImageBitmap(tile.blob);
      const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
      const x = c.getContext('2d'); x.drawImage(bitmap, 0, 0);
      return { width: bitmap.width, height: bitmap.height, edge: [...x.getImageData(0, 0, 1, 1).data], center: [...x.getImageData(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1).data] };
    }
    const formats = [];
    for (const format of ['jpeg', 'webp']) {
      const [tile] = await splitImageToBlobs(blob, { layoutKey: '1x3', format });
      formats.push({ type: tile.blob.type, name: tile.fileName });
    }
    return { reels: await inspect(reels[0]), posts: await inspect(posts[0]), formats };
  });
  expect(result.reels).toEqual({ width: 30, height: 54, edge: [0, 0, 255, 255], center: [255, 0, 0, 255] });
  expect(result.posts).toEqual({ width: 32, height: 40, edge: [0, 0, 255, 255], center: [255, 0, 0, 255] });
  expect(result.formats).toEqual([{ type: 'image/jpeg', name: 'image_001.jpg' }, { type: 'image/webp', name: 'image_001.webp' }]);
});

test('local-file ZIP exports and seam detection make no processing network requests', async ({ page }) => {
  await page.evaluate(() => import('/src/index.js'));
  const requests = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const result = await page.evaluate(async () => {
    const { splitImageToZip, detectSplitSeams } = await import('/src/index.js');
    const c = document.createElement('canvas'); c.width = 90; c.height = 40;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 45, 40); ctx.fillStyle = 'blue'; ctx.fillRect(45, 0, 45, 40);
    const file = new File([await new Promise(resolve => c.toBlob(resolve))], '风景.png', { type: 'image/png' });
    const zip = await splitImageToZip([file, file], { layoutKey: '1x2' });
    const seams = await detectSplitSeams(file, { rows: 1, columns: 2 });
    return { count: zip.tileCount, type: zip.blob.type, size: zip.blob.size, seams };
  });
  expect(result.count).toBe(4); expect(result.type).toBe('application/zip'); expect(result.size).toBeGreaterThan(0);
  expect(result.seams.x).toEqual([0, .5, 1]);
  expect(requests).toEqual([]);
});

test('invalid rectangles and undecodable images reject instead of exporting empty tiles', async ({ page }) => {
  const errors = await page.evaluate(async () => {
    const { splitImageToBlobs } = await import('/src/index.js');
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    const blob = await new Promise(resolve => c.toBlob(resolve));
    const errors = [];
    for (const task of [() => splitImageToBlobs(blob, { layoutKey: '3x3' }), () => splitImageToBlobs(new Blob(['not an image'])), () => splitImageToBlobs(blob, { format: 'gif' })]) {
      try { await task(); } catch (e) { errors.push(e.message); }
    }
    return errors;
  });
  expect(errors).toHaveLength(3);
});
