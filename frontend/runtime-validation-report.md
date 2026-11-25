# Runtime validation — giant worlds, 3000 patrol ships, navigation journal and ambient audio

Validated on 2026-11-25 (Europe/Warsaw), using Node.js 26.13.0 and Chromium through Playwright.

| Check | Result |
|---|---|
| `npm run build` | PASS — TypeScript and production bundle |
| `npm run lint` | PASS |
| `npm test` | PASS — 130 tests in 27 files |
| `npm run test:e2e` | PASS — 21 browser journeys |

The production build retains Vite's bundle-size advisory for the Babylon.js dependency chunk. The hangar module loads dynamically when docking begins.

## Browser coverage

- New game starts directly in Orion-7; hull, shields and dodge recharge stay visible during flight.
- L opens the cosmic journal with a sector chart, 12 physical missions, three stations and a course readout. L or X closes it; no journal HUD button or return/settings/title buttons remain. Tracking leaves the journal open and changes navigation without teleporting or replacing the live world. Opening it from a parked hangar preserves that scene and does not mount a new flight scene. The mobile close button remains visible after scrolling.
- Pause/settings open and close without rebuilding the flight scene.
- Docking requires proximity. The actual hangar scene prepares during approach, waits for readiness, becomes visible inside the airlock, animates landing, and keeps its nose forward. Departure lifts and turns the ship, prepares the world during takeoff, then flies through the same station's airlock. Control resumes facing away from the station, 140 m beyond its approach position.
- The landing journey also checks the three articulated supports while extending, full deployment before touchdown, all foot bottoms meeting the pad and retraction during takeoff. The status text follows approach, deployment and touchdown. This journey was rerun after the landing gear change.
- The station workshop crafts and sells a part, spending and granting the expected resources.
- Inventory displays 36 cells, three part silhouettes and four material graphics. Equipping updates the model's rarity color without replacing the flight scene.
- Acceleration streaks and exhaust emission turn off when thrust is released. Player projectiles overtake a boosting ship.
- Q rolls left and E rolls right, with continuous full rotations. Former reversed defaults migrate to this mapping.
- A remote boss is reachable before earlier missions, disables inventory during combat, and grants its equipment/reward once. Reloading preserves completion.
- Local planetary scanning persists its result.
- Shift reaches half forward thrust, Space reaches full thrust without firing, and mouse firing works independently. Existing Space-to-fire profiles migrate to the new bindings.
- Holding Space near a station, a hostile ship and a planetary surface keeps at least 291 m/s after acceleration; it no longer alternates between automatic proximity limits. Space takes priority when Shift is also held; releasing Space settles at half speed.
- Approach and landing take 9.2 + 4.4 s, while hangar takeoff and station departure take 2.1 + 2.2 s, excluding readiness holds.
- Only the nearest station has a flight marker, without a background, border or focus outline; it changes when approaching another station. The journal retains all three stations.
- The distant sun is present at z=1945600 m with a 192000 m radius. The galaxy has 60 planets and 3000 roaming ships, more than 13× the previous 226. Bounds are x ±560000, y ±350000 and z 0–3000000 m. Planet radii increased another 3× to 1728–37800 m. Streaming limits detailed surfaces to two at standard quality and uses distance to the surface, so even the largest planet loads terrain before arrival.
- Within 20 km of the sun's surface the ship warms, burns, loses shields/health, and displays a thermal warning. Equipped thermal resistance appears in the inventory and reduces incoming thermal damage. Escaping ends the flames after their brief lingering period.
- Enemy and boss models are another 3× larger, with base scales 9 and 18 respectively. Browser checks confirm corresponding model scales and collision radii.
- C opens a read-only statistics sheet with live hull/shields, actual weapon damage, theoretical DPS, speeds, resistances and a central 3D view of the equipped ship. C/Esc closes it without opening pause or restarting flight; repeated opening disposes the preview engine.
- Damage shows a camera-relative bearing and source label. Projectile origins, collisions and solar heat share this feedback path.
- Damaged hull/shields survive scene changes and saves. Hangar hull repairs at 10 HP/s without spending credits; 80 missing shield points cost the displayed 40 KS. Crafting, selling and launch preserve the resulting credits and shields.
- Native Web Audio checks confirm a running engine graph with different oscillator frequencies while accelerating and coasting, followed by silence when stopped. Menus suspend controls and fade the motor.
- Native audio output measurements confirm a nonzero ambient signal during flight, in the journal and after landing in the hangar. The root soundtrack survives scene transitions. Setting music volume to zero silences the ambient signal; engine and interface effects have separate routing. Browser audio unlocks on the first user gesture.

