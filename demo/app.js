import {
  createZipBlob,
  getInstagramDefaultCrop,
  getInstagramGridAspectRatio,
  getSplitLayout,
  getZipFileName,
  splitImageToBlobs
} from '../src/index.js';

const $ = (id) => document.getElementById(id);
const controls = ['source', 'layout', 'crop-zoom', 'crop-x', 'crop-y', 'output-ratio', 'fill-mode', 'fill-color', 'blur-strength', 'background', 'background-x', 'background-y', 'format'];
const state = {
  source: null, urls: [], originalUrl: null, tiles: [], generation: 0, view: 'profile', activeRatio: '3:4',
  fill: {
    '4:5': { mode: 'blur', color: '#000000', blur: 60, background: null, x: 0, y: 0 },
    '9:16': { mode: 'color', color: '#000000', blur: 60, background: null, x: 0, y: 0 }
  }
};
let renderTimer;

function releaseTileUrls() {
  for (const url of state.urls) URL.revokeObjectURL(url);
  state.urls = [];
}

function setView(view) {
  state.view = view;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  $('profile-preview').hidden = view !== 'profile';
  $('export-preview').hidden = view !== 'export';
  $('original-preview').hidden = view !== 'original';
}

function syncFillControls() {
  const ratio = $('output-ratio').value;
  const mode = $('fill-mode').value;
  $('fill-settings').disabled = ratio === '3:4';
  $('color-control').hidden = mode !== 'color';
  $('blur-control').hidden = mode !== 'blur';
  $('background-control').hidden = mode !== 'image';
  $('background-position').hidden = mode !== 'image';
  $('blur-value').textContent = `${$('blur-strength').value}%`;
  $('zoom-value').textContent = `${$('crop-zoom').value}%`;
  $('preview-note').textContent = ratio === '3:4'
    ? 'Each downloaded tile is the same 3:4 image shown on the profile.'
    : `The profile shows the central 3:4 crop of each ${ratio} download. The fill appears when a post is opened.`;
}

function saveFill(ratio) {
  if (!state.fill[ratio]) return;
  state.fill[ratio].mode = $('fill-mode').value;
  state.fill[ratio].color = $('fill-color').value;
  state.fill[ratio].blur = Number($('blur-strength').value);
  state.fill[ratio].x = Number($('background-x').value) / 100;
  state.fill[ratio].y = Number($('background-y').value) / 100;
}

function loadFill(ratio) {
  const fill = state.fill[ratio];
  if (!fill) return;
  $('fill-mode').value = fill.mode;
  $('fill-color').value = fill.color;
  $('blur-strength').value = fill.blur;
  $('background-x').value = Math.round(fill.x * 100);
  $('background-y').value = Math.round(fill.y * 100);
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
  $('original-image').src = state.originalUrl;
  $('file-name').textContent = file.name;
}

