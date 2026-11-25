# Neon Void

Neon Void is an open-world space RPG built with React, TypeScript, and Babylon.js. New games start directly in Orion-7. Fly to mission signals, scan planets, fight faction ships, and dock at orbital stations to use their workshops. The journal tracks destinations without moving the ship.

## Flight controls

- Move the mouse away from the canvas center to steer; the center is neutral.
- Hold the left mouse button or F to fire. Space applies full forward thrust and does not fire.
- W/S pitch, A/D yaw, Q rolls left, and E rolls right. Holding Q/E allows continuous full rotations.
- Shift applies half forward thrust; Space applies full forward thrust; Ctrl brakes or reverses.
- K performs an evasive dodge.
- L opens the navigation journal in flight or while parked in the hangar. L or X closes it. L is reserved and migrates conflicting older bindings.
- Mouse sensitivity and key bindings can be changed in Settings. Older profiles migrate the old Space fire binding while preserving custom bindings and resolving conflicts.
- Press I outside combat to inspect the ship loadout and the 6×6 backpack. Ship parts can be equipped outside combat and sold at station workshops. White, blue, and purple part artwork matches the installed modules' colors and details; material icons sit beside the backpack on desktop.
- Hull and shield bars remain visible during missions and exploration. Combat also shows a dodge recharge bar; cargo and controls no longer clutter the flight HUD.
- Pilot XP remains visible during missions, exploration, campaign screens, and hangar visits. Missions, first-time planetary scans, and drone encounters award XP; level 2 requires 100 XP, with the requirement increasing by 35 XP per level afterward.

Planet scans become available near a planet's surface. Collision damages shields and may damage the hull; steer around planetary bodies rather than flying through them.

Held Shift maintains half thrust (146.25 m/s base); Space maintains full thrust (292.5 m/s base), with the same module multiplier. Nearby enemies, stations and planets do not change the manual flight speed limit. Acceleration and travel distance use an analytical integration. Docking takes 9.2 s plus 4.4 s landing; departure takes 2.1 s takeoff plus 2.2 s through the airlock, waiting for scene readiness if necessary.

Orion-7 contains 60 planets, 3000 patrol ships across four factions/classes, three stations, and twelve physical missions. Bounds are x ±560000, y ±350000 and z 0–3000000 m. Planet radii are three times larger again, ranging from 1728 to 37800 m. Only the nearest hangar marker appears in flight, without a background or border. Enemy ships and bosses are another 3× larger, with model scales 9 and 18 respectively and matching collision radii.

The journal has a sector chart, current course, mission signals and station services. Its only screen navigation is the X close action or L; selecting a destination changes the tracked course while keeping the journal open. Opening it from the hangar preserves the parked ship without mounting a flight scene.

Twelve physical missions include five bosses with different attacks and damage, escorts, two orbital fleet battles, salvage, and survey objectives. Approach a station to request docking; the hangar loads during the animated entry and the ship lands before the workshop opens. Departure lifts and turns the ship, preloads the world, and flies nose first through the station airlock before returning control. Hangar crew members exchange ambient dialogue. Mission completion, partial objectives, equipment, and flight position save locally.

Press C for current hull/shields, damage, nominal DPS, speed, resistances, installed modules and a central 3D preview. The sheet pauses flight; C/Esc closes it. Incoming hits show their direction and source.

Hull and shields persist across scenes and saves. Hull repairs free in the hangar at 10 HP/s. Missing shields cost 0.5 KS per point (rounded up) through the displayed recharge action. Docking does not refill shields. The engine has different quiet tones for coasting and acceleration, with smooth muting while stopped or viewing menus.

Quiet synthesized ambient chords continue across title/settings, flight, journal and hangar, changing their tone with the location. Buttons have soft hover/confirmation chimes. The root audio graph owns the soundtrack; flight owns engine and weapon sounds. Music and master sliders apply across screens, and the first click or key press unlocks browser audio.

## Solar heat and resistances

The Meridian Sun is at (153600, 40960, 1945600), with a 192000 m radius. Heat starts 20 km from its surface, ramps over 1.5 s to at most 24 raw thermal damage/s, and fades over 2.5 s after escape. Thermal resistance reduces damage. Space outside its surroundings stays dark.

Installed modules can contribute kinetic, thermal, ion and radiation resistances. Each total is capped at 85% and displayed in the inventory and workshop. Current projectiles use kinetic damage and the sun uses thermal damage; ion/radiation types are API foundations for future content. Older parts without resistance data remain valid.

## Rendering large distances

PlanetField keeps lightweight distant spheres visible and streams procedural surfaces by distance to the surface, including on the largest planets. Detailed planet budgets are 1/2/3 for low/standard/high graphics quality. A 4 km spatial grid selects at most 96 nearby combat actors within 3.2 km for full simulation; distant formations sample their shared routes at 4 Hz. Models are created locally and remote cached models are released. Shot meshes are pooled; bounds checks reject distant bodies before exact swept collision tests.

## Development

From this directory:

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

Enemy ships and bosses show their name and threat level above the model. Threat levels follow actual durability and weapon strength; hidden or destroyed targets have no label. Static station geometry uses four material groups, distant planets share geometry, and glow renders at reduced resolution.

1590 ships belong to 530 same-faction trios and 1410 remain independent. The 3000 patrols exceed the former 226 by more than 13×. Trios follow a shared route in a V, alert each other and split to engage, then regroup. Fleets operate near early routes and around planets. Larger planets retain safe mission orbits and older near-surface saves resume above the new surface.

Space glow now uses intensity 0.1/0.18/0.3 (low/standard/high), an 8-pixel blur kernel and a 1/8-resolution main target at standard quality. Exhaust pools and rates, acceleration streaks, field-of-view kick, atmosphere brightness and burn particles are reduced.
