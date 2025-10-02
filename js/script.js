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