# Neon Void

Gra kosmiczna **Neon Void**, osadzona w uniwersum „Czarny Meridian”. Frontend korzysta z React, TypeScript i Babylon.js, a backend z Java i Spring Boot.

## Zawartość repozytorium

- `frontend/` — gra, interfejs i testy jednostkowe oraz przeglądarkowe.
- `backend/` — API Spring Boot, Maven Wrapper i migracje Liquibase.
- `docs/` — dokumentacja świata, rozgrywki i architektury.
- `scripts/` — wspólne skrypty uruchamiania.
- `.github/workflows/ci.yml` — automatyczne testy, lint i build po wysłaniu zmian na GitHub.

## Wymagania

- Git.
- Node.js 24+ i npm. Plik `.nvmrc` wskazuje wersję 24.
- JDK 21 do uruchomienia backendu; ustaw `JAVA_HOME`, jeśli Maven nie znajduje Javy.
- Docker z Docker Compose do uruchomienia PostgreSQL.

Maven Wrapper jest dołączony dla Windows, Linuxa i macOS; nie trzeba osobno instalować Mavena. Pierwsze uruchomienie pobiera Maven i zależności z internetu. Sama gra działa bez backendu i bazy danych.

## Uruchomienie po sklonowaniu

W głównym katalogu projektu:

```powershell
npm ci
npm run dev
```

Otwórz adres podany przez Vite, domyślnie `http://localhost:5173`. Zależności instalujemy z głównego katalogu; projekt używa npm workspaces i głównego `package-lock.json`.

Opcjonalnie uruchom backend w drugim terminalu, również z głównego katalogu:

```powershell
docker compose up -d postgres
npm run backend:dev
```

API: `http://localhost:8080/api/health`. Dokumentacja API: `http://localhost:8080/swagger-ui/index.html`.

Zatrzymanie bazy bez usuwania jej danych:

```sh
docker compose down
```

## Konfiguracja lokalna

Domyślne ustawienia wystarczają do pracy lokalnej. Aby je zmienić, skopiuj `.env.example` do `.env` w głównym katalogu:

```powershell
Copy-Item .env.example .env
```

Na Linuxie lub macOS: `cp .env.example .env`. Docker Compose oraz skrypty `npm run backend:dev` i `npm run backend:test` odczytują ten plik. Zmienne ustawione w terminalu mają pierwszeństwo. Przy uruchomieniu Mavena bezpośrednio ustaw zmienne środowiskowe samodzielnie — Spring Boot nie wczytuje automatycznie pliku `.env`.

- `DATABASE_URL` — adres JDBC bazy dostępnej dla backendu.
- `DATABASE_USERNAME`, `DATABASE_PASSWORD` — dane dostępu backendu i lokalnego kontenera PostgreSQL.

Kontener tworzy bazę `neon_void` i udostępnia ją na porcie `5432`. Zmiana danych dostępu w `.env` nie zmienia użytkownika w już istniejącym wolumenie PostgreSQL. Przykładowe dane są przeznaczone do lokalnego developmentu. Plik `.env` jest pomijany przez Git.

## Sprawdzenie projektu

Z głównego katalogu:

```sh
npm run lint
npm test
npm run build
npm run backend:test
```

Testy backendu korzystają z H2 i nie wymagają Dockera. Aby uruchomić testy przeglądarkowe, najpierw zainstaluj Chromium:

```sh
npm exec --workspace frontend -- playwright install chromium
npm run test:e2e
```

Na Linuxie instalacja bibliotek systemowych może wymagać `npm exec --workspace frontend -- playwright install --with-deps chromium`. Playwright uruchamia własny serwer Vite na porcie `5180`.

## Pierwsze wysłanie na GitHub

Utwórz puste repozytorium na GitHub, bez dodawania README, licencji ani `.gitignore`. W głównym katalogu projektu wykonaj poniższe polecenia. Jeśli repozytorium lokalne jest już zainicjalizowane, pomiń `git init`.

