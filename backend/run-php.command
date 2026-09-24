#!/bin/zsh
cd "$(dirname "$0")/.."
PHP_BIN="/Applications/MAMP/bin/php/php8.5.2/bin/php"
if [ ! -x "$PHP_BIN" ]; then PHP_BIN="/Applications/XAMPP/xamppfiles/bin/php"; fi
exec "$PHP_BIN" -S 127.0.0.1:8000 -t backend/public backend/public/router.php
