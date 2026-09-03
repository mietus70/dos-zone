let dosInstance = null;
// Przygotuj dźwięk kliknięcia. Ścieżka względna względem strony — działa też przy hostingu w podkatalogu.
let clickSound = null;
function initClickSound() {
  const sfxFile = 'sfx/old-computer-click.mp3';
  clickSound = new Audio(sfxFile);
  clickSound.preload = 'auto';
  // Rezerwa: jeśli serwer nie poda pliku (np. HTTP 500), doładuj z GitHuba
  clickSound.addEventListener('error', function () {
    if (clickSound.src.indexOf(GITHUB_FALLBACK) !== 0) {
      clickSound.src = GITHUB_FALLBACK + sfxFile;
    }
  });
}

// Ścieżki silnika: lokalna (pierwszy wybór) i rezerwowy CDN z przypiętą wersją
// ENGINE_VERSION = cache-buster: po zmianie plików silnika podnieś numer,
// żeby przeglądarka nie wracała do starego, zbuforowanego pliku
// (np. z okresu, gdy serwer zwracał dla tego adresu stronę HTML).
const ENGINE_VERSION = "v1";
const ENGINE_LOCAL_JS = "js/wdosbox.js?" + ENGINE_VERSION;
const ENGINE_LOCAL_WASM = "js/wdosbox.wasm.js?" + ENGINE_VERSION;
const ENGINE_CDN_BASE = "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/";
// Rezerwowe źródło plików gry (zip, sfx, obrazy): repo na GitHubie (gałąź main).
// Wszystkie te pliki istnieją tam od pierwszego commitu — jeśli hosting
// nie podaje danego pliku (np. zwraca 500), ładowany jest z GitHuba.
const GITHUB_FALLBACK = "https://raw.githubusercontent.com/mietus70/dos-zone/main/";

// Tani test dostępności pliku (HEAD; serwer zwracający 405 dostaje GET z Range).
// Ważne: rozpoznajemy "soft 404" — serwery (np. parcel) zwracają status 200
// z HTML (index.html) dla brakujących plików; dla WebAssembly to śmiertelne.
async function probeFile(url) {
  try {
    let r = await fetch(url, { method: "HEAD" });
    if (r.status === 405) {
      const g = await fetch(url, { headers: { Range: "bytes=0-3" } });
      try { if (g.body) await g.body.cancel(); } catch (e) { /* ignore */ }
      r = g;
    }
    const ct = (r.headers.get("Content-Type") || "").toLowerCase();
    return { ok: r.ok && !ct.startsWith("text/html"), status: r.status, ct: ct };
  } catch (e) {
    return { ok: false, status: "błąd sieci", ct: "" };
  }
}

// Lista plików potrzebnych do działania strony (do diagnostyki przy błędzie)
const REQUIRED_FILES = ["js/wdosbox.js", "js/wdosbox.wasm.js", "exe/ami.zip", "exe/pong.zip", "sfx/old-computer-click.mp3"];

async function diagnosticReport() {
  let lines = "Stan plików na serwerze:\n";
  for (const f of REQUIRED_FILES) {
    const p = await probeFile(f);
    lines += "  " + f + ": " + (p.ok ? "OK" : "BRAK (HTTP " + p.status + (p.ct ? ", " + p.ct : "") + ")") + "\n";
  }
  return lines;
}

