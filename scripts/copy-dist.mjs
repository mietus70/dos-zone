/**
 * Kopiuje do dist/ pliki, których strona pobiera w trakcie pracy (XHR/fetch),
 * a których parcel nie widzi w grafie bundle (nie są importowane statycznie):
 *   - js/wdosbox.js, js/wdosbox.wasm.js  (silnik JS-DOS)
 *   - exe/*.zip                          (gry uruchamiane przez fs.extract)
 *   - sfx/*                              (dźwięki)
 *   - img/*                              (obrazki wczytywane z data-images w tooltipie)
 * Bez tych plików zbudowany dist/ nie działa.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

// katalogi kopiowane w całości
for (const dir of ['exe', 'sfx', 'img']) {
  const src = join(root, dir);
  if (existsSync(src)) {
    cpSync(src, join(dist, dir), { recursive: true });
    console.log('dist/' + dir + '/ — skopiowane.');
  }
}

// pojedyncze pliki silnika
mkdirSync(join(dist, 'js'), { recursive: true });
for (const file of ['js/wdosbox.js', 'js/wdosbox.wasm.js']) {
  const src = join(root, file);
  if (existsSync(src)) {
    cpSync(src, join(dist, file));
    console.log('dist/' + file + ' — skopiowane.');
  } else {
    console.error('BRAK PLIKU: ' + file + ' — strona nie zainicjuje emulatora!');
    process.exitCode = 1;
  }
}
