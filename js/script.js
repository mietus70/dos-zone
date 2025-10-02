let dosInstance = null;
// Przygotuj dźwięk kliknięcia. Jeśli plik 'old-old-computer.mp3' nie istnieje, użyj dostępnego 'old-computer-click.mp3'.
let clickSound = null;
function initClickSound() {
  const preferPath = '/sfx/old-computer-click.mp3';
  const fallbackPath = '/sfx/old-computer-click.mp3';
  // Spróbuj załadować preferowany plik; jeśli wystąpi błąd, ustaw fallback.
  clickSound = new Audio(preferPath);
  clickSound.preload = 'auto';
  clickSound.addEventListener('error', function () {
    // Zamień na fallback
    clickSound = new Audio(fallbackPath);
    clickSound.preload = 'auto';
  });
}

function runDos(zipFile) {
  // Zatrzymaj poprzednią instancję, jeśli istnieje
  if (dosInstance) {
    dosInstance.stop();
    const canvas = document.getElementById("dosbox");
    const ctx = canvas.getContext("2d");
    // Wyczyść canvas przed nowym uruchomieniem
    ctx.fillStyle = "black"; // Ustaw kolor tła na czarny
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Inicjalizacja JS-DOS z wdosbox.js
  // Używamy `wdosboxUrl` do wskazania lokalizacji pliku wdosbox.js
  Dos(document.getElementById("dosbox"), {
    // Ta ścieżka zakłada, że pliki js-dos.js i wdosbox.js są w tym samym folderze co index.html
    // Jeśli umieścisz je w podfolderze (np. 'js-dos'), zmień ścieżkę na np. "./js-dos/wdosbox.js"
    wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js",
  })
    .ready(function (fs, main) {
      // Zapisz instancję do późniejszego zatrzymania
      dosInstance = { stop: main.stop };

      // Pobierz i rozpakuj plik ZIP
      fs.extract(zipFile)
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
          alert("Nie udało się uruchomić programu. Sprawdź konsolę.");
        });
    })
    .catch(function (error) {
      // Obsługa błędów podczas inicjalizacji Dos
      console.error("Błąd inicjalizacji JS-DOS:", error);
      alert(
        "Nie udało się zainicjalizować emulatora. Sprawdź połączenie internetowe lub ścieżkę do wdosbox.js."
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
      // Pokaż kontener (usuń visibility: collapse) i uruchom animację
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
      img.onerror = () => resolve({ ok: false, src });
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
    console.error(
      "Błąd krytyczny: Funkcja 'Dos' nie została załadowana z js-dos.js. Sprawdź ścieżkę i połączenie internetowe."
    );
    alert("Błąd ładowania głównego skryptu JS-DOS. Sprawdź konsolę.");
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