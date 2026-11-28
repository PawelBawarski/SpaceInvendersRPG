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

echo "Build process completed!"
