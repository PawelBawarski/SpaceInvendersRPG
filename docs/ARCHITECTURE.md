# Architektura

Projekt jest monorepo z dwoma runtimeami:

- `frontend/`: React, TypeScript i Babylon.js dla gry i interfejsu.
- `backend/`: Spring Boot i PostgreSQL; obecnie frontend nie korzysta z serwerowego zapisu profilu.
- Migracje bazy są wersjonowane przez Liquibase w `backend/src/main/resources/db/changelog/`.

## Warstwy frontendu

- `src/game/domain/`: reguły walki, typów obrażeń i odporności, broni i geometrii świata, definicje planet i stacji oraz profile czterech frakcji i klas okrętów. Domena nie importuje React ani Babylon.js.
- `src/game/missions/definitions.ts`: 12 misji ze współrzędnymi w świecie, typami celów, nagrodami, profilami pięciu bossów i generatorami eskort oraz grup orbitalnych.
- `src/game/progress/`: lokalny zapis pilota, ukończone misje i częściowy postęp celów, łupy, wyposażenie, ustawienia oraz zgodność z wcześniejszymi zapisami.
- `src/game/simulation/`: odczyt komend lotu, integracja prędkości i obrotu, niezależna od renderera ścieżka i postęp dokowania oraz całkowanie ekspozycji słonecznej.
- `src/game/input/`: mapowanie klawiatury i myszy na komendy.
- `src/game/renderer/`: sceny Babylon.js, główna pętla lotu, walka, efekty i modele.
- `src/game/ui/`: HUD, ekwipunek i grafiki modułów oraz materiałów.
- `src/App.tsx`: ekrany aplikacji, zapis postępu i połączenie scen świata oraz hangaru.

React uruchamia scenę i aktualizuje HUD. Pętla renderera steruje ruchem, pociskami i wykrywaniem trafień; React nie jest właścicielem pętli fizycznej.

## Wspólna przestrzeń

Nowa gra uruchamia trwałą scenę `SectorCanvas`. Orion-7 zawiera 60 planet i 3000 statków patrolowych. Granice świata wynoszą x ±560000, y ±350000 i z 0–3000000 m. Promienie planet wynoszą 1728–37800 m, kolejne 3× więcej. Słońce ma promień 192000 m. Stacje zachowują swoje współrzędne, a misje i skany uwzględniają powiększone powierzchnie. Dziennik, statystyki i ustawienia wstrzymują tę samą scenę.

`WorldCombat` tworzy przeciwników na podstawie danych świata i misji, obsługuje ich ostrzał, nagrody, osłony i stan spotkania. `SpatialIndex` dzieli przestrzeń na komórki 4 km i wyszukuje lokalnych kandydatów. Pełna symulacja obejmuje do 96 pobliskich aktorów w zasięgu 3,2 km, z priorytetem bossów. Modele powstają dopiero w pobliżu pilota; odległe kopie są wyłączane, a poza zasięgiem pamięci podręcznej usuwane. `worldCombatMath` sprawdza odcinki ruchu pocisków, aby szybkie pociski nie pomijały trafień między klatkami. Prędkość pocisków gracza jest dodawana do prędkości statku. Siatki pocisków wracają do ograniczonej puli, a test granic odrzuca odległe obiekty przed dokładnym przecięciem odcinka ze sferą.

`ShipStatusHud` pokazuje kadłub, osłony i ładowanie uniku. `FlightEffects` obsługuje smugi silników, pole widzenia i efekt przyspieszenia; bez aktywnego napędu ukrywa pasma przyspieszenia. Liczby obrażeń znikają po sekundzie.

`PlanetField` utrzymuje proste, zamrożone modele odległych planet i tworzy proceduralne powierzchnie według odległości od powierzchni, dzięki czemu szczegóły pojawiają się także przy olbrzymach. Budżet szczegółowych planet wynosi 1/2/3 dla low/standard/high. Jedna nowa powierzchnia powstaje na aktualizację strumieniowania, a nie wszystkie 60 podczas startu sceny.

`InputController` mapuje Shift na połowę mocy, Spację na pełną moc, a F/LPM na strzelanie. `gameSettings` migruje starszy zapis z `fire: Space` bez kasowania własnych przypisań. Znaczniki stacji działają niezależnie od śledzonego celu misji.