```sh
git init -b main
git add .
git status
git commit -m "Initial project import"
git remote add origin https://github.com/TWOJ_LOGIN/NAZWA_REPOZYTORIUM.git
git push -u origin main
```

Zastąp `TWOJ_LOGIN/NAZWA_REPOZYTORIUM` swoim adresem repozytorium. Jeśli Git poprosi o tożsamość, ustaw swoje `user.name` i `user.email`, a następnie ponów commit.

Do repozytorium trafiają źródła, grafiki, testy, konfiguracja, pliki blokady zależności i dokumentacja. `.gitignore` pomija m.in. `node_modules/`, `dist/`, `backend/target/`, wyniki testów, logi i lokalne dane dostępu. Te katalogi są odtwarzane podczas instalacji i budowania projektu.

## Sterowanie

- `W/S` — pitch.
- `A/D` — yaw.
- `Q/E` — pełny obrót w lewo/prawo, bez limitu podczas trzymania klawisza.
- `Shift` — połowa mocy napędu do przodu.
- `Spacja` — pełna moc napędu do przodu.
- `Ctrl` — napęd wsteczny.
- `K` — dodge.
- `LPM` lub `F` — strzał.

Mysz lub `A/D` i `W/S` obracają statek. `I` otwiera ekwipunek poza walką, `C` statystyki i podgląd 3D aktualnego statku, `L` dziennik nawigacyjny, a `Esc` pauzę. Dziennik zamyka się klawiszem L lub przyciskiem X; statystyki klawiszem C lub Esc. L jest zarezerwowane dla dziennika. Starsze przypisania sterowania migrują bez utraty pozostałych ustawień.

## Obecna rozgrywka

Nowa gra zaczyna się bezpośrednio w galaktyce. Do celów misji trzeba samodzielnie dolecieć. Orion-7 zawiera 60 planet i 3000 statków patrolowych — ponad 13 razy więcej niż poprzednie 226. Granice świata wynoszą x ±560000, y ±350000 i z 0–3000000 m. Planety mają trzykrotnie większe promienie, od 1728 do 37800 m. Stacje zachowują swoje współrzędne; cele orbitalne i skany uwzględniają powierzchnie powiększonych planet.

W przestrzeni rozmieszczono 12 misji, w tym pięciu bossów z eskortami i dwie walki na orbitach. Statki wrogów i bossowie są kolejne 3× więksi; skala modeli wynosi odpowiednio 9 i 18, a obszary trafień rosną razem z nimi. Podczas lotu widoczny jest tylko znacznik najbliższego hangaru, bez tła i ramki. Dziennik ma mapę sektora, aktualny kurs, listę trzech stacji i sygnałów misji. Przyciski kursu zmieniają znacznik, zachowując otwarty dziennik i pozycję statku. Wlot wymaga zbliżenia i braku przeciwników; hangar przygotowuje się podczas animowanego podejścia, przelotu przez śluzę i lądowania.

Słońce Meridian znajduje się przy (153600, 40960, 1945600) i ma promień 192000 m, powiększony kolejne 3×. Żar zaczyna się 20 km od powierzchni. Nagrzanie narasta przez 1,5 s, maksymalne obrażenia termiczne wynoszą 24/s, a palenie dogasa przez 2,5 s po ucieczce. Odporność termiczna zmniejsza obrażenia; unik nie usuwa ciągłej ekspozycji.

Plecak ma 36 miejsc oraz osobne sloty uzbrojenia, osłon i silnika. Grafiki modułów mają białe, niebieskie lub fioletowe tło rzadkości; zamontowane części zmieniają kolor i szczegóły statku. Materiały mają własne ikony i opisy zastosowania. W stacjach można wytwarzać, przestrajać i sprzedawać części.

