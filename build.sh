#!/bin/sh
set -e
npm install
npm run build
npx @vscode/vsce package --allow-missing-repository
