#!/bin/bash
# Doble clic en macOS: arranca el servidor local de PortfolioAAF y abre la app.
cd "$(dirname "$0")" || exit 1
exec python3 serve.py
