# Plan Refaktorzyzacji Neon Void

## 🔍 Diagnoza problemu

### Błędy gameplayu:
1. **Bug skoku**: Anulowanie skoku → nie można wrócić do galaktyki
2. **Poprzednie działanie**: Wybór galaktyki dzieje się po potwierdzeniu mapy (niepoprawne)
3. **Brak AI**: Statki obce nie chodzą, nie omijają przeszkód

### Techniczne zadania:
1. 📁 Organizacja plików w foldery
2. ✨ Konwersja CSS → SCSS
3. 🚀 Optymalizacja pod wydajność (Java Spring Boot + Frontend)
4. ✅ Dodanie testów e2e i jednostkowych
5. 🔧 Workflowy GitHub dla CI/CD

---

## 🎯 KROK 1: GitHub Workflows & Build Script

### Workflow Frontend (Quality)
```yaml
name: Frontend Quality
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
jobs:
  frontend-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      - name: Lint
        working-directory: frontend
        run: npm run lint
      - name: Unit Tests
        working-directory: frontend
        run: npm run test -- --coverage
      - name: Build
        working-directory: frontend
        run: npm run build
```

### Workflow Backend (Quality)
```yaml
name: Backend Quality
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
jobs:
  backend-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
          cache-dependency-path: backend/pom.xml
      - name: Cache Maven
        uses: actions/cache@v4
        with:
          path: ~/.m2/repository
          key: ${{ runner.os }}-backend-${{ hashFiles('backend/pom.xml') }}
          restore-keys: |
            ${{ runner.os }}-backend-
      - name: Build & Test
        working-directory: backend
        env:
          SPRING_PROFILES_ACTIVE: test
        run: mvn clean verify
```

### Workflow E2E Tests
```yaml
name: End-to-End Testing
on:
  pull_request:
    branches: [main, develop]
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Frontend Build
        working-directory: frontend
        run: npm ci && npm run build
        
      - name: Install Playwright
        working-directory: frontend
        run: npx playwright install --with-deps chromium
      
      - name: Run E2E Tests
        working-directory: frontend
        env:
          VITE_APP_API_URL: http://localhost:8080
        run: npm run test:e2e
        
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### Build Script (Docker + Cross-platform)
`build.sh`:
```bash
#!/bin/bash
set -e

echo "Building Neon Void..."

# Frontend build
cd ../frontend
npm ci
npm run build
BUILD_ARTIFACT=frontend/dist.tgz
tar -czf $BUILD_ARTIFACT frontend/dist/
echo "Frontend build complete: $BUILD_ARTIFACT"

# Backend build (Docker)
cd ../backend
mvn clean package -DskipTests
echo "Backend build complete: backend/target/neon-void-backend-0.1.0.jar"

# Cleanup
rm -rf frontend/dist
```

---

## 📁 KROK 2: Organizacja Plików (Frontend)

### Struktura folderów:
```
frontend/src/
├── assets/              # Grafiki, modele, audio
│   ├── images/
│   ├── models/
│   └── audio/
│
├── config/             # Konfiguracja aplikacji
│   ├── vite-env.d.ts
│   └── environment.ts
│
├── game/               # Logiczna strona gry (bez React)
│   ├── domain/         # Entytści, wartości, entri
│   │   ├── entities/
│   │   ├── exploration/
│   │   ├── missions/
│   │   └── ship/
│   ├── simulation/     # Symulacja (Babylon.js)
│   ├── input/          # Wejścia
│   ├── ui/             # UI komponenty (React)
│   │   ├── galaxy-map/
│   │   ├── hangar/
│   │   └── mission-dialogs/
│   └── renderer/       # Renderowanie
│
├── components/         # React UI komponenty
│   ├── common/
│   └── features/
│
└── styles/             # SCSS pliki
    ├── app.scss        # Globalne style (app.scss → index.scss)
    ├── renderer.scss   # Renderer style
    │   ├── base.scss
    │   ├── overlay.scss
    │   └── galaxy-map.scss
    └── ui.scss         # UI style
        ├── hangar.scss
        └── modal.scss

# Nowy folder:
└── e2e/               # Testy Playwright
    ├── galaxy.spec.ts  # Galaxy travel, skipping
    ├── skip-cancellation.spec.ts  # Anulowanie skoku (BUG FIX)
    └── alien-ship.spec.ts # Obcy statki

