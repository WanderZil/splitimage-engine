import { getInstagramPostCoverPadding, getInstagramReelsCoverPadding, instagramReelsCover } from './geometry.js';

export const instagramReelsPaddingModes = Object.freeze(['color', 'blur', 'image']);

export const defaultInstagramReelsPadding = Object.freeze({
  mode: 'color',
  color: instagramReelsCover.defaultPaddingColor,
  blurStrength: 60,
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  backgroundImage: null
});

export const defaultInstagramPostPadding = Object.freeze({
  mode: 'blur',
  color: instagramReelsCover.defaultPaddingColor,
  blurStrength: 60,
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  backgroundImage: null
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getInstagramCenterTileIndex(rows, columns) {
  const centerRow = Math.floor((rows - 1) / 2);
  const centerCol = Math.floor((columns - 1) / 2);
  return centerRow * columns + centerCol;
}

export function nudgeBackgroundOffset(current, axis, direction, step = 0.12) {
  const key = axis === 'x' ? 'backgroundOffsetX' : 'backgroundOffsetY';
  const next = clamp((Number(current[key]) || 0) + direction * step, -1, 1);
  return { ...current, [key]: Math.round(next * 100) / 100 };
}

export function resolveReelsBlurAmount(tileSize, blurStrength = defaultInstagramReelsPadding.blurStrength) {
  const strength = clamp(Number(blurStrength) || 0, 0, 100) / 100;
  const base = Math.min(tileSize.width || tileSize, tileSize.height || tileSize);
  const maxBlur = Math.max(4, Math.round(base * 0.14));
  return Math.round(maxBlur * strength);
}

export function resolveReelsBlurScale(blurStrength = defaultInstagramReelsPadding.blurStrength) {
  const strength = clamp(Number(blurStrength) || 0, 0, 100) / 100;
  return 1 + strength * 0.16;
}

export function drawReelsCoverTile(context, image, rect, {
  mode = 'color',
  color = instagramReelsCover.defaultPaddingColor,
  blurStrength = defaultInstagramReelsPadding.blurStrength,
  backgroundImage = null,
  backgroundOffsetX = 0,
  backgroundOffsetY = 0
} = {}) {
  const { paddingTop, outputHeight } = getInstagramReelsCoverPadding(rect.height);
  const width = rect.width;
  const height = outputHeight;

  if (mode === 'blur') {
    drawBlurredPadding(context, image, rect, width, height, blurStrength);
  } else if (mode === 'image' && backgroundImage) {
    drawCoverImage(context, backgroundImage, width, height, backgroundOffsetX, backgroundOffsetY);
  } else {
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, paddingTop, rect.width, rect.height);
}

export function drawPostCoverTile(context, image, rect, {
  mode = 'blur',
  color = instagramReelsCover.defaultPaddingColor,
  blurStrength = defaultInstagramPostPadding.blurStrength,
  backgroundImage = null,
  backgroundOffsetX = 0,
  backgroundOffsetY = 0
} = {}) {
  const { paddingLeft, outputWidth } = getInstagramPostCoverPadding(rect.width, rect.height);

  if (mode === 'blur') {
    drawBlurredHorizontalPadding(context, image, rect, outputWidth, rect.height, paddingLeft, blurStrength);
  } else if (mode === 'image' && backgroundImage) {
    drawCoverImage(context, backgroundImage, outputWidth, rect.height, backgroundOffsetX, backgroundOffsetY);
  } else {
    context.fillStyle = color;
    context.fillRect(0, 0, outputWidth, rect.height);
  }

  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, paddingLeft, 0, rect.width, rect.height);
}

function drawBlurredPadding(context, image, rect, width, height, blurStrength) {
  const { paddingTop, paddingBottom } = getInstagramReelsCoverPadding(rect.height);
  const blurAmount = resolveReelsBlurAmount(rect, blurStrength);
  const imageHeight = image.naturalHeight || image.height || 0;
  const requestedTop = rect.y - paddingTop;
  const requestedBottom = rect.y + rect.height + paddingBottom;
  const scale = resolveReelsBlurScale(blurStrength);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  // Build the blurred 9:16 layer from the original pixels immediately above
  // and below this tile. The sharp 3:4 tile is painted over it by the caller.
  context.save();
  context.filter = `blur(${blurAmount}px)`;
  context.fillStyle = '#111827';
  context.fillRect(0, 0, width, height);

  if (imageHeight > 0) {
    const sourceTop = Math.max(0, requestedTop);
    const sourceBottom = Math.min(imageHeight, requestedBottom);
    const sourceHeight = Math.max(0, sourceBottom - sourceTop);
    const missingTop = Math.max(0, sourceTop - requestedTop);
    const missingBottom = Math.max(0, requestedBottom - sourceBottom);

    if (missingTop > 0) {
      drawBlurredSourceEdge(context, image, rect, {
        edge: 'top', sourceY: 0, targetY: drawY,
        targetHeight: missingTop * scale, targetX: drawX, targetWidth: drawWidth
      });
    }

    if (sourceHeight > 0) {
      context.drawImage(
        image,
        rect.x,
        sourceTop,
        rect.width,
        sourceHeight,
        drawX,
        drawY + (sourceTop - requestedTop) * scale,
        drawWidth,
        sourceHeight * scale
      );
    }

    if (missingBottom > 0) {
      drawBlurredSourceEdge(context, image, rect, {
        edge: 'bottom', sourceY: imageHeight, targetY: drawY + (height - missingBottom) * scale,
        targetHeight: missingBottom * scale, targetX: drawX, targetWidth: drawWidth
      });
    }
  } else {
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, drawX, drawY, drawWidth, drawHeight);
  }

  context.restore();
}

