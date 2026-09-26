const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function getCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function header(size, write) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  write(view);
  return bytes;
}

function concatBytes(parts) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const archive = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    archive.set(part, offset);
    offset += part.length;
  });
  return archive;
}

// Dependency-free ZIP writer (store method). Keeps the engine usable offline.
export async function createZipBlob(entries) {
  if (entries.length > 65535) throw new RangeError('ZIP64 is not supported: too many entries.');
  const encoder = new TextEncoder();
  const usedNames = new Set();
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const entry of entries) {
    const baseName = String(entry.fileName).replace(/[\\/\x00-\x1f]/g, '_');
    if (!baseName || baseName === '.' || baseName === '..') throw new TypeError('ZIP entry needs a file name.');
    let uniqueName = baseName;
    let suffix = 2;
    const dot = baseName.lastIndexOf('.');
    const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
    const extension = dot > 0 ? baseName.slice(dot) : '';
    while (usedNames.has(uniqueName.toLowerCase())) uniqueName = `${stem} (${suffix++})${extension}`;
    usedNames.add(uniqueName.toLowerCase());
    const name = encoder.encode(uniqueName);
    if (name.length > 65535) throw new RangeError('ZIP filename is too long.');
    if (entry.blob.size > 0xffffffff || offset + 30 + name.length + entry.blob.size > 0xffffffff) throw new RangeError('ZIP64 is not supported: archive too large.');
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = getCrc32(data);
    const local = header(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 33, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      view.setUint16(28, 0, true);
    });
    const central = header(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 33, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true);
      view.setUint16(28, name.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, offset, true);
    });
    localRecords.push(local, name, data);
    centralRecords.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralSize = centralRecords.reduce((sum, part) => sum + part.length, 0);
  if (offset + centralSize + 22 > 0xffffffff) throw new RangeError('ZIP64 is not supported: archive too large.');
  const centralDirectory = concatBytes(centralRecords);
  const end = header(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralDirectory.length, true);
    view.setUint32(16, offset, true);
    view.setUint16(20, 0, true);
  });

  return new Blob([...localRecords, centralDirectory, end], { type: 'application/zip' });
}
