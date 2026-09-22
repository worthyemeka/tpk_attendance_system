#!/bin/zsh
cd "$(dirname "$0")/.."
exec /Applications/XAMPP/xamppfiles/bin/php -S 127.0.0.1:8000 -t backend/public backend/public/router.php
