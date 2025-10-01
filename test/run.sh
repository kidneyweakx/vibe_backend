#!/bin/bash
set -e

# Run tests (database initialization handled by test/setup.ts via bunfig.toml)
bun test "$@"