async function runDos(zipFile) {
  // Zatrzymaj poprzednią instancję, jeśli istnieje
  if (dosInstance) {
    dosInstance.stop();
    const canvas = document.getElementById("dosbox");
    const ctx = canvas.getContext("2d");
    // Wyczyść canvas przed nowym uruchomieniem
    ctx.fillStyle = "black"; // Ustaw kolor tła na czarny
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Sprawdź, czy serwer faktycznie podaje binarny plik silnika; jeśli nie —
  // automatycznie użyj rezerwowego CDN (js-dos 6.22.60 z jsDelivr).
  const probe = await probeFile(ENGINE_LOCAL_WASM);
  const useCdn = !probe.ok;
  if (useCdn) {
    console.warn("Silnik JS-DOS nie jest dostępny na serwerze (HTTP " + probe.status +
      (probe.ct ? ", " + probe.ct : "") + ") — używam rezerwowego CDN " + ENGINE_CDN_BASE);
  }
  const wdosboxUrl = useCdn ? ENGINE_CDN_BASE + "wdosbox.js" : ENGINE_LOCAL_JS;

  // Inicjalizacja JS-DOS z wdosbox.js
  // Używamy `wdosboxUrl` do wskazania lokalizacji pliku wdosbox.js
  Dos(document.getElementById("dosbox"), {
    // Silnik JS-DOS 6.22.60: lokalny (js/wdosbox.js + js/wdosbox.wasm.js) lub
    // rezerwowy CDN (jsDelivr, ta sama przypięta wersja). npm run build kopiuje
    // pliki silnika do dist/ (scripts/copy-dist.mjs).
    wdosboxUrl: wdosboxUrl,
  })
    .ready(function (fs, main) {
      // Zapisz instancję do późniejszego zatrzymania
      dosInstance = { stop: main.stop };

      // Pobierz i rozpakuj plik ZIP
      fs.extract(zipFile)
        .catch(function (error) {
          // Serwer nie podał pliku gry (np. HTTP 500/404) — spróbuj rezerwowego GitHuba
          console.warn("Nie udało się pobrać " + zipFile + " z serwera (" + error + ") — ładowanie z GitHuba");
          return fs.extract(GITHUB_FALLBACK + zipFile);
        })
        .then(function () {
          // Uruchom główny program z pliku ZIP (często autoexec.bat lub nazwa gry)
          // Możesz potrzebować dostosować ten parametr w zależności od zawartości ZIPa
          main(["-c", "autoexec.bat"]); // Często wystarcza, ale może wymagać np. "quake.exe"
        })
        .catch(function (error) {
          console.error(
            "Błąd podczas wyodrębniania lub uruchamiania pliku ZIP:",
            error
          );
          alert(
            "Nie udało się uruchomić programu.\n\n" +
            "Plik " + zipFile + " nie jest dostępny ani na serwerze, ani na GitHubie.\n" +
            "Szczegóły: " + error
          );
        });
    })
    .catch(async function (error) {
      // Obsługa błędów podczas inicjalizacji Dos — zbierz diagnostykę plików
      console.error("Błąd inicjalizacji JS-DOS:", error);
      const report = await diagnosticReport();
      alert(
        "Nie udało się zainicjalizować emulatora.\n\n" +
        report + "\n" +
        (useCdn
          ? "Silnik był pobierany z rezerwowego CDN — problem leży w plikach gry (exe/*.zip) na serwerze."
          : "Wgraj na serwer pełną zawartość katalogu dist/ (po npm run build): " +
            "js/wdosbox.js, js/wdosbox.wasm.js oraz exe/*.zip. " +
            "Błąd magic word/WebAssembly oznacza, że serwer zwraca HTML zamiast binarki.")
      );
    });
}

// Funkcja do inicjalizacji przycisków
function initializeButtons() {
  const buttons = document.querySelectorAll("button[data-zip]");
  buttons.forEach((button) => {
    button.addEventListener("click", function () {
      // Odtwórz dźwięk kliknięcia
      try {
        if (clickSound) {
          clickSound.currentTime = 0;
          clickSound.play().catch(() => {});
        }
      } catch (e) {
        // ignoruj błędy odtwarzania (np. autostart zablokowany)
      }
      const zipFile = this.getAttribute("data-zip")
      const emulatorContainer = document.getElementById("emulator-container");
      const monitor = document.querySelector(".monitor-effect");
      const canvas = document.getElementById("dosbox");
      document.getElementById("button-container").style.display = "none";
      document.getElementById("controls-container").style.display = "inline-flex";
      // Pokaż kontener (ustaw visibility: visible) i uruchom animację
      emulatorContainer.style.visibility = "visible";
      // Small timeout to allow CSS transition to animate
      setTimeout(() => {
        monitor.classList.add("active");
        // Ensure canvas is displayed (CSS transition will animate opacity/transform)
        canvas.style.display = "block";
        // Daj krótkie opóźnienie aby animacja rozpoczęła się przed ładowaniem gry
        setTimeout(() => runDos(zipFile), 120);
      }, 15);
    });
  });

  // Tooltip podglądu obrazków
  const tooltip = document.getElementById('tooltip-preview');
  const imagesWrapper = tooltip ? tooltip.querySelector('.images') : null;
  if (!tooltip || !imagesWrapper) return;

  const preloadCache = new Map();

  function getCandidateImagesForButton(btn) {
    // 1) preferowane: atrybut data-images="img1.jpg,img2.png"
    const explicit = (btn.getAttribute('data-images') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (explicit.length) return explicit.map(name => name.startsWith('img/') ? name : `img/${name}`);

    // 2) fallback: nazwa z tekstu przycisku, różne rozszerzenia i sufiksy numerów
    const label = (btn.textContent || '').trim().toLowerCase();
    if (!label) return [];
    const bases = [label, label.replace(/\s+/g, '-')];
    const exts = ['jpeg','jpg','png','webp'];
    const candidates = [];
    for (const base of bases) {
      for (const ext of exts) {
        candidates.push(`img/${base}1.${ext}`);
        candidates.push(`img/${base}2.${ext}`);
        // również pojedynczy bez numeru jako rezerwa
        candidates.push(`img/${base}.${ext}`);
      }
    }
    // deduplikacja zachowując kolejność
    return Array.from(new Set(candidates));
  }

  function preload(src) {
    if (preloadCache.has(src)) return preloadCache.get(src);
    const p = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, src });
      img.onerror = () => {
        // Rezerwa: serwer nie podał obrazka — spróbuj GitHuba (onload/onerror wywoła się ponownie)
        if (img.src.indexOf(GITHUB_FALLBACK) !== 0) {
          img.src = GITHUB_FALLBACK + src;
        } else {
          resolve({ ok: false, src });
        }
      };
      img.src = src;
    });
    preloadCache.set(src, p);
    return p;
  }

  function showTooltipForButton(btn, x, y) {
    const candidates = getCandidateImagesForButton(btn);
    if (!candidates.length) return;
    imagesWrapper.innerHTML = '';

    // Załaduj max 2 działające obrazy (dla lekkości)
    let shown = 0;
    const promises = candidates.map(preload);
    Promise.all(promises).then(results => {
      for (const r of results) {
        if (r.ok && shown < 2) {
          const img = document.createElement('img');
          img.src = r.src;
          imagesWrapper.appendChild(img);
          shown++;
        }
      }
      if (shown > 0) {
        positionTooltip(x, y);
        tooltip.style.display = 'block';
      }
    });
  }

  function positionTooltip(mouseX, mouseY) {
    const offset = 16;
    const { innerWidth, innerHeight } = window;
    tooltip.style.display = 'block';
    const rect = tooltip.getBoundingClientRect();
    let left = mouseX + offset;
    let top = mouseY + offset;
    if (left + rect.width > innerWidth) left = mouseX - rect.width - offset;
    if (top + rect.height > innerHeight) top = mouseY - rect.height - offset;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
    imagesWrapper.innerHTML = '';
  }

  document.querySelectorAll('#button-container button[data-zip]').forEach(btn => {
    let hoverTimeout = null;
    btn.addEventListener('mouseenter', (e) => {
      const { clientX, clientY } = e;
      // małe opóźnienie aby nie migotało przy szybkim przejeździe
      hoverTimeout = setTimeout(() => showTooltipForButton(btn, clientX, clientY), 120);
    });
    btn.addEventListener('mousemove', (e) => {
      if (tooltip.style.display === 'block') positionTooltip(e.clientX, e.clientY);
    });
    btn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      hideTooltip();
    });
  });
}

