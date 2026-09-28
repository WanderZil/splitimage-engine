import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test('demo previews the 3:4 profile grid and the 4:5 or 9:16 fill, then ZIPs those tiles', async ({ page }) => {
  await page.goto('/demo/');
  await expect(page.locator('#preview-intro')).toBeVisible();
  await expect(page.locator('#status')).toContainText('Choose an image to start');
  await page.locator('#source').setInputFiles(path.resolve('assets/demo-original.webp'));
  await expect(page.locator('#preview-intro')).toBeHidden();
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
  await expect(page.locator('#fill-preview')).toBeHidden();
  const dimensions = () => page.locator('#export-image').evaluate(async image => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(await dimensions()).toEqual([300, 400]);

  await page.getByRole('button', { name: '4:5 post' }).click();
  await expect(page.locator('[data-fill-mode="blur"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fill-preview')).toBeVisible();
  await expect(page.locator('#fill-preview-meta')).toContainText('4:5');
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
  expect(await dimensions()).toEqual([320, 400]);
  await page.locator('[data-fill-mode="color"]').click();
  await page.locator('#fill-color').fill('#123456');
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
  const edge = await page.locator('#export-image').evaluate(async image => {
    const bitmap = await createImageBitmap(await (await fetch(image.src)).blob());
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
    const pixel = [...context.getImageData(0, 0, 1, 1).data]; bitmap.close(); return pixel;
  });
  expect(edge).toEqual([18, 52, 86, 255]);

  await page.getByRole('button', { name: 'Reels cover' }).click();
  await expect(page.locator('#post-aspect')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-fill-mode="color"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fill-preview-meta')).toContainText('9:16');
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
  expect(await dimensions()).toEqual([300, 534]);
  await page.locator('[data-fill-mode="blur"]').click();
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
  expect(await dimensions()).toEqual([300, 534]);

  const exportBytes = await page.locator('#export-image').evaluate(async image =>
    [...new Uint8Array(await (await fetch(image.src)).arrayBuffer())]);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('demo-original_split.zip');
  const zip = await readFile(await download.path());
  expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  expect(zip.readUInt16LE(8)).toBe(0); // stored, not recompressed
  expect(zip.includes(Buffer.from(exportBytes))).toBe(true);

  await page.locator('[data-fill-mode="image"]').click();
  await expect(page.locator('#status')).toContainText('Choose a background image');
  await page.locator('#background').setInputFiles(path.resolve('assets/demo-original.webp'));
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
  await page.locator('summary').click();
  await page.locator('#crop-zoom').fill('150');
  await expect.poll(dimensions, { timeout: 20_000 }).toEqual([198, 352]);
  await expect(page.locator('#status')).toContainText('Ready — 9 tiles');
});
