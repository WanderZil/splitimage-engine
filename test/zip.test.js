import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipBlob } from '../src/zip.js';

// Read actual local/central records independently of the writer.
async function readArchive(entries) {
  const bytes = new Uint8Array(await (await createZipBlob(entries)).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const files = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extra = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLength + extra;
    files.push({ name: new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength)), flags: view.getUint16(offset + 6, true), crc: view.getUint32(offset + 14, true), data: new TextDecoder().decode(bytes.slice(start, start + size)) });
    offset = start + size;
  }
  for (const file of files) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    assert.equal(view.getUint16(offset + 8, true), file.flags);
    const length = view.getUint16(offset + 28, true);
    assert.equal(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length)), file.name);
    offset += 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  assert.equal(view.getUint32(offset, true), 0x06054b50);
  assert.equal(view.getUint16(offset + 10, true), files.length);
  return files;
}

test('UTF-8 names, duplicate entries and CRC survive ZIP export', async () => {
  const files = await readArchive([
    { fileName: '风景.png', blob: new Blob(['123456789']) },
    { fileName: '风景.png', blob: new Blob(['second']) },
    { fileName: '风景 (2).png', blob: new Blob(['third']) },
  ]);
  assert.deepEqual(files.map(f => f.name), ['风景.png', '风景 (2).png', '风景 (2) (2).png']);
  assert.ok(files.every(f => f.flags & 0x0800));
  assert.equal(files[0].crc, 0xcbf43926); // standard CRC-32 test vector
  assert.deepEqual(files.map(f => f.data), ['123456789', 'second', 'third']);
});

test('ZIP flattens paths and disambiguates case-insensitive file names', async () => {
  const files = await readArchive(['../a.png', 'A.png', 'a.png'].map(fileName => ({ fileName, blob: new Blob(['x']) })));
  assert.deepEqual(files.map(f => f.name), ['.._a.png', 'A.png', 'a (2).png']);
});

test('rejects ZIP64-sized metadata before allocating archive memory', async () => {
  await assert.rejects(createZipBlob(new Array(65536)), /ZIP64/);
  await assert.rejects(createZipBlob([{ fileName: 'large.png', blob: { size: 0x100000000 } }]), /ZIP64/);
});
