# Misje w otwartym świecie

Nowa gra zaczyna się w sektorze Orion-7, w pozycji `(0, 0, 0)`. Nie uruchamia pierwszej areny ani prologu. Dziennik nawigacyjny otwiera się klawiszem L i zamyka przez L lub X. Mapa, aktualny kurs i lista sygnałów pozwalają śledzić dowolny nieukończony cel; wybór zmienia znacznik bez zamykania dziennika, a pilot sam do niego dolatuje. Dziennik działa również podczas postoju w hangarze. Spotkania uruchamiają się w pobliżu celu i można je wykonywać w dowolnej kolejności.

## Cele i nagrody

W sektorze jest 12 misji. Bossowie, wraki, patrole oraz cele na orbitach znajdują się w tej samej przestrzeni co planety i stacje.

| Identyfikator | Nazwa | Cel | Nagroda podstawowa |
| --- | --- | --- | --- |
| `warden` | Pierwszy kontakt | Pokonaj Strażnika Meridian i jego eskortę. | 240 KS i rdzeń Meridian |
| `silent-signal` | Sygnał w ciszy | Odzyskaj trzy czarne skrzynki przy rozproszonym wraku. | 120 KS i trzy fragmenty danych |
| `signal-source` | Echo w rdzeniu | Zniszcz przekaźnik; trafiaj w oknach pulsującej osłony. | 180 KS |
| `veil-survey` | Archiwum Mgławicy | Doleć do Archiwum Mgławicy i zeskanuj planetę. | 150 KS |
| `patrol-hunt` | Cichy patrol | Odszukaj i zniszcz zwiadowcę Veil. | 225 KS |
| `null-choir` | Głos bez echa | Pokonaj Chór i przerwij jego transmisję. | 320 KS |
| `glass-orbit` | Strażnicy szklanej orbity | Zniszcz sześć okrętów korsarzy na orbicie Szklanego Księżyca. | 280 KS |
| `nacre-ambush` | Zasadzka na rafie | Rozbij eskadrę siedmiu jednostek przy Rafie Nacre. | 360 KS |
| `ashen-carrier` | Nosiciel Popiołu | Pokonaj ciężkiego nosiciela Legionu Popiołu. | 520 KS |
| `forge-orbit` | Oblężenie Kuźni | Zniszcz osiem jednostek oblężniczych na orbicie Cichej Kuźni. | 420 KS |
| `cult-convergence` | Zgromadzenie kultu | Rozbij zgromadzenie ośmiu okrętów kultu. | 400 KS |
| `meridian-warlord` | Ostatni admirał | Zniszcz flagowy okręt rozłamu Meridian. | 700 KS |

Definicje, współrzędne, promienie aktywacji i nagrody są w [`definitions.ts`](../frontend/src/game/missions/definitions.ts). Ukończenie misji przyznaje nagrodę tylko raz. Pięciu bossów ma odrębne parametry i eskorty:

| Boss | Kadłub | Osłona | Obrażenia pocisku | Wzór ostrzału | Eskorta |
| --- | ---: | ---: | ---: | --- | ---: |
| Strażnik Meridian | 300 | 200 | 10 | Wachlarz | 2 |
| Źródło sygnału | 420 | 240 | 16 | Salwy, pulsująca osłona | 3 |
| Pusty Chór | 600 | 400 | 22 | Spirala | 4 |
| Nosiciel Popiołu | 900 | 500 | 32 | Wachlarz | 5 |
| Ostatni admirał | 1200 | 650 | 38 | Salwy | 6 |

Pokonanie bossa daje także część statku. Skanowanie planet i niszczenie okrętów dostarcza dodatkowych KS, doświadczenia, stopu metalu, miedzi i pozostałości radioaktywnych.

## Sektor i floty

Orion-7 zawiera 60 planet i 3000 statków patrolowych: 530 trójek i 1410 niezależnych jednostek. Granice świata wynoszą x ±560000, y ±350000 i z 0–3000000 m. Promienie planet wynoszą 1728–37800 m, kolejne 3× więcej. Stacje zachowują swoje współrzędne; cele orbitalne i skany uwzględniają powiększone powierzchnie. Cztery frakcje korzystają z czterech klas statków; NPC i bossowie są kolejne 3× więksi, ze skalami modeli 9 i 18 oraz dopasowanymi obszarami trafień.

