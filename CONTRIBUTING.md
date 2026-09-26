# Contributing

Keep this project focused on reusable image processing. Do not add the SplitImage.io UI, styles, translations, product screenshots, phone-shell artwork, analytics, deployment configuration or credentials.

Use Node.js 22 or newer. Run `npm ci`, `npm test`, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. The `CHROME_PATH` environment variable can select an existing Chrome executable for local checks.

Fixes to geometry should include pixel-boundary tests. Rendering changes should include a browser test with a generated image. ZIP changes should check archive structure and extraction compatibility. Avoid adding runtime dependencies for UI or application state.

Document API changes in README.md and CHANGELOG.md. Submit only code and test fixtures you have permission to contribute under the MIT license. The public library has no release automation that publishes packages or deploys the website.