Wyposażenie może zapewniać odporności kinetyczne, termiczne, jonowe i na promieniowanie. Sumują się tylko zamontowane moduły, z limitem 85% dla każdego typu; wartości pokazuje ekwipunek i warsztat. Obecny ostrzał zadaje obrażenia kinetyczne, a słońce termiczne. Typy jonowy i promieniowanie są przygotowane w API do kolejnych broni oraz zagrożeń.

Smugi silników i pasma przyspieszenia reagują na moc napędu, a podczas bezwładnego lotu pasma znikają. Pociski gracza wyprzedzają statek. Kadłub i osłony są widoczne na paskach podczas lotu oraz walki; pasek uniku pokazuje jego odnowienie. Liczby obrażeń znikają po sekundzie.

## Renderowanie dużego świata

Odległe planety używają prostych modeli, a proceduralne powierzchnie powstają według odległości od powierzchni, także przy największych ciałach. Jednocześnie szczegółowych jest najwyżej 1, 2 lub 3 planety, zależnie od jakości grafiki. Indeks przestrzenny wybiera do 96 najbliższych przeciwników do pełnej symulacji i tworzy ich modele w zasięgu 3,2 km; odległe patrole aktualizują wspólne trasy cztery razy na sekundę. Pociski ponownie wykorzystują siatki z puli, a wstępne sprawdzenie granic odrzuca odległe obiekty przed dokładnym testem trafienia.

HP i osłony są zapisywane wraz z postępem. W hangarze kadłub regeneruje się bezpłatnie z prędkością 10 HP/s. Osłony ładuje się przyciskiem za wyświetloną cenę: 0,5 KS za brakujący punkt, z zaokrągleniem w górę. Dokowanie, zmiana modułu lub ponowne uruchomienie sceny nie napełniają osłon.

Przy trafieniu pojawia się kierunek i nazwa źródła obrażeń. Silnik ma cichy pomruk podczas lotu i wyższy ton przy przyspieszaniu, a na postoju i w menu wycisza się. Ciągły, spokojny ambient kosmiczny zmienia barwę między lotem, dziennikiem i hangarem; menu ma delikatne dźwięki interfejsu. Muzykę i głośność główną reguluje się w ustawieniach. Dźwięk uruchamia się po pierwszym kliknięciu lub naciśnięciu klawisza.

Shift utrzymuje połowę mocy (bazowo 146,25 m/s), spacja pełną moc (292,5 m/s); otoczenie nie obniża automatycznie prędkości ręcznego lotu. Podejście do hangaru i lądowanie trwają łącznie 13,6 s, a start i wylot 4,3 s, z oczekiwaniem na gotowość sceny w razie potrzeby.

## Dokumentacja

- [Architektura](docs/ARCHITECTURE.md)
- [Design gry](docs/GAME_DESIGN.md)
- [Design walki](docs/COMBAT_DESIGN.md)
- [Strażnik Meridian](docs/BOSS_DESIGN.md)
- [Misje kampanii](docs/MISSIONS.md)

Pozycja w świecie, misje, częściowy postęp celów i wyposażenie zapisują się lokalnie w przeglądarce. API Spring Boot ma tylko endpoint health; serwerowy zapis profilu nie jest jeszcze zintegrowany.

Każdy przeciwnik i boss ma nad modelem nazwę oraz LVL wynikający z wytrzymałości i siły uzbrojenia. Etykiety znikają po zniszczeniu celu oraz przy zasłonięciu przez planetę. Wylot z hangaru ma animację podniesienia, obrotu i przelotu przez śluzę; świat przygotowuje się w tle.

1590 statków lata w 530 trójkach jednej frakcji; 1410 pozostaje samodzielnych. Patrole utrzymują szyk V, wspólnie reagują na gracza i wracają na trasę po walce. Powiększone kadłuby zachowują odstępy. Poświata, smugi i cząstki pozostają oszczędne. Starsze zapisy przy powierzchniach planet są bezpiecznie przenoszone nad ich powiększoną powierzchnię.