- Visible enemies and bosses show their personal/class name and LVL above the model. The threat level is derived from actual health, shields and weapon damage. Names disappear behind the camera or a planetary surface and after defeat. Browser tests check both a regular scout and the Null Choir boss.
- 530 same-faction trios patrol in a V among 1410 independent ships. Browser checks verify three visible names, common headings and stable spacing while moving. Unit checks cover a wingman's alert reaching the leader and full-route clearance around the expanded planets.
- Older saves inside newly expanded planetary surfaces resume at 8 m clearance without impact damage or free healing; scanning stays available. Oversized boss labels stay inside the viewport while their body is visible.

The forward speed tuning is 25% lower: Shift 146.25 m/s and Space 292.5 m/s before equipment bonuses. The thrust and steady-cruise browser journeys were rerun for these limits; reverse remains 241.8 m/s.

## Logic coverage

Tests include expanded bounds, safe stations/planet surfaces, four factions/classes, five different boss damage profiles, escorts, a complete orbital battle, legacy saves/settings, partial objectives, idempotent rewards, ordered salvage restoration, dodge timing, and swept projectile collisions. Solar damage integrates equally across frame rates; resistances are parsed, persisted, added only from installed parts, and capped at 85% per type.

Additional checks cover source bearings under camera rotation, vertical attacks, free hull regeneration, shield prices, insufficient funds, persistent damage, capacity changes without free energy, stats matching damage rolls, quiet engine profiles, and suspended controls. New transit checks verify +Z nose alignment on entry, 180° takeoff rotation, forward departure, control handoff and unchanged station geometry after batching. Label projection tests cover camera visibility, range and planet occlusion.

Flight checks hold full thrust for 20 s without oscillation and retain the exact half/full ratio with engine upgrades. Analytical movement produces matching distance and velocity through acceleration, half thrust, coasting and reversal at 10, 30, 60 and 144 frames/s. World checks retain safe surfaces, spawns, mission orbits and a reachable sun after the spacing/boundary expansion.

Landing gear tests use real Babylon meshes with NullEngine: the legs unfold while hovering, all three feet meet the pad at the calculated landed height, and takeoff raises the feet before folding without crossing the platform surface.

The suspension adds a small compression/rebound after touchdown, settling at 0.04 local units of compression. Mesh tests sample the entire settling phase and confirm that all feet stay at pad height while the hull moves. The browser docking journey records the same motion and fixed foot positions. The static loaded pose survives hangar scene rebuilds; departure unloads the pistons before folding the supports.

Formation tests retain all former IDs within 3000 unique roaming IDs, 1590 grouped ships, 530 formations and 1410 solo ships. Routes sample a complete orbit against all enlarged surfaces. Runtime tests verify common velocity, spacing and coordinated aggro using real actor transforms. Spatial-index checks cover negative cell boundaries, moving actors, removal and unique query results. A settings test migrates a saved L binding while preserving other custom keys.

## Optimization checks