`getFlightTargetSpeed` wyznacza stałą prędkość z mocy i wyposażenia: bazowo 146,25 m/s dla Shift i 292,5 m/s dla spacji. Bliskość obiektów nie zmienia tego celu. `advanceFlightMotion` całkuje wykładniczą zmianę prędkości i drogę, zachowując tę samą trajektorię dla różnych czasów klatek. Zderzenia nadal sprawdzają cały odcinek ruchu. Panel C korzysta z tego samego wyliczenia limitów.

`enemyIdentity` wylicza stabilny poziom zagrożenia z HP, osłon i obrażeń oraz nazwy jednostek i pięciu bossów. `EnemyNameplates` rzutuje etykiety nad modelami w tempie aktualizacji HUD; odrzuca cele za kamerą, planetą lub poza zasięgiem i ogranicza widoczną listę do 32. Etykiety DOM nie tworzą siatek ani tekstur GPU.

Stacje łączą 47 części w cztery grupy materiałowe i zamrażają macierze świata. Odległe planety współdzielą jedną geometrię. `spaceEffectsProfile` określa słabszą poświatę (0,1/0,18/0,3), jej rozdzielczość (0,125 standard/low, 0,25 high), jądro 8, budżet planet i mniejsze pule smug. Powierzchnie planet są wykluczone z efektu. Lot nie wykonuje automatycznych testów wskazania myszy.

`worldPopulation` deterministycznie rozszerza dotychczasową flotę do 3000 jednostek bez zmiany wcześniejszych identyfikatorów. `patrolFormation` opisuje 530 trójek jednej frakcji: wspólną trasę, prędkość oraz pozycje w szyku V. Pozostałe 1410 statków patroluje niezależnie. Odległe grupy próbkują trasę cztery razy na sekundę; pobliskie aktualizują ją w każdej klatce. `WorldCombat` przekazuje alarm między skrzydłowymi, pozwala rozbić szyk w walce i wrócić na trasę. Rozdzielanie kadłubów i odsunięcie eskort uwzględnia skale modeli 9 dla NPC oraz 18 dla bossów. Starszy zapis wewnątrz powiększonej planety jest przenoszony nad powierzchnię przed uruchomieniem fizyki.

`NavigationJournal` ma własny interfejs CSS/SVG: mapę sektora, bieżący kurs, stacje i sygnały misji. L przełącza dziennik, X zamyka go; ekran nie ma dodatkowej nawigacji do menu lub ustawień. Śledzenie zmienia wyłącznie kurs. Otwarcie z hangaru zachowuje scenę hangaru i nie montuje nowej sceny lotu. L pozostaje zarezerwowane przy migracji własnych przypisań sterowania.

## Słońce, palenie i typy obrażeń

`damageTypes` definiuje `kinetic`, `thermal`, `ion` i `radiation`, profil odporności i limit 85% na typ. `getShipResistances` sumuje tylko odporności z zamontowanych modułów; części zapisane przed tą zmianą mogą nie mieć pola odporności. `ShipResistanceReadout` pokazuje wynik w ekwipunku i warsztacie.

`SolarExposure` jest czystą symulacją: próg liczy od powierzchni słońca (20 km), rozgrzewa statek przez 1,5 s, całkuje surowe obrażenia do 24/s i wygasza palenie przez 2,5 s po opuszczeniu strefy. Całkowanie nie zależy od liczby klatek. `SectorCanvas` stosuje odporność termiczną i przekazuje ciągłe obrażenia z pominięciem i-frame'ów uniku; obecne pociski mają typ kinetyczny. Jonowe bronie i zagrożenia promieniowaniem nie są jeszcze osobną zawartością gry.

`StarHazard` rysuje słońce z koroną i światłem ograniczonym do jego otoczenia. `createShipBurnEffect` przyjmuje natężenie niezależne od źródła obrażeń, dzięki czemu przyszłe ataki termiczne mogą używać tego samego efektu. Cząstki i światło palenia mają ograniczone zasoby i wyłączają się przy zerowym natężeniu.

## Dokowanie i hangar

`StationDocking` buduje stacje, sprawdza zasięg dokowania i prowadzi statek oraz kamerę po ścieżce z `StationApproach`. Po rozpoczęciu podejścia `App` montuje ukrytą scenę `GarageCanvas`, która przygotowuje hangar w tle. Postęp podejścia czeka przed końcem śluzy, jeśli hangar nie zgłosił gotowości.

Podejście trwa 9,2 s, a lądowanie 4,4 s. Start w hangarze trwa 2,1 s, przelot wylotowy 2,2 s. Wymóg gotowości następnej sceny nadal może wstrzymać animację przed przekazaniem obrazu i sterowania.

