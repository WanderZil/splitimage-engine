export const splitLayouts = Object.freeze({
  '2x2': Object.freeze({ rows: 2, columns: 2 }),
  '3x3': Object.freeze({ rows: 3, columns: 3 }),
  '2x3': Object.freeze({ rows: 2, columns: 3 }),
  '1x2': Object.freeze({ rows: 1, columns: 2 }),
  '1x3': Object.freeze({ rows: 1, columns: 3 }),
  '1x4': Object.freeze({ rows: 1, columns: 4 }),
  '1x5': Object.freeze({ rows: 1, columns: 5 }),
  '1x6': Object.freeze({ rows: 1, columns: 6 }),
  '1x7': Object.freeze({ rows: 1, columns: 7 }),
  '1x10': Object.freeze({ rows: 1, columns: 10 }),
  '1x20': Object.freeze({ rows: 1, columns: 20 }),
  '2x1': Object.freeze({ rows: 2, columns: 1 }),
  '3x2': Object.freeze({ rows: 3, columns: 2 }),
  '3x1': Object.freeze({ rows: 3, columns: 1 })
});

export const generalSplitLayoutKeys = Object.freeze(['2x2', '3x3', '2x3', '1x2', '1x3', '2x1', '3x2', '3x1']);
export const carouselMaxSlides = 20;
export const carouselSplitLayoutKeys = Object.freeze(['1x3', '1x5', '1x7', '1x10', '1x20']);
export const bannerSplitLayoutKeys = Object.freeze(['1x2', '1x3', '1x4', '1x6']);

export function getCarouselLayoutKey(value) {
  const input = String(value ?? '').trim();
  if (!/^(20|1[0-9]|[1-9])$/.test(input)) return null;
  const count = Number(input);
  if (count < 1 || count > carouselMaxSlides) return null;
  return `custom-1x${count}`;
}

export function getSplitLayout(layoutKey = '3x3') {
  const customMatch = /^custom-(20|1[0-9]|[1-9])x(20|1[0-9]|[1-9])$/.exec(layoutKey);
  if (customMatch) {
    const rows = Number(customMatch[1]);
    const columns = Number(customMatch[2]);
    const isCarouselStrip = rows === 1 && columns >= 1 && columns <= carouselMaxSlides;
    const isGeneralGrid = rows >= 1 && rows <= 10 && columns >= 1 && columns <= 10;
    if (isCarouselStrip || isGeneralGrid) {
      return { key: layoutKey, rows, columns };
    }
  }

  const key = splitLayouts[layoutKey] ? layoutKey : '3x3';
  return { key, ...splitLayouts[key] };
}

export function getTileRects(width, height, rows, columns) {
  const tiles = [];
  for (let row = 0; row < rows; row += 1) {
    const y = Math.floor((row * height) / rows);
    const nextY = Math.floor(((row + 1) * height) / rows);
    for (let column = 0; column < columns; column += 1) {
      const x = Math.floor((column * width) / columns);
      const nextX = Math.floor(((column + 1) * width) / columns);
      tiles.push({
        index: tiles.length + 1,
        row,
        column,
        x,
        y,
        width: nextX - x,
        height: nextY - y
      });
    }
  }
  return tiles;
}

export function getTileRectsFromBoundaries(width, height, boundaries) {
  const points = Array.isArray(boundaries) && boundaries.length >= 2 ? boundaries : [0, 1];
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const x = Math.floor(width * start);
    const nextX = Math.floor(width * end);
    return { index: index + 1, row: 0, column: index, x, y: 0, width: Math.max(1, nextX - x), height };
  });
}

// Boundaries are expressed as fractions of the source image. Keeping them in
// normalized coordinates lets the preview and the original-resolution export
// share exactly the same split positions.
export function getTileRectsFromGridBoundaries(width, height, xBoundaries, yBoundaries) {
  const xs = Array.isArray(xBoundaries) && xBoundaries.length >= 2 ? xBoundaries : [0, 1];
  const ys = Array.isArray(yBoundaries) && yBoundaries.length >= 2 ? yBoundaries : [0, 1];
  const tiles = [];
  ys.slice(0, -1).forEach((startY, row) => {
    const endY = ys[row + 1];
    const y = Math.floor(height * startY);
    const nextY = Math.floor(height * endY);
    xs.slice(0, -1).forEach((startX, column) => {
      const endX = xs[column + 1];
      const x = Math.floor(width * startX);
      const nextX = Math.floor(width * endX);
      tiles.push({
        index: tiles.length + 1,
        row,
        column,
        x,
        y,
        width: Math.max(1, nextX - x),
        height: Math.max(1, nextY - y)
      });
    });
  });
  return tiles;
}

// Instagram shows the newest post at the top-left. Numbering the physical tiles
// from bottom-right makes tile 1 the first post and the final tile land top-left.
export function getInstagramGridTileNumber(tileIndex, totalTiles) {
  return totalTiles - tileIndex + 1;
}

export function getTileFileName(originalName, tileIndex, extension) {
  const lastDot = originalName.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < originalName.length - 1;
  const baseName = hasExtension ? originalName.slice(0, lastDot) : originalName;
  const originalExtension = hasExtension ? originalName.slice(lastDot + 1).toLowerCase() : 'png';
  const safeExtension = (extension || originalExtension).replace(/^\./, '').toLowerCase();
  return `${baseName}_${String(tileIndex).padStart(3, '0')}.${safeExtension}`;
}

export function getZipFileName(originalName) {
  const lastDot = originalName.lastIndexOf('.');
  const baseName = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  return `${baseName}_split.zip`;
}
