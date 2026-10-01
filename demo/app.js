import {
  createZipBlob,
  getInstagramCenterTileIndex,
  getInstagramCarouselAspectRatio,
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
const tools = {
  'instagram-grid': {
    title: 'Instagram Grid Maker', description: 'Split one photo into a connected profile grid. Preview 3:4, 4:5 post, and 9:16 Reels cover exports right in your browser.',
    layouts: profileLayouts, defaultLayout: '3x3', fullName: 'Instagram Grid Maker', fullUrl: 'https://splitimage.io/instagram-grid-maker/'
  },
  general: {
    title: 'Image Splitter', description: 'Split any image into evenly sized tiles. Choose a grid, preview the cuts, and download every piece in one ZIP.',
    layouts: ['2x2', '3x3', '1x2', '2x1', '3x1'], defaultLayout: '2x2', fullName: 'Image Splitter', fullUrl: 'https://splitimage.io/'
  },
  'instagram-carousel': {
    title: 'Instagram Carousel Splitter', description: 'Turn a wide image into 4:5 carousel slides. Preview the sequence and download numbered slides in posting order.',
    layouts: ['1x3', '1x4', '1x5', '1x6', '1x7'], defaultLayout: '1x5', fullName: 'Instagram Carousel Splitter', fullUrl: 'https://splitimage.io/instagram-carousel-splitter/'
  },
  'tiktok-grid': {
    title: 'TikTok Grid Maker', description: 'Make a connected TikTok profile puzzle. Preview the 3:4 profile area and export numbered 9:16 post covers.',
    layouts: profileLayouts, defaultLayout: '3x3', fullName: 'TikTok Banner Splitter', fullUrl: 'https://splitimage.io/tiktok-banner-splitter/'
  }
};

const themeToggle = $('theme-toggle');
const savedTheme = localStorage.getItem('splitimage-demo-theme');
document.documentElement.classList.toggle('dark', savedTheme === 'dark');
themeToggle.setAttribute('aria-pressed', String(savedTheme === 'dark'));
themeToggle.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark');
  themeToggle.setAttribute('aria-pressed', String(dark));
  localStorage.setItem('splitimage-demo-theme', dark ? 'dark' : 'light');
});

function emptyFill(mode) {
  return { mode, color: '#000000', blur: 60, background: null, x: 0, y: 0 };
}

const state = {
  tool: 'instagram-grid',
  source: null,
  urls: [],
  originalUrl: null,
  tiles: [],
  generation: 0,
  outputMode: 'post',
  postAspect: '3:4',
  layout: '3x3',
  carouselSlide: 0,
  format: 'png',
  fill: {
    '4:5': emptyFill('blur'),
    '9:16': emptyFill('color')
  }
};
let renderTimer;

function activeRatio() {
  if (state.tool === 'general' || state.tool === 'instagram-carousel') return null;
  if (state.tool === 'tiktok-grid') return '9:16';
  if (state.outputMode === 'reels') return '9:16';
  return state.postAspect === '4:5' ? '4:5' : '3:4';
}

function activeFill() {
  return state.fill[activeRatio()] || null;
}