Przeciwnicy należą do rozłamu Meridian, Korsarzy Nacre, Kultu Pustego Chóru i Legionu Popiołu. Cztery klasy jednostek — zwiadowca, interceptor, bombowiec i fregata — mają różne modele, wytrzymałość, prędkość i ostrzał. Jednostki misji orbitalnych są rozłożone wokół powierzchni planety, więc oczyszczenie orbity wymaga lotu między celami.

## Stacje i wyposażenie

Warsztat jest dostępny po fizycznym dotarciu do jednej z trzech stacji orbitalnych:

| Stacja | Współrzędne `(x, y, z)` |
| --- | --- |
| Przystań Meridian | `(0, 0, 1800)` |
| Węzeł Nacre | `(-3600, 800, 23500)` |
| Bastion Kuźni | `(4200, 1400, 42000)` |

Podczas lotu widoczny jest tylko znacznik najbliższego hangaru, bez tła, ramki i obramowania fokusu. W dzienniku pozostaje lista trzech stacji. Wlot wymaga zbliżenia i braku przeciwników; hangar przygotowuje się podczas animowanego podejścia, przelotu przez śluzę i lądowania. HP i osłony są zapisywane wraz z postępem. W hangarze kadłub regeneruje się bezpłatnie z prędkością 10 HP/s. Osłony ładuje się przyciskiem za wyświetloną cenę: 0,5 KS za brakujący punkt, z zaokrągleniem w górę. Dokowanie, zmiana modułu lub ponowne uruchomienie sceny nie napełniają osłon.

Plecak ma 36 miejsc, a trzy zamontowane moduły są przechowywane osobno. Uzbrojenie, osłony i silniki mają własne grafiki oraz białe, niebieskie lub fioletowe tło rzadkości. Zamontowany moduł zmienia kolor i szczegóły odpowiedniej części statku, w tym pasma uzbrojenia, pierścienie silnika oraz emitery osłon. Warsztat pozwala wytwarzać, przestrajać i sprzedawać części. Ekwipunek można zmieniać poza walką; materiały mają ikony i krótkie opisy zastosowania.

## Słońce i odporności

Słońce Meridian znajduje się przy (153600, 40960, 1945600) i ma promień 192000 m, kolejne 3× więcej. Żar zaczyna się 20 km od powierzchni. Nagrzanie narasta przez 1,5 s, maksymalne obrażenia termiczne wynoszą 24/s, a palenie dogasa przez 2,5 s po ucieczce. Odporność termiczna zmniejsza obrażenia; unik nie usuwa ciągłej ekspozycji.

Zamontowane moduły mogą wnosić odporność kinetyczną, termiczną, jonową oraz na promieniowanie, maksymalnie 85% na typ. Ekwipunek i warsztat pokazują sumę odporności aktualnego statku. Dotychczasowe części bez tych danych pozostają poprawne. Obecne pociski zadają obrażenia kinetyczne, a słońce termiczne; API przewiduje także przyszłe źródła jonowe i promieniowanie.

## Zapis postępu

Pozycja w sektorze, odkryte planety, pokonane cele, ukończone misje i częściowy postęp celów zapisują się w localStorage. Dziennik i ustawienia wstrzymują tę samą scenę świata. Wczytywanie zachowuje wcześniejsze liczniki ukończonych misji; nie wymaga ponownego przechodzenia prologu. To lokalny zapis jednej przeglądarki — profil serwerowy nie jest jeszcze zintegrowany.

Panel C pokazuje rzeczywiste statystyki i aktualny model wyposażonego statku. Trafienia sygnalizują kierunek oraz źródło; Q obraca w lewo, a E w prawo.

Każdy przeciwnik i boss ma nad modelem nazwę oraz LVL wynikający z wytrzymałości i siły uzbrojenia. Etykiety znikają po zniszczeniu celu oraz przy zasłonięciu przez planetę. Wylot z hangaru ma animację podniesienia, obrotu i przelotu przez śluzę; świat przygotowuje się w tle.

Poza eskortami misji działa 530 patroli po trzy jednostki jednej frakcji. Mają wspólną trasę i szyk, reagują na atak lub bliskość gracza jako grupa i mogą rozbić formację podczas pościgu. Pozostałe 1410 statków lata samodzielnie. Indeks przestrzenny ogranicza pełną symulację do najbliższych jednostek.