`HangarLanding` dzieli lądowanie na podejście, rozłożenie podwozia i osiadanie. `LandingGear` animuje trzy składane nogi, tłoki i stopy; wysokość końcowa statku wynika z geometrii podwozia oraz wysokości płyty. Nogi są w pełni rozłożone przed opadaniem i chowają się po uniesieniu przy starcie. Komunikat odpowiada bieżącemu etapowi. Zmiana wyposażenia w hangarze zachowuje rozłożone podwozie.

Po dotknięciu płyty tłumione ugięcie amortyzatorów obniża kadłub i daje niewielkie odbicie przed ustabilizowaniem. Skok tłoków kompensuje ruch kadłuba, więc stopy pozostają w tym samym miejscu na płycie. Stan postojowy zachowuje ugięcie pod ciężarem statku; przy starcie amortyzatory odciążają się przed schowaniem nóg. Cała sekwencja mieści się w czasie lądowania 4,4 s.

Po przejściu śluzy aplikacja pokazuje tę samą, już przygotowaną scenę hangaru. `GarageCanvas` animuje przylot na płytę i zgłasza zakończenie lądowania; dopiero wtedy dostępny jest warsztat. Start podnosi statek, obraca go o 180° i prowadzi dziobem do wyjścia. Świat przygotowuje się podczas tej animacji; po gotowości kamery przechodzą przez wygaszenie obrazu do dalszego przelotu śluzą. Autopilot oddaje sterowanie 140 m przed punktem podejścia, z dziobem skierowanym od stacji. Obie sceny używają osi +Z modelu jako kierunku dziobu.

## Wyposażenie i zapis

`shipParts.ts` definiuje sloty, rzadkości, statystyki oraz wspólne kolory modułów. `EquipmentArtwork` rysuje grafiki SVG części i materiałów dla ekwipunku oraz warsztatu. `shipVisual` używa tych samych kolorów rzadkości i stopni szczegółowości na modelu statku. Zmiana wyposażenia w świecie przebudowuje wygląd statku bez restartowania sceny walki.

`missionProgress` zapisuje dane w localStorage i przyznaje nagrody misji idempotentnie. Odczytuje również starsze liczniki sześciu pierwszych misji. API Spring Boot udostępnia endpoint health; autorytatywny zapis i synchronizacja profilu wymagają osobnego API.

## Statystyki, serwis i informacja o trafieniach

`shipStatistics` korzysta z tych samych bonusów i parametrów broni co lot. Panel C wstrzymuje świat i tworzy osobny, ograniczony podgląd `ShipPreviewCanvas` z bieżącym wyposażeniem. Zamknięcie usuwa silnik podglądu.

`shipMaintenance` przechowuje bieżące HP i osłony, regeneruje bezpłatnie kadłub i rozlicza płatne ładowanie osłon. `MissionProgress.shipVitals` jest opcjonalne dla starszych zapisów. Migawka trafia do zapisu podczas lotu, dokowania i opuszczania sceny. Zmiana pojemności nie daje darmowego ładowania.

`WorldCombat` przekazuje miejsce wystrzelenia i nazwę źródła trafienia. Czyste `getDamageBearing` przelicza kierunek względem kamery, a `DamageDirectionIndicator` rysuje krótkotrwały łuk i etykietę. Zderzenia i żar korzystają z tego samego interfejsu.

`GameAudio` utrzymuje dwa ciche oscylatory silnika. Profil `engineSound` rozróżnia postój, lot bez ciągu i przyspieszanie; głośność oraz barwa płynnie reagują na prędkość i ciąg. Główna głośność obejmuje silnik. Otwieranie interfejsu zawiesza sterowanie lotem i wycisza napęd.

`useApplicationAudio` utrzymuje osobny, trwały `GameAudio` bez silnika dla całej aplikacji. `ambience` określa akordy i filtr dla menu, lotu, dziennika oraz hangaru. Ciche sinusoidy, łagodne obwiednie i ograniczony delay tworzą tło bez plików muzycznych. Ten sam graf odtwarza delikatne dźwięki przycisków i dokowania. `SectorCanvas` wyłącza własny ambient, zachowując silnik i broń, co zapobiega nakładaniu ścieżek. Pierwszy gest odblokowuje Web Audio, suwaki sterują muzyką i głośnością główną, a usunięcie komponentu zatrzymuje oscylatory i timer.