function syncToolUI() {
  const tool = tools[state.tool];
  $('tool-select').value = state.tool;
  $('tool-description').textContent = tool.description;
  document.title = `${tool.title} Demo · SplitImage Engine`;
  $('full-tool-link').textContent = tool.fullName;
  $('full-tool-link').href = tool.fullUrl;
  const social = state.tool === 'instagram-grid' || state.tool === 'tiktok-grid';
  const tiktok = state.tool === 'tiktok-grid';
  $('profile-preview').hidden = !social;
  $('profile-preview').classList.toggle('tiktok-phone', tiktok);
  $('plain-preview').hidden = state.tool !== 'general';
  $('carousel-phone').hidden = state.tool !== 'instagram-carousel';
  $('output-mode-setting').hidden = state.tool !== 'instagram-grid';
  $('post-aspect').hidden = state.tool !== 'instagram-grid';
  $('fill-settings').hidden = !social;
  $('crop-zoom').closest('.crop-settings').hidden = state.tool === 'general';
  document.querySelector('.controls').classList.toggle('simple-mode', !social);
  const phoneShell = $('phone-shell');
  phoneShell.src = tiktok ? '../assets/tiktok-profile-preview-390.webp' : '../assets/instagram-phone-460.webp';
  phoneShell.srcset = tiktok
    ? '../assets/tiktok-profile-preview-390.webp 390w, ../assets/tiktok-profile-preview-780.webp 780w'
    : '../assets/instagram-phone-460.webp 460w, ../assets/instagram-phone-840.webp 840w';
  phoneShell.sizes = tiktok ? '(max-width: 700px) 360px, 388px' : '(max-width: 700px) 360px, 420px';
  const choices = $('grid-choices');
  choices.replaceChildren(...tool.layouts.map((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.layout = key;
    button.textContent = key.replace('x', '×');
    button.setAttribute('aria-pressed', String(key === state.layout));
    return button;
  }));
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
  const reels = state.outputMode === 'reels' || state.tool === 'tiktok-grid';
  const fillActive = Boolean(ratio && ratio !== '3:4');

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
  $('preview-note').textContent = state.tool === 'general'
    ? 'Every tile follows the selected grid and keeps its portion of the source image.'
    : state.tool === 'instagram-carousel'
      ? 'Slides are exported left to right as matching 4:5 images.'
      : ratio === '3:4'
        ? 'Each downloaded tile is the same 3:4 image shown on the profile.'
        : ratio === '4:5'
          ? 'Profile grid shows the center 3:4 stitch. Fill preview shows the 4:5 post, with left and right fill.'
          : 'Profile grid shows the center 3:4 stitch. Fill preview shows the 9:16 cover, with top and bottom fill.';
}

