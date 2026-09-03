// Czyści katalog dist/ przed budowaniem (parcel nie czyści go sam).
// Bez zależności — czysty Node.js (działa na Windows/macOS/Linux).
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });
console.log('dist/ wyczyszczony.');
