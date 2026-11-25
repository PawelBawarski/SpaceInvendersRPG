# Stałe zasady projektu Neon Void

- Zero AI slop: każda funkcja musi mieć sensowny wpływ na rozgrywkę i świat.
- Zero spaghetti code: zachowuj separację domeny, symulacji, renderowania, wejścia i aplikacji.
- Domena gry nie importuje React ani Babylon.js.
- React nie steruje główną pętlą gry.
- Nie zastępuj testów kodem dodającym tylko wygląd.
- Nie raportuj gotowych funkcji bez uruchomionych testów i buildów.
- Istotne decyzje produktowe i zmiany architektury wymagają aprobaty użytkownika.
- Istniejące dane i zmiany użytkownika chronimy; nie wykonujemy destrukcyjnych operacji Git.
