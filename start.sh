#!/usr/bin/env bash
# Pulse · Single-Command Launcher
cd "$(dirname "$0")" || exit 1
python3 run.py "$@"