async function render() {
  syncFillControls();
  const generation = ++state.generation;
  $('download').disabled = true;
  $('status').textContent = 'Rendering preview…';
  if (!state.source) return;
  try {
    const layout = getSplitLayout($('layout').value);
    const dimensions = await imageDimensions(state.source);
    const baseCrop = getInstagramDefaultCrop(dimensions, layout.rows, layout.columns,
      getInstagramGridAspectRatio(layout.rows, layout.columns));
    const zoom = Number($('crop-zoom').value) / 100;
    const cropWidth = baseCrop.width / zoom;
    const cropHeight = baseCrop.height / zoom;
    const crop = {
      left: ((1 - cropWidth) / 2) * (1 + Number($('crop-x').value) / 100),
      top: ((1 - cropHeight) / 2) * (1 + Number($('crop-y').value) / 100),
      width: cropWidth, height: cropHeight
    };
    const ratio = $('output-ratio').value;
    const fillMode = $('fill-mode').value;
    const background = state.fill[ratio]?.background;
    if (fillMode === 'image' && ratio !== '3:4' && !background) {
      releaseTileUrls(); state.tiles = []; $('profile-preview').replaceChildren();
      $('status').textContent = 'Choose a background image to preview this fill mode.';
      return;
    }
    const backgroundUrl = background ? URL.createObjectURL(background) : null;
    let tiles;
    try {
      tiles = await splitImageToBlobs(state.source, {
        layoutKey: layout.key, crop, format: $('format').value,
        numberFromBottomRight: true,
        postCover: ratio === '4:5', reelsCover: ratio === '9:16',
        paddingMode: fillMode, paddingColor: $('fill-color').value,
        paddingBlurStrength: Number($('blur-strength').value),
        paddingBackgroundUrl: backgroundUrl,
        paddingBackgroundOffsetX: state.fill[ratio]?.x || 0,
        paddingBackgroundOffsetY: state.fill[ratio]?.y || 0
      });
    } finally {
      if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    }
    if (generation !== state.generation) return;
    releaseTileUrls();
    state.tiles = tiles;
    $('profile-preview').style.setProperty('--cols', layout.columns);
    const fragment = document.createDocumentFragment();
    for (const entry of tiles) {
      const url = URL.createObjectURL(entry.blob);
      state.urls.push(url);
      const figure = document.createElement('figure');
      const image = document.createElement('img'); image.src = url; image.alt = `Tile ${entry.index}`;
      const label = document.createElement('figcaption'); label.textContent = entry.index;
      figure.append(image, label); fragment.append(figure);
    }
    $('profile-preview').replaceChildren(fragment);
    const middle = tiles[Math.floor(tiles.length / 2)];
    $('export-image').src = state.urls[Math.floor(tiles.length / 2)];
    const exportBitmap = await createImageBitmap(middle.blob);
    $('export-size').textContent = `${exportBitmap.width} × ${exportBitmap.height} px · ${ratio} · ${middle.fileName}`;
    exportBitmap.close();
    $('download').disabled = false;
    $('status').textContent = `Ready — ${tiles.length} tiles. Preview and ZIP use the same rendered images.`;
  } catch (error) {
    if (generation !== state.generation) return;
    state.tiles = []; releaseTileUrls(); $('profile-preview').replaceChildren();
    $('status').textContent = error.message || 'Could not process this image.';
  }
}

for (const id of controls) {
  const isSlider = ['blur-strength', 'crop-zoom', 'crop-x', 'crop-y', 'background-x', 'background-y'].includes(id);
  $(id).addEventListener(isSlider ? 'input' : 'change', async () => {
    if (id === 'source') { state.source = $('source').files[0] || null; if (state.source) showOriginal(state.source); }
    if (id === 'output-ratio') { saveFill(state.activeRatio); state.activeRatio = $('output-ratio').value; loadFill(state.activeRatio); }
    if (id === 'background' && state.fill[state.activeRatio]) state.fill[state.activeRatio].background = $('background').files[0] || null;
    if (['fill-mode', 'fill-color', 'blur-strength', 'background-x', 'background-y'].includes(id)) saveFill(state.activeRatio);
    if (isSlider) {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(render, 120);
    } else {
      clearTimeout(renderTimer);
      await render();
    }
  });
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => setView(button.dataset.view));
$('download').addEventListener('click', async () => {
  if (!state.tiles.length) return;
  $('download').disabled = true;
  try {
    const blob = await createZipBlob(state.tiles.map(({ fileName, blob }) => ({ fileName, blob })));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = getZipFileName(state.source.name);
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    $('status').textContent = error.message || 'Could not create ZIP.';
  } finally { $('download').disabled = !state.tiles.length; }
});

try {
  const response = await fetch('../assets/demo-original.webp');
  if (!response.ok) throw new Error('Sample image unavailable.');
  state.source = new File([await response.blob()], 'demo-original.webp', { type: 'image/webp' });
  showOriginal(state.source);
  await render();
} catch (error) { $('status').textContent = `${error.message} Choose an image to start.`; }