// Poczekaj na załadowanie DOM i dostępność funkcji Dos
document.addEventListener("DOMContentLoaded", function () {
  // Tutaj sprawdzamy, czy funkcja Dos jest już dostępna (po załadowaniu js-dos.js)
  if (typeof Dos === "undefined") {
    // Rezerwa: załaduj loader z przypiętego CDN (ta sama wersja 6.22.60),
    // żeby strona działała nawet, gdyby js/js-dos.js nie dotarło na serwer.
    console.warn("Dos niedostępne — ładuję js-dos.js z rezerwowego CDN");
    const s = document.createElement("script");
    s.src = ENGINE_CDN_BASE + "js-dos.js";
    s.onload = function () {
      if (typeof Dos !== "undefined") {
        initializeButtons();
      } else {
        alert("Błąd ładowania głównego skryptu JS-DOS (lokalnego i z CDN). Sprawdź konsolę.");
      }
    };
    s.onerror = function () {
      alert("Błąd ładowania głównego skryptu JS-DOS. Sprawdź konsolę i połączenie internetowe.");
    };
    document.head.appendChild(s);
    return;
  }
  // Jeśli Dos jest dostępny, inicjalizujemy przyciski
  initializeButtons();
});

document.getElementById("power-btn").addEventListener("click", function() {
     try {
       if (clickSound) {
         clickSound.currentTime = 0;
         clickSound.play().catch(() => {});
       }
     } catch (e) {}
     setTimeout(() => {
     window.location.reload();
   }, 200);
});

// Inicjalizacja dźwięku po załadowaniu DOM
document.addEventListener('DOMContentLoaded', function() {
  initClickSound();
});