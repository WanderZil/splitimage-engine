import {
  createZipBlob,
  getInstagramCenterTileIndex,
  getInstagramDefaultCrop,
  getInstagramGridAspectRatio,
  getInstagramGridTileNumber,
  getSplitLayout,
  getZipFileName,
  nudgeBackgroundOffset,
  splitImageToBlobs
} from '../src/index.js';

const $ = (id) => document.getElementById(id);
const colorSwatches = ['#000000', '#ffffff', '#111827', '#f5f5f4', '#0f172a', '#fafafa'];
const profileLayouts = ['3x3', '2x3', '1x3', '3x2', '3x1'];

function emptyFill(mode) {
  return { mode, color: '#000000', blur: 60, background: null, x: 0, y: 0 };
}

const state = {
  source: null,
  urls: [],
  originalUrl: null,
  tiles: [],
  generation: 0,
  outputMode: 'post',
  postAspect: '3:4',
  layout: '3x3',
  format: 'png',
  fill: {
    '4:5': emptyFill('blur'),
    '9:16': emptyFill('color')
  }
};
let renderTimer;

function activeRatio() {
  if (state.outputMode === 'reels') return '9:16';
  return state.postAspect === '4:5' ? '4:5' : '3:4';
}

function activeFill() {
  return state.fill[activeRatio()] || null;
}

function releaseTileUrls() {
  for (const url of state.urls) URL.revokeObjectURL(url);
  state.urls = [];
}

function formatPercent(value) {
  return `${Math.round(value * 10000) / 10000}%`;
}

function syncControls() {
  const ratio = activeRatio();
  const fill = activeFill();
  const reels = state.outputMode === 'reels';
  const fillActive = ratio !== '3:4';

  for (const button of document.querySelectorAll('[data-output-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.outputMode === state.outputMode));
  }
  $('post-aspect').classList.toggle('is-disabled', reels);
  $('post-aspect').setAttribute('aria-disabled', String(reels));
  for (const button of document.querySelectorAll('[data-post-aspect]')) {
    button.disabled = reels;
    button.setAttribute('aria-pressed', String(button.dataset.postAspect === state.postAspect));
  }
  for (const button of document.querySelectorAll('[data-layout]')) {
    button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout));
  }

  $('fill-settings').classList.toggle('is-disabled', !fillActive);
  $('fill-settings').setAttribute('aria-disabled', String(!fillActive));
  $('fill-label').textContent = reels ? 'Top/bottom fill' : 'Left/right fill';
  $('fill-disabled-hint').hidden = fillActive;
  $('fill-controls').hidden = !fillActive;

  if (fill) {
    for (const button of document.querySelectorAll('[data-fill-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.fillMode === fill.mode));
    }
    $('fill-color').value = fill.color;
    for (const swatch of document.querySelectorAll('[data-fill-color]')) {
      swatch.classList.toggle('active', swatch.dataset.fillColor === fill.color.toLowerCase());
    }
    $('blur-strength').value = String(fill.blur);
    $('blur-value').textContent = `${fill.blur}%`;
    $('color-control').hidden = fill.mode !== 'color';
    $('blur-control').hidden = fill.mode !== 'blur';
    $('background-control').hidden = fill.mode !== 'image';
    $('background-position').hidden = fill.mode !== 'image' || !fill.background;
  }

  $('zoom-value').textContent = `${$('crop-zoom').value}%`;
  $('format').value = state.format;
  $('fill-preview').hidden = !fillActive;
  $('fill-preview-meta').textContent = ratio === '9:16'
    ? 'Center tile · 9:16 export'
    : 'Center tile · 4:5 export';
  $('preview-note').textContent = ratio === '3:4'
    ? 'Each downloaded tile is the same 3:4 image shown on the profile.'
    : ratio === '4:5'
      ? 'Profile grid shows the center 3:4 stitch. Fill preview shows the 4:5 post, with left and right fill.'
      : 'Profile grid shows the center 3:4 stitch. Fill preview shows the 9:16 Reels cover, with top and bottom fill.';
}

function cropFor(dimensions, layout) {
  const baseCrop = getInstagramDefaultCrop(
    dimensions,
    layout.rows,
    layout.columns,
    getInstagramGridAspectRatio(layout.rows, layout.columns)
  );
  const zoom = Number($('crop-zoom').value) / 100;
  const cropWidth = baseCrop.width / zoom;
  const cropHeight = baseCrop.height / zoom;
  return {
    left: ((1 - cropWidth) / 2) * (1 + Number($('crop-x').value) / 100),
    top: ((1 - cropHeight) / 2) * (1 + Number($('crop-y').value) / 100),
    width: cropWidth,
    height: cropHeight
  };
}

function reelsMark() {
  const mark = document.createElement('span');
  mark.className = 'reels-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" focusable="false"><path fill="#fff" fill-rule="evenodd" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM9.8 8.2l5.8 3.8-5.8 3.8V8.2z"/></svg>';
  return mark;
}

function showEmptyPreview() {
  $('preview-intro').hidden = false;
  $('phone-grid-crop').hidden = true;
  $('fill-preview').hidden = true;
  $('export-size').textContent = '';
  $('preview-note').textContent = 'Choose an image to see it on this profile grid.';
  $('download').disabled = true;
  $('status').textContent = 'Choose an image to start.';
}

function showProfileGrid(layout, crop) {
  $('preview-intro').hidden = true;
  const cropWindow = $('phone-grid-crop');
  cropWindow.hidden = false;
  cropWindow.style.width = `${(layout.columns / 3) * 100}%`;
  cropWindow.style.height = `${(layout.rows / 3) * 100}%`;
  const image = $('grid-image');
  if (image.src !== state.originalUrl) image.src = state.originalUrl;
  image.style.width = formatPercent(100 / crop.width);
  image.style.height = formatPercent(100 / crop.height);
  image.style.left = formatPercent(-(crop.left / crop.width) * 100);
  image.style.top = formatPercent(-(crop.top / crop.height) * 100);

  const lines = $('grid-lines');
  lines.style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
  lines.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  lines.replaceChildren();
  const total = layout.rows * layout.columns;
  for (let index = 0; index < total; index += 1) {
    const cell = document.createElement('span');
    if ((index + 1) % layout.columns === 0) cell.classList.add('edge-right');
    if (Math.floor(index / layout.columns) === layout.rows - 1) cell.classList.add('edge-bottom');
    const badge = document.createElement('b');
    badge.textContent = `#${getInstagramGridTileNumber(index + 1, total)}`;
    cell.append(badge);
    if (state.outputMode === 'reels') cell.append(reelsMark());
    lines.append(cell);
  }
}

function clearExport() {
  releaseTileUrls();
  state.tiles = [];
  $('export-image').removeAttribute('src');
  $('download').disabled = true;
}

async function imageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

function showOriginal(file) {
  if (state.originalUrl) URL.revokeObjectURL(state.originalUrl);
  state.originalUrl = URL.createObjectURL(file);
  $('grid-image').src = state.originalUrl;
  $('file-name').textContent = file.name;
}

async function render() {
  const generation = ++state.generation;
  syncControls();
  $('download').disabled = true;
  if (!state.source) {
    showEmptyPreview();
    return;
  }
  $('status').textContent = 'Rendering preview…';
  try {
    const layout = getSplitLayout(state.layout);
    const dimensions = await imageDimensions(state.source);
    if (generation !== state.generation) return;
    const crop = cropFor(dimensions, layout);
    // The profile always shows the 3:4 stitch. Fill is a separate export preview.
    showProfileGrid(layout, crop);

    const ratio = activeRatio();
    const fill = activeFill();
    if (fill?.mode === 'image' && !fill.background) {
      clearExport();
      $('status').textContent = 'Choose a background image to preview this fill mode.';
      return;
    }

    const backgroundUrl = fill?.mode === 'image' && fill.background ? URL.createObjectURL(fill.background) : null;
    let tiles;
    try {
      tiles = await splitImageToBlobs(state.source, {
        layoutKey: layout.key,
        crop,
        format: state.format,
        numberFromBottomRight: true,
        postCover: ratio === '4:5',
        reelsCover: ratio === '9:16',
        paddingMode: fill?.mode || 'color',
        paddingColor: fill?.color || '#000000',
        paddingBlurStrength: fill?.blur ?? 60,
        paddingBackgroundUrl: backgroundUrl,
        paddingBackgroundOffsetX: fill?.x || 0,
        paddingBackgroundOffsetY: fill?.y || 0
      });
    } finally {
      if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    }
    if (generation !== state.generation) return;

    releaseTileUrls();
    state.tiles = tiles;
    const centerIndex = getInstagramCenterTileIndex(layout.rows, layout.columns);
    const center = tiles[centerIndex];
    const centerUrl = URL.createObjectURL(center.blob);
    state.urls.push(centerUrl);
    $('export-image').src = centerUrl;
    const exportBitmap = await createImageBitmap(center.blob);
    if (generation !== state.generation) {
      exportBitmap.close();
      return;
    }
    $('export-size').textContent = `Each output tile ${exportBitmap.width}×${exportBitmap.height} px · ${ratio}`;
    exportBitmap.close();
    $('download').disabled = false;
    $('status').textContent = ratio === '3:4'
      ? `Ready — ${tiles.length} tiles. The ZIP matches this 3:4 profile grid.`
      : `Ready — ${tiles.length} tiles. The ZIP matches the ${ratio} fill preview.`;
  } catch (error) {
    if (generation !== state.generation) return;
    clearExport();
    $('status').textContent = error.message || 'Could not process this image.';
  }
}

function scheduleRender(immediate) {
  clearTimeout(renderTimer);
  if (immediate) {
    render();
    return;
  }
  renderTimer = setTimeout(render, 120);
}

for (const button of document.querySelectorAll('[data-output-mode]')) {
  button.addEventListener('click', () => {
    state.outputMode = button.dataset.outputMode;
    scheduleRender(true);
  });
}
for (const button of document.querySelectorAll('[data-post-aspect]')) {
  button.addEventListener('click', () => {
    if (state.outputMode === 'reels') return;
    state.postAspect = button.dataset.postAspect === '4:5' ? '4:5' : '3:4';
    scheduleRender(true);
  });
}
for (const button of document.querySelectorAll('[data-fill-mode]')) {
  button.addEventListener('click', () => {
    const fill = activeFill();
    if (!fill) return;
    fill.mode = button.dataset.fillMode;
    scheduleRender(true);
  });
}
for (const swatch of document.querySelectorAll('[data-fill-color]')) {
  swatch.addEventListener('click', () => {
    const fill = activeFill();
    if (!fill) return;
    fill.color = swatch.dataset.fillColor;
    scheduleRender(true);
  });
}
for (const button of document.querySelectorAll('[data-layout]')) {
  button.addEventListener('click', () => {
    if (!profileLayouts.includes(button.dataset.layout)) return;
    state.layout = button.dataset.layout;
    scheduleRender(true);
  });
}
for (const button of document.querySelectorAll('[data-nudge-axis]')) {
  button.addEventListener('click', () => {
    const fill = activeFill();
    if (!fill) return;
    const next = nudgeBackgroundOffset(
      { backgroundOffsetX: fill.x, backgroundOffsetY: fill.y },
      button.dataset.nudgeAxis,
      Number(button.dataset.nudgeDir)
    );
    fill.x = next.backgroundOffsetX;
    fill.y = next.backgroundOffsetY;
    scheduleRender(true);
  });
}

$('fill-color').addEventListener('input', () => {
  const fill = activeFill();
  if (!fill) return;
  fill.color = $('fill-color').value;
  scheduleRender(true);
});
$('blur-strength').addEventListener('input', () => {
  const fill = activeFill();
  if (!fill) return;
  fill.blur = Number($('blur-strength').value);
  $('blur-value').textContent = `${fill.blur}%`;
  scheduleRender(false);
});
$('choose-source').addEventListener('click', () => $('source').click());
$('background-choose').addEventListener('click', () => $('background').click());
$('background').addEventListener('change', () => {
  const fill = activeFill();
  if (!fill) return;
  fill.background = $('background').files[0] || null;
  $('background-name').textContent = fill.background ? fill.background.name : '';
  scheduleRender(true);
});
$('background-remove').addEventListener('click', () => {
  const fill = activeFill();
  if (!fill) return;
  fill.background = null;
  $('background').value = '';
  $('background-name').textContent = '';
  scheduleRender(true);
});
$('source').addEventListener('change', () => {
  state.source = $('source').files[0] || null;
  if (state.source) showOriginal(state.source);
  scheduleRender(true);
});
for (const id of ['crop-zoom', 'crop-x', 'crop-y']) {
  $(id).addEventListener('input', () => scheduleRender(false));
}
$('format').addEventListener('change', () => {
  state.format = $('format').value;
  scheduleRender(true);
});
$('download').addEventListener('click', async () => {
  if (!state.tiles.length) return;
  $('download').disabled = true;
  try {
    const blob = await createZipBlob(state.tiles.map(({ fileName, blob: tileBlob }) => ({ fileName, blob: tileBlob })));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getZipFileName(state.source.name);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    $('status').textContent = error.message || 'Could not create ZIP.';
  } finally {
    $('download').disabled = !state.tiles.length;
  }
});

showEmptyPreview();