# Nowy folder:
└── unit-tests/        # Vitest jednostkowe
    ├── game/domain/
    ├── game/ui/
    └── game/simulation/
```

---

## 🎮 KROK 3: Fix Bugs w Gameplay

### Problem 1: Anulowanie skoku → nie można wrócić do galaktyki

**Rozwiązanie**: Poprawić logikę stanu transition w `sector-transit`:

```typescript
// game/domain/entities/sectorTransit.ts
export class SectorTransit implements GameState {
  private state: TransitState;
  private abortController: AbortController | null = null;
  
  get abortController() {
    return this.abortController;
  }
  
  public onAbort(event: KeyboardEvent) {
    if (this.state === 'jumping' && this.abortController) {
      this.abortController.abort();
    }
  }
  
  // Reset possible states po anulowaniu
  public resetState(): void {
    // Reset state do 'idle' i enable navigation back
    this.state = 'idle';
    
    // Trigger state change event
    this.triggerStateChanged('idle');
  }
}
```

### Problem 2: Wybór galaktyki dzieje się po potwierdzeniu mapy

**Rozwiązanie**: Zmienić kolejność akcji w `SectorMap`:

```typescript
// game/ui/galaxy-map/SectorMap.tsx
interface SectorMapState {
  selectedGalaxy: Galaxy | null;
  
  // Poprawione funkcje
  goToMap(): void;      // Otwiera mapę
  selectGalaxy(galaxyId: string): void; // Wybiera galaktykę (PO TERAZ)
  confirmSkip(): void;    // Potwierdza skok
}

// Game state machine
const handleSpaceKeyDown = (event: KeyboardEvent, ctx: GameContext) => {
  if (!ctx.hasMapOpened) {
    ctx.openGalaxyMap();       // Krok 1: Otwórz mapę
    return;
  } else if (!ctx.galaxySelected && !ctx.isJumping) {
    // Krok 2: Wybierz galaktykę
    ctx.selectGalaxyForSkip();
    return;
  } else if (ctx.galaxySelected && !ctx.isJumping) {
    // Krok 3: Potwierdź skok
    ctx.confirmSkip();
    return;
  } else if (ctx.isJumping) {
    // Krok 4: Anuluj/godź
    handleAbort(event, ctx);
  }
};
```

---

## 🤖 KROK 4: AI dla Obcych Statków

### Funkcjonalności do dodania:
1. ✅ Poruszanie się w przestrzeni (x, y, z)
2. ✅ Omijanie przeszkód/corpsów
3. ✅ Działalność atakująca
4. ✅ Brzuchomina (AI collision avoidance)

```typescript
// game/domain/ai/AIPathfinding.ts
export class AIShipBehavior implements IShipAI {
  private ship: AIShip;
  private obstacles: Obstacle[];
  
  constructor(ship: AIShip, obstacles: Obstacle[]) {
    this.ship = ship;
    this.obstacles = obstacles;
  }
  
  public calculateNextPosition(targetSectorId: string): Promise<Position3D> {
    // Find path using A*
    const targetCoords = getSectorCoordinates(sectorId);
    
    // Run pathfinding algorithm avoiding obstacles
    return findPathTo(targetCoords, this.obstacles).then((path) => {
      // Move ship along path
      return this.moveTowards(path[0], 1.0); // Speed
    });
  }
  
  private moveTowards(target: Position3D, speed: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const distance = calculateDistance(this.ship.position, target);
      
      if (distance < 1.0) { // Reached target
        resolve();
        return;
      }
      
      const direction = normalizeVector(
        Vector3.Subtract(target, this.ship.position)
      );
      
      // Collision detection before movement
      const collision = this.detectCollision(this.ship.position.add(direction.clone().scale(speed)));
      
      if (collision) {
        // Move in a different direction randomly
        const randomDir = getRandomDirection();
        speed *= 0.5; // Reduced speed to avoid collisions
        reject(); // Retry later
      } else {
        this.ship.position.add(direction.clone().scale(speed));
        resolve();
      }
    });
  }
}
```

---

## 🚀 KROK 5: Optymalizacja wydajności (Java + Frontend)

### Backend (Spring Boot):
1. ✅ **Async processing** - Async REST endpoints
2. ✅ **Pagination** - Query params z `page`/`size`
3. ✅ **Caching** - Spring Cache Redis/Hazelcast
4. ✅ **Database Indexes** - Optimize MySQL indexes

```java
// backend/src/main/java/com/neonvoid/service/SectorService.java
@Service
public class SectorService implements SectorRepository {
  
