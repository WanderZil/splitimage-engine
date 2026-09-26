import { getInstagramReelsCoverPadding } from './geometry.js';
import { drawPostCoverTile, drawReelsCoverTile } from './padding.js';

export function getOutputSpec(name, format) {
  if (format && !['png', 'webp', 'jpeg', 'jpg'].includes(format)) throw new TypeError('Unsupported output format.');
  if (format) name = `image.${format}`;
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : 'png';
  if (extension === 'png') return { extension: 'png', mimeType: 'image/png' };
  if (extension === 'webp') return { extension: 'webp', mimeType: 'image/webp' };
  return { extension: 'jpg', mimeType: 'image/jpeg' };
}

export function loadImage(source) {
  const ownedUrl = source instanceof Blob ? URL.createObjectURL(source) : null;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image for splitting.'));
    image.src = ownedUrl || source;
  }).finally(() => { if (ownedUrl) URL.revokeObjectURL(ownedUrl); });
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === mimeType) resolve(blob);
      else if (blob) reject(new Error(`Browser cannot encode ${mimeType}.`));
      else reject(new Error('Could not create an image tile.'));
    }, mimeType, 0.92);
  });
}

export async function createTileBlob(image, rect, mimeType, {
  reelsCover = false,
  postCover = false,
  paddingMode = 'color',
  paddingColor = '#000000',
  paddingBlurStrength = 60,
  paddingBackgroundUrl = null,
  paddingBackgroundOffsetX = 0,
  paddingBackgroundOffsetY = 0
} = {}) {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 || rect.x + rect.width > (image.naturalWidth || image.width) || rect.y + rect.height > (image.naturalHeight || image.height)) {
    throw new RangeError('Tile must be a nonempty rectangle inside the source image.');
  }
  if (reelsCover && postCover) throw new TypeError('Choose either reelsCover or postCover.');
  const canvas = document.createElement('canvas');
  if (!reelsCover && !postCover) {
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image canvas.');
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return canvasToBlob(canvas, mimeType);
  }

  const { outputHeight } = getInstagramReelsCoverPadding(rect.height);
  canvas.width = reelsCover ? rect.width : Math.round(rect.height * 4 / 5);
  canvas.height = reelsCover ? outputHeight : rect.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare image canvas.');

  let backgroundImage = null;
  if (paddingMode === 'image' && paddingBackgroundUrl) {
    backgroundImage = await loadImage(paddingBackgroundUrl);
  }

  const drawTile = reelsCover ? drawReelsCoverTile : drawPostCoverTile;
  drawTile(context, image, rect, {
    mode: paddingMode,
    color: paddingColor,
    blurStrength: paddingBlurStrength,
    backgroundImage,
    backgroundOffsetX: paddingBackgroundOffsetX,
    backgroundOffsetY: paddingBackgroundOffsetY
  });
  return canvasToBlob(canvas, mimeType);
}
