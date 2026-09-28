// Writes MANUAL_TH.md (GitHub copy of the in-app Thai manual) from public/lib/manual-th.js.
// Run after editing the manual:  node scripts/build-manual.mjs
import { writeFileSync } from 'node:fs';
import { manualMarkdown } from '../public/lib/manual-th.js';

writeFileSync(new URL('../MANUAL_TH.md', import.meta.url), `${manualMarkdown()}\n`);
console.log('MANUAL_TH.md written');