function drawBlurredHorizontalPadding(context, image, rect, width, height, paddingLeft, blurStrength) {
  const paddingRight = width - paddingLeft - rect.width;
  const blurAmount = resolveReelsBlurAmount(rect, blurStrength);
  const imageWidth = image.naturalWidth || image.width || 0;
  const requestedLeft = rect.x - paddingLeft;
  const requestedRight = rect.x + rect.width + paddingRight;
  const scale = resolveReelsBlurScale(blurStrength);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  context.save();
  context.filter = `blur(${blurAmount}px)`;
  context.fillStyle = '#111827';
  context.fillRect(0, 0, width, height);

  if (imageWidth > 0) {
    const sourceLeft = Math.max(0, requestedLeft);
    const sourceRight = Math.min(imageWidth, requestedRight);
    const sourceWidth = Math.max(0, sourceRight - sourceLeft);
    const missingLeft = Math.max(0, sourceLeft - requestedLeft);
    const missingRight = Math.max(0, requestedRight - sourceRight);

    if (missingLeft > 0) {
      drawBlurredSourceHorizontalEdge(context, image, rect, {
        edge: 'left', sourceX: 0, targetX: drawX,
        targetWidth: missingLeft * scale, targetY: drawY, targetHeight: drawHeight
      });
    }

    if (sourceWidth > 0) {
      context.drawImage(
        image,
        sourceLeft,
        rect.y,
        sourceWidth,
        rect.height,
        drawX + (sourceLeft - requestedLeft) * scale,
        drawY,
        sourceWidth * scale,
        drawHeight
      );
    }

    if (missingRight > 0) {
      drawBlurredSourceHorizontalEdge(context, image, rect, {
        edge: 'right', sourceX: imageWidth, targetX: drawX + (width - missingRight) * scale,
        targetWidth: missingRight * scale, targetY: drawY, targetHeight: drawHeight
      });
    }
  } else {
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, drawX, drawY, drawWidth, drawHeight);
  }

  context.restore();
}

function drawBlurredSourceEdge(context, image, rect, {
  edge, sourceY, targetY, targetHeight, targetX, targetWidth
}) {
  const sampleHeight = Math.max(1, Math.min(rect.height, Math.round(targetHeight / 2)));
  const sampleY = edge === 'top' ? sourceY : Math.max(0, sourceY - sampleHeight);
  context.drawImage(
    image,
    rect.x,
    sampleY,
    rect.width,
    sampleHeight,
    targetX,
    targetY,
    targetWidth,
    targetHeight
  );
}

function drawBlurredSourceHorizontalEdge(context, image, rect, {
  edge, sourceX, targetX, targetWidth, targetY, targetHeight
}) {
  const sampleWidth = Math.max(1, Math.min(rect.width, Math.round(targetWidth / 2)));
  const sampleX = edge === 'left' ? sourceX : Math.max(0, sourceX - sampleWidth);
  context.drawImage(
    image,
    sampleX,
    rect.y,
    sampleWidth,
    rect.height,
    targetX,
    targetY,
    targetWidth,
    targetHeight
  );
}

function drawCoverImage(context, backgroundImage, width, height, offsetX = 0, offsetY = 0) {
  const imageWidth = backgroundImage.naturalWidth || backgroundImage.width;
  const imageHeight = backgroundImage.naturalHeight || backgroundImage.height;
  if (!imageWidth || !imageHeight) {
    context.fillStyle = '#111827';
    context.fillRect(0, 0, width, height);
    return;
  }
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const maxOffsetX = Math.max(0, (drawWidth - width) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - height) / 2);
  const x = (width - drawWidth) / 2 - clamp(offsetX, -1, 1) * maxOffsetX;
  const y = (height - drawHeight) / 2 - clamp(offsetY, -1, 1) * maxOffsetY;
  context.drawImage(backgroundImage, x, y, drawWidth, drawHeight);
}
