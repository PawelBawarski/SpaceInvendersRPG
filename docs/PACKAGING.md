# Building a release package

Run this from the repository root:

```sh
npm run package
```

The command builds the React bundle and Spring Boot JAR, then writes a deployable hand-off directory to `artifacts/neon-void/`:

- `frontend/` contains static files for any HTTP server or CDN.
- `neon-void-backend.jar` starts with `java -jar neon-void-backend.jar`.
- `manifest.json` records the built frontend version and source JAR.

The package directory is generated output and is ignored by Git.