- Detailed planet budgets: low 1, standard 2, high 3. Distant bodies use frozen low polygon models; procedural terrain loads near the ship.
- The full world contains 3055 combat actors, including mission ships. A 4 km spatial grid selects nearby candidates and caps full simulation at 96 actors within 3.2 km. Remote formations sample shared routes at 4 Hz; cached visual resources are released beyond their retention range. Browser measurements verify local candidate counts rather than scanning all 3055 actors each frame.
- In an empty-space simulation, 500 firing updates require at most 32 new bolt meshes and more than 400 pool reuses. Idle pools are bounded and share geometry.
- Conservative bounds reject distant planets/ships before exact swept collision tests. Tests retain planet blocking and moving-target contacts.

- Each standard station merges 47 parts into four frozen material groups (12 meshes across three stations instead of 141).
- The 60 distant planet proxies share one geometry and retain their individual sizes/materials.
- Glow renders at reduced resolution with a 8-pixel kernel; planet surfaces are excluded. Flight disables automatic pointer picking.
- Nameplates update with the HUD (about eight times per second), require no additional GPU textures/meshes and are limited to 32 visible nearby targets.
- At 1280×720 and standard quality, the main glow target is 160×90. The sun uses its own textured corona and skips duplicate bloom. Acceleration streak meshes are disabled during scene preparation and station autopilot.
- Standard space glow intensity is 0.18 (previously 0.4). Its target has one quarter of the previous pixels; blur kernel 8 replaces 16. Exhaust capacity is 40 particles per engine (previously 64), rate 30 replaces 48, streak count 8 replaces 14 and burn capacity 48 replaces 64. The view-angle kick and atmospheric brightness are lower.

## Visual inspection

Inventory checked at 1280×720, 1122×703, 1024×768 and 390×844. Desktop keeps backpack, installed modules and materials visible without scrolling; mobile scrolls without horizontal overflow. Workshop checked at desktop/mobile sizes. Installed white/blue/purple modules share their icon colors and have increasing bands, coils and emitters on the ship.

World screenshots cover a station approach, boss encounter and planetary orbit. Space remains dark; waypoints reserve space beside the right-hand panels.

The latest visual review also covers the distant sun, a burning ship and a large frontier planet. The chase camera reserves more near-plane depth precision for the expanded world.

The statistics sheet was inspected at 1280×720, 1024×768 and 390×844: no horizontal overflow or overlapping module graphics, with the close button always visible. The nearest hangar marker, maintenance controls and incoming damage indicator were also reviewed in the running game.

The updated landing sequence was inspected at 1280×720 from approach through deployment and touchdown. The lower camera exposes the support motion; captured mesh heights confirm all three foot bottoms at approximately -0.97 m on the pad. Images and pose measurements are in the ignored `test-results/landing-gear-review/` directory.

The earlier fleet review at 1280×720 covers a moving trio, an enlarged boss, a textured planet and reduced acceleration effects. `test-results/fleet-review/metrics.json` records a 160×90 glow target, intensity 0.18, kernel 8, 40-particle engine pools, 48-particle burn capacity and a two-planet detail budget. These effect limits remain unchanged in the latest expansion.

The latest review is in `test-results/universe-journal-review/`: journal screenshots at 1280×720, 1024×768 and 390×844, a scrolled mobile journal, the first planet, Titan Nocturne, a boss, a trio and the sun. No horizontal overflow was measured and only X appears as header navigation. Metrics confirm radii 37800 m and 192000 m for the largest planet and sun, 3000 patrol ships, 3055 total combat actors, 530 groups and a 96-actor local limit. The first planet scene streamed one detailed surface with eight nearby actors; the giant planet also streamed terrain while the pilot was still above its surface. All reviewed scenes completed without page errors. The journal browser journey was rerun after removing its obsolete global CSS, and the production build passed again.

Local review images are in the ignored `test-results/equipment-review/`, `test-results/resistance-review/`, `test-results/open-world-review/`, `test-results/solar-review/`, `test-results/ship-statistics-review/`, `test-results/maintenance-review/` and `test-results/station-transit-review/` directories. The last set includes forward entry, hangar takeoff, station departure, regular/boss nameplates and the enlarged planets/sun, with resource counts in `metrics.json`. Browser saves remain in localStorage; backend persistence is outside this validation scope.