function cropFor(dimensions, layout) {
  if (state.tool === 'general') return { left: 0, top: 0, width: 1, height: 1 };
  const targetAspect = state.tool === 'instagram-carousel'
    ? getInstagramCarouselAspectRatio(layout.columns)
    : getInstagramGridAspectRatio(layout.rows, layout.columns);
  const baseCrop = getInstagramDefaultCrop(
    dimensions,
    layout.rows,
    layout.columns,
    targetAspect
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
  const social = state.tool === 'instagram-grid' || state.tool === 'tiktok-grid';
  $('preview-intro').hidden = state.tool !== 'instagram-grid';
  $('tiktok-intro').hidden = state.tool !== 'tiktok-grid';
  $('phone-grid-crop').hidden = true;
  $('plain-empty').hidden = social;
  $('plain-image').hidden = true;
  $('plain-grid').hidden = true;
  $('carousel-upload').hidden = state.tool !== 'instagram-carousel';
  $('carousel-slide-image').hidden = true;
  $('carousel-prev').hidden = true;
  $('carousel-next').hidden = true;
  updateCarouselDots(getSplitLayout(state.layout).columns);
  $('fill-preview').hidden = true;
  $('export-size').textContent = '';
  $('preview-note').textContent = social
    ? 'Choose an image to see it on this profile grid.'
    : 'Choose an image to preview the split.';
  $('download').disabled = true;
  $('status').textContent = 'Choose an image to start.';
}

function showProfileGrid(layout, crop) {
  $('preview-intro').hidden = true;
  $('tiktok-intro').hidden = true;
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

function showPlainPreview(layout, crop, dimensions) {
  const preview = $('plain-preview');
  preview.style.setProperty('--preview-aspect', (dimensions.width * crop.width) / (dimensions.height * crop.height));
  $('plain-empty').hidden = true;
  const image = $('plain-image');
  image.hidden = false;
  if (image.src !== state.originalUrl) image.src = state.originalUrl;
  image.style.width = formatPercent(100 / crop.width);
  image.style.height = formatPercent(100 / crop.height);
  image.style.left = formatPercent(-(crop.left / crop.width) * 100);
  image.style.top = formatPercent(-(crop.top / crop.height) * 100);
  const lines = $('plain-grid');
  lines.hidden = false;
  lines.style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
  lines.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  lines.replaceChildren();
  for (let index = 0; index < layout.rows * layout.columns; index += 1) {
    const cell = document.createElement('span');
    const badge = document.createElement('b');
    badge.textContent = `#${index + 1}`;
    cell.append(badge);
    lines.append(cell);
  }
}

function updateCarouselDots(count) {
  const dots = $('carousel-dots');
  dots.replaceChildren(...Array.from({ length: count }, (_, index) => {
    const dot = document.createElement('span');
    dot.classList.toggle('active', index === state.carouselSlide);
    return dot;
  }));
}

function showCarouselSlide() {
  if (state.tool !== 'instagram-carousel' || !state.tiles.length) return;
  state.carouselSlide = Math.min(state.carouselSlide, state.tiles.length - 1);
  releaseTileUrls();
  const url = URL.createObjectURL(state.tiles[state.carouselSlide].blob);
  state.urls.push(url);
  $('carousel-upload').hidden = true;
  $('carousel-slide-image').hidden = false;
  $('carousel-slide-image').src = url;
  $('carousel-slide-image').alt = `Carousel slide ${state.carouselSlide + 1} of ${state.tiles.length}`;
  $('carousel-prev').hidden = false;
  $('carousel-next').hidden = false;
  $('carousel-prev').disabled = state.carouselSlide === 0;
  $('carousel-next').disabled = state.carouselSlide === state.tiles.length - 1;
  updateCarouselDots(state.tiles.length);
}

function clearExport() {
  releaseTileUrls();
  state.tiles = [];
  $('export-image').removeAttribute('src');
  if (state.tool === 'instagram-carousel') {
    $('carousel-slide-image').removeAttribute('src');
    $('carousel-slide-image').hidden = true;
    $('carousel-upload').hidden = false;
    $('carousel-prev').hidden = true;
    $('carousel-next').hidden = true;
  }
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
    const social = state.tool === 'instagram-grid' || state.tool === 'tiktok-grid';
    if (social) showProfileGrid(layout, crop);
    else if (state.tool === 'general') showPlainPreview(layout, crop, dimensions);

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
        ...(state.tool === 'general' ? {} : { crop }),
        ...(state.tool === 'instagram-carousel' ? { tileAspect: { width: 4, height: 5 } } : {}),
        format: state.format,
        numberFromBottomRight: social,
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
    if (state.tool === 'instagram-carousel') showCarouselSlide();
    else {
      const centerUrl = URL.createObjectURL(center.blob);
      state.urls.push(centerUrl);
      $('export-image').src = centerUrl;
    }
    const exportBitmap = await createImageBitmap(center.blob);
    if (generation !== state.generation) {
      exportBitmap.close();
      return;
    }
    $('export-size').textContent = `Each output tile ${exportBitmap.width}×${exportBitmap.height} px${ratio ? ` · ${ratio}` : ''}`;
    exportBitmap.close();
    $('download').disabled = false;
    $('status').textContent = !social
      ? `Ready — ${tiles.length} tiles. Download the numbered ZIP.`
      : ratio === '3:4'
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
$('grid-choices').addEventListener('click', (event) => {
  const button = event.target.closest('[data-layout]');
  if (!button || !tools[state.tool].layouts.includes(button.dataset.layout)) return;
  state.layout = button.dataset.layout;
  if (state.tool === 'instagram-carousel') state.carouselSlide = 0;
  scheduleRender(true);
});
$('tool-select').addEventListener('change', () => {
  if (!tools[$('tool-select').value]) return;
  state.tool = $('tool-select').value;
  state.layout = tools[state.tool].defaultLayout;
  state.carouselSlide = 0;
  $('crop-zoom').value = '100';
  $('crop-x').value = '0';
  $('crop-y').value = '0';
  syncToolUI();
  scheduleRender(true);
});
$('carousel-upload').addEventListener('click', () => $('source').click());
$('carousel-prev').addEventListener('click', () => {
  state.carouselSlide = Math.max(0, state.carouselSlide - 1);
  showCarouselSlide();
});
$('carousel-next').addEventListener('click', () => {
  state.carouselSlide = Math.min(state.tiles.length - 1, state.carouselSlide + 1);
  showCarouselSlide();
});
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

syncToolUI();
showEmptyPreview();
