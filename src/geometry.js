// Reels covers use a 9:16 canvas. Profile grid still shows the center 3:4 slice;
// the extra top/bottom bands are only visible in full-screen Reels playback.
export const instagramReelsCover = Object.freeze({
  targetTileWidth: 1080,
  targetTileHeight: 1440,
  targetOutputWidth: 1080,
  targetOutputHeight: 1920,
  paddingPerSide: 240,
  defaultPaddingColor: '#000000'
});

export function getInstagramReelsCoverPadding(tileHeight) {
  const padding = Math.round(tileHeight / 6);
  return {
    paddingTop: padding,
    paddingBottom: padding,
    outputHeight: tileHeight + padding * 2
  };
}

// A 4:5 post preserves the 3:4 center slice used by the profile grid and
// adds a small band on each side. Instagram's grid crop therefore stitches
// the same source image while the feed receives a full 4:5 post.
export function getInstagramPostCoverPadding(tileWidth, tileHeight) {
  const outputWidth = Math.round(tileHeight * 4 / 5);
  const totalPadding = Math.max(0, outputWidth - tileWidth);
  const paddingLeft = Math.floor(totalPadding / 2);
  return {
    paddingLeft,
    paddingRight: totalPadding - paddingLeft,
    outputWidth
  };
}

// Every exported Instagram tile uses the 3:4 profile-grid canvas. The crop
// therefore needs to match the entire selected grid, not the phone mockup.
export function getInstagramGridAspectRatio(rows = 3, columns = 3) {
  return (columns * 3) / (rows * 4);
}

// TikTok opens individual uploads as 9:16 posts, but its profile preview is
// still composed from the connected 3:4 centre of each tile. The download
// pipeline adds the top/bottom fill after this crop has been split.
export function getTikTokGridAspectRatio(rows = 3, columns = 3) {
  return getInstagramGridAspectRatio(rows, columns);
}

// A carousel is one horizontal strip of 4:5 portrait slides.
export function getInstagramCarouselAspectRatio(slides = 5) {
  return (Number(slides) * 4) / 5;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function constrainInstagramCrop(crop) {
  const width = clamp(Number(crop.width) || 1, 0.01, 1);
  const height = clamp(Number(crop.height) || 1, 0.01, 1);
  return {
    left: clamp(Number(crop.left) || 0, 0, 1 - width),
    top: clamp(Number(crop.top) || 0, 0, 1 - height),
    width,
    height
  };
}

export function getInstagramDefaultCrop({ width, height }, rows = 3, columns = 3, targetAspectRatio = getInstagramGridAspectRatio(rows, columns)) {
  const sourceAspectRatio = width / height;
  if (sourceAspectRatio > targetAspectRatio) {
    const cropWidth = targetAspectRatio / sourceAspectRatio;
    return { left: (1 - cropWidth) / 2, top: 0, width: cropWidth, height: 1 };
  }

  const cropHeight = sourceAspectRatio / targetAspectRatio;
  return { left: 0, top: (1 - cropHeight) / 2, width: 1, height: cropHeight };
}

export function zoomInstagramCrop(crop, baseCrop, zoom) {
  const scale = clamp(Number(zoom) || 1, 1, 3);
  const width = baseCrop.width / scale;
  const height = baseCrop.height / scale;
  const centerX = crop.left + crop.width / 2;
  const centerY = crop.top + crop.height / 2;
  return constrainInstagramCrop({ left: centerX - width / 2, top: centerY - height / 2, width, height });
}

export function moveInstagramCrop(crop, deltaX, deltaY, viewportWidth, viewportHeight) {
  return constrainInstagramCrop({
    ...crop,
    left: crop.left - (deltaX / viewportWidth) * crop.width,
    top: crop.top - (deltaY / viewportHeight) * crop.height
  });
}

export function getInstagramTileRects(image, crop, rows, columns, tileAspect = { width: 3, height: 4 }) {
  const clipped = constrainInstagramCrop(crop);
  const cropX = Math.floor(clipped.left * image.width);
  const cropY = Math.floor(clipped.top * image.height);
  const cropWidth = Math.floor(clipped.width * image.width);
  const cropHeight = Math.floor(clipped.height * image.height);
  // A regular equal-grid splitter distributes remainder pixels to the last
  // row/column. Instagram tiles need a stronger guarantee: the preview label,
  // each direct download, and the ZIP must all be the same integer 3:4 size.
  const aspectWidth = tileAspect.width;
  const aspectHeight = tileAspect.height;
  const units = Math.floor(Math.min(cropWidth / columns / aspectWidth, cropHeight / rows / aspectHeight));
  if (units < 1) return [];

  const tileWidth = units * aspectWidth;
  const tileHeight = units * aspectHeight;
  const gridWidth = tileWidth * columns;
  const gridHeight = tileHeight * rows;
  const gridX = cropX + Math.floor((cropWidth - gridWidth) / 2);
  const gridY = cropY + Math.floor((cropHeight - gridHeight) / 2);

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      index: index + 1,
      row,
      column,
      x: gridX + column * tileWidth,
      y: gridY + row * tileHeight,
      width: tileWidth,
      height: tileHeight
    };
  });
}

export function getInstagramCarouselTileRects(image, crop, slides) {
  return getInstagramTileRects(image, crop, 1, slides, { width: 4, height: 5 });
}
