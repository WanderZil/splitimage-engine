# Changelog

## 0.1.0 — Initial release candidate

- Extract reusable grid geometry, crop calculations, seam detection, Canvas export and cover padding from the website.
- Keep product UI, marketing content, preview assets and server infrastructure outside the library.
- Accept local File/Blob inputs and return image/ZIP Blobs without download UI.
- Respect the final boundary of partial crops.
- Mark ZIP filenames as UTF-8, resolve duplicate names, and reject unsupported ZIP64 sizes.
- Add geometry, padding, archive and real-browser rendering tests.
- Define explicit package contents and MIT license scope.
