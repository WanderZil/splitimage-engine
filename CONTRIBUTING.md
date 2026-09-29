# Contributing

Keep `src/` focused on reusable image processing. Changes to the standalone `demo/` should illustrate the public engine without copying the full SplitImage.io website, its marketing content or private application code. Do not add analytics, credentials or third-party media without permission and a clear rights note.

Use Node.js 22 or newer. Run `npm ci`, `npm test`, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. The `CHROME_PATH` environment variable can select an existing Chrome executable for local checks.

Fixes to geometry should include pixel-boundary tests. Rendering changes should include a browser test with a generated image. ZIP changes should check archive structure and extraction compatibility. Avoid adding runtime dependencies for UI or application state.

Document API changes in README.md and CHANGELOG.md. Submit only code and test fixtures you have permission to contribute under the MIT license. The repository deploys its browser demo through GitHub Pages; it does not publish packages or deploy the SplitImage.io website.