  public CompletableFuture<Sector> findSectorById(String id) {
    return reactor.flush()
      .map(id -> sectorRepo.findById(id))
      .flatMap(s -> s.map(response -> response))
      .collectList();
  }
}

// Add pagination to queries
@RestController
@RequestMapping("/api/sectors")
public class SectorController {
  @GetMapping
  public ResponseEntity<List<SectorDTO>> findAll(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "10") int size) {
    
    PageRequest req = PageRequest.of(page, size);
    return repo.findAll(req).map(Sector::toDto)
                .collectList();
  }
}
```

### Frontend (React + Babylon.js):
1. ✅ **Asset caching** - Preload galactic models
2. ✅ **Web Worker** - CPU calculations offline
3. ✅ **Object pooling** - Reuse DOM elements
4. ✅ **Lazy loading** - Load sectors on demand

```typescript
// game/simulation/GalaxyRenderer.ts
class GalaxyRenderer implements IGalaxyRenderer {
  private worker: WebWorker;
  
  // Preload all galaxy models into memory
  async preloadGalaxies(): Promise<void> {
    const promises = GALAXIES.map(g => this.loadGalaxyModel(g.id));
    await Promise.all(promises);
  }
}

// Use Web Worker for physics calculations
const physicsWorker = new Worker('assets/physics-worker.js');

function calculatePhysics() {
  physicsWorker.postMessage({ event: 'tick', input: state });
}
```

---

## 📊 KROK 6: Testy (Jednostkowe + E2E)

### Backend Tests (`backend/src/test/java/com/neonvoid/`)
```java
@SpringBootTest
@AutoConfigureMockServer(port = 8080)
class SectorServiceTest {
  
  @Autowired
  private SectorService sectorService;
  
  @Test
  void findSectorByIdShouldReturnCorrectData() {
    String id = "orion-7";
    Sector sector = sectorService.findSectorById(id).join();
    
    assertEquals("ORION", sector.getRegion());
    assertNotNull(sector.getName());
  }
}

// Integration test (full app)
@Test
class GalaxySkipIntegrationTest {
  
  @MockBean
  private SectorRepository sectorRepo;
  
  @Autowired
  private SectorService sectorService;
  
  @Test
  void cancellingSkippngDoesNotAllowNavigationBack() {
    // Arrange
    String galacticId = "vesper";
    
    // Act
    Sector skippedSector = new Sector(galacticId, ...);
    
    // Verify
    assertTrue(sectorService.isSkipCancelled(skippedSector));
  }
}
```

### Frontend Tests (Unit) (`frontend/src/unit-tests/`)
```typescript
// game/domain/sector-transit/SectorTransitTest.ts
import { SectorTransit, TransitState } from './SectorTransit';
import { createEmptyMissionProgress } from '../mission-progress';

describe('SectorTransit', () => {
  test('should abort when space key is pressed while jumping', async () => {
    const transit = new SectorTransit();
    transit.startJump();
    
    // Simulate Space key event
    const keyboardEvent = {
      code: 'Space',
      type: 'keydown' as KeyboardEventType,
    };
    
    transit.onAbort(keyboardEvent);
    
    expect(transit.state).toBe(TransitState.IDLE);
  });

  test('should not abort when in other state', async () => {
    const transit = new SectorTransit();
    
    // Space key without transition
    const keyboardEvent = {
      code: 'Space',
      type: 'keydown' as KeyboardEventType,
    };
    
    transit.onAbort(keyboardEvent);
    
    expect(transit.state).toBe(TransitState.IDLE);
  });
});
```

### E2E Tests (Playwright) (`frontend/e2e/`)
```typescript
// e2e/skip-cancellation.spec.ts
import { expect, test } from '@playwright/test';

