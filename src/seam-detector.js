import { loadImage } from './image.js';

// Lightweight, local-only split-seam detection. It intentionally uses column/
// row projections rather than generic line detection: a panel seam changes a
// large share of one column (or row), while text and subjects are usually local.

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function colorDifference(data, first, second) {
  return Math.abs(data[first] - data[second])
    + Math.abs(data[first + 1] - data[second + 1])
    + Math.abs(data[first + 2] - data[second + 2]);
}

export function getSeamScores({ data, width, height }, axis) {
  const length = axis === 'x' ? width : height;
  const crossLength = axis === 'x' ? height : width;
  const scores = new Array(length).fill(0);
  for (let position = 1; position < length; position += 1) {
    let total = 0;
    let supported = 0;
    for (let cross = 0; cross < crossLength; cross += 1) {
      const firstPixel = axis === 'x'
        ? ((cross * width + position - 1) * 4)
        : (((position - 1) * width + cross) * 4);
      const secondPixel = axis === 'x'
        ? ((cross * width + position) * 4)
        : ((position * width + cross) * 4);
      const difference = colorDifference(data, firstPixel, secondPixel);
      total += difference;
      if (difference >= 72) supported += 1;
    }
    const average = total / crossLength;
    const coverage = supported / crossLength;
    // Coverage makes a full-height/width seam outrank a local object edge.
    scores[position] = average * (0.25 + 0.75 * coverage);
  }
  return scores;
}

export function findSeams(scores, count, dimension) {
  if (count <= 1) return { positions: [0, dimension], confidence: [] };
  const baseline = median(scores.filter((score) => score > 0));
  const positions = [0];
  const confidence = [];
  const panelSize = dimension / count;
  const minimumGap = panelSize * 0.45;

  for (let divider = 1; divider < count; divider += 1) {
    const expected = panelSize * divider;
    const searchRadius = panelSize * 0.24;
    const start = Math.max(1, Math.round(expected - searchRadius));
    const end = Math.min(dimension - 1, Math.round(expected + searchRadius));
    let best = Math.round(expected);
    for (let position = start; position <= end; position += 1) {
      if (scores[position] > scores[best]) best = position;
    }
    const previous = positions.at(-1);
    positions.push(Math.max(previous + minimumGap, Math.min(dimension - minimumGap * (count - divider), best)));
    confidence.push(baseline ? scores[best] / baseline : 0);
  }
  positions.push(dimension);
  return { positions: positions.map(Math.round), confidence };
}

export function findProminentSeams(scores, dimension) {
  const baseline = scores.reduce((total, score) => total + score, 0) / Math.max(1, scores.length);
  const minimumGap = Math.max(8, Math.round(dimension * 0.08));
  const threshold = Math.max(24, baseline * 3.5);
  const candidates = scores
    .map((score, position) => ({ position, score }))
    .filter(({ position, score }) => position >= minimumGap && position <= dimension - minimumGap && score >= threshold)
    .sort((left, right) => right.score - left.score);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.every(({ position }) => Math.abs(position - candidate.position) >= minimumGap)) selected.push(candidate);
    if (selected.length >= 9) break;
  }
  return selected.sort((left, right) => left.position - right.position).map(({ position }) => position);
}

export async function detectSplitSeams(imageSource, { rows, columns }) {
  if (![rows, columns].every(value => Number.isInteger(value) && value >= 1 && value <= 20)) throw new RangeError('rows and columns must be integers between 1 and 20.');
  const image = await loadImage(imageSource);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(2, Math.round(sourceWidth * scale));
  const height = Math.max(2, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not prepare image analysis.');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const horizontal = findSeams(getSeamScores(pixels, 'x'), columns, width);
  const vertical = findSeams(getSeamScores(pixels, 'y'), rows, height);
  return {
    x: horizontal.positions.map((position) => position / width),
    y: vertical.positions.map((position) => position / height),
    confidence: { x: horizontal.confidence, y: vertical.confidence }
  };
}