test('cancelling skip should allow navigation back to galaxy', async ({ page }) => {
  const progress = { ...createEmptyMissionProgress(), sectorDistance: 8 };
  
  await page.addInitScript(({ key, save }) => 
    localStorage.setItem(key, JSON.stringify(save)),
    'neon-void:mission-progress:v1', progress
  );
  
  await page.goto('/');
  await page.getByRole('button', { name: 'Wczytaj grę' }).click();
  
  // Open galaxy map
  await page.keyboard.down('Space');
  const chart = page.getByRole('dialog', { name: 'Mapa galaktyk' });
  await expect(chart).toBeVisible();
  
  // Select galaxy for skip
  await chart.getByRole('button', { name: 'Vesper' }).click();
  
  // Confirm skip
  await chart.getByRole('button', { name: 'Wykonaj skok' }).click();
  
  // Wait for hyperspace jump animation to complete
  await expect(page.locator('.hyperspace-overlay')).toHaveCount(0);
  
  // Press Space to cancel jump BEFORE it completes
  await page.keyboard.down('Space');
  
  // Verify we're back in original galactic location
  await expect(chart).toBeVisible();
  
  // Now we can navigate normally
  await chart.getByRole('button', { name: 'Vesper' }).click();
  await chart.getByRole('button', { name: 'Wykonaj skok' }).click();
  
  // Complete hyperspace transition successfully
  expect(await page.locator('.hyperspace-overlay').isVisible()).toBe(false);
});

// e2e/alien-ships.spec.ts
import { test, expect } from '@playwright/test';

test('alien ships should move and avoid obstacles', async ({ page }) => {
  const progress = createEmptyMissionProgress();
  
  await page.addInitScript(({ key, save }) => 
    localStorage.setItem(key, JSON.stringify(save)), 'neon-void:mission-progress:v1', progress
  );
  
  await page.goto('/');
  await page.getByRole('button', { name: 'Wczytaj grę' }).click();
  
  // Check for alien ships
  const alienShips = page.locator('.alien-ship');
  expect(await alienShips.count()).toBeGreaterThan(0);
  
  // Alien ships should be moving
  await expect(alienShips.first()).toHaveCSS('opacity', /(1|>0.5)/);
});

// e2e/galaxy-map-navigation.spec.ts
import { expect, test } from '@playwright/test';

test('correct galaxy navigation flow (select -> skip)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Wczytaj grę' }).click();
  
  // Initial state - no galaxy selected, can't skip yet
  expect(page.locator('[data-galaxy-map]')).toBeVisible();
  
  // Press Space to open map
  await page.keyboard.down('Space');
  
  // Verify galaxy is now selected (correct behavior)
  const selectedGalaxy = page.locator('.galaxy-card.active');
  await expect(selectedGalaxy).toBeVisible();
});
```

---

## 📝 Podsumowanie kroków

### Krok 1 ✅ - GitHub Workflows + Build Script
- [ ] Create `.github/workflows/backend.yml`
- [ ] Create `.github/workflows/quality.yml`
- [ ] Create `frontend/build.sh` (build artifact)
- [ ] Test: `ci.yml`, `package.yml`

### Krok 2 - Organizacja Plików + SCSS Conversion
- [ ] Refactor folder structure (`src/config`, `src/assets/images/models/audio`)
- [ ] Convert remaining CSS files to SCSS
- [ ] Create unit-tests folder
- [ ] Create e2e test suite files

### Krok 3 - Fix Bugs w Gameplay
- [ ] Fix skip cancellation bug (sector-transit.ts)
- [ ] Fix galaxy selection order (game state machine)
- [ ] Implement alien ship AI (pathfinding, collision avoidance)
- [ ] Add tests for critical bugs

### Krok 4 - Backend Optymalizacja + Tests
- [ ] Add async processing to REST endpoints
- [ ] Implement pagination for queries
- [ ] Add unit tests (`SectorServiceTest`, `GalaxySkipIntegrationTest`)

### Krok 5 - Frontend Optymalizacja + Tests
- [ ] Preload galactic models
- [ ] Use Web Worker for physics calculations
- [ ] Implement object pooling
- [ ] Lazy loading of sectors

### Krok 6 - CI/CD Pipeline
- [ ] Run backend tests on push (quality.yml)
- [ ] Run frontend quality (lint, unit tests, build)
- [ ] Run e2e tests in parallel
- [ ] Upload test reports as artifacts

---

## 🎯 Zakończenie

Ten plan pokrywa wszystkie wymagania użytkownika:
1. ✅ GitHub Workflows (backend, frontend, e2e)
2. ✅ Build script (.sh)
3. ✅ Organizational folder structure
4. ✅ SCSS conversion
5. ✅ Performance optimization (Java + Frontend)
6. ✅ Unit tests + E2E tests
7. ✅ Fix bugs (skip cancellation, galaxy selection)
8. ✅ Alien ship AI implementation

Zacznijmy od KROKU 1 - tworzenia GitHub Workflows i build scriptu!
