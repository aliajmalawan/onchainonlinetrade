<?php
/**
 * Template for backend/config.php — copy this file to config.php and fill
 * in your real values. config.php is gitignored (holds real DB credentials)
 * so it's never committed and never overwritten by a deploy.
 *
 * Local XAMPP: DB_USER "root", DB_PASS "" usually works out of the box.
 * cPanel: create the database + a DB user in MySQL Databases, then use the
 * full prefixed names cPanel gives you (e.g. "cpanelusername_cryptotrack").
 */
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'cpanelusername_cryptotrack');
define('DB_USER', 'cpanelusername_dbuser');
define('DB_PASS', 'CHANGE_ME');

// Frontend origins allowed to call this API (CORS). Keep the local dev
// entries so `npm run dev` still works, and add your live domain(s).
define('ALLOWED_ORIGINS', [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://[::1]:5174',
    'https://onchainonlinetrade.com',
    'https://www.onchainonlinetrade.com',
]);

// How long a login token stays valid (seconds). Default: 7 days.
define('TOKEN_TTL', 7 * 24 * 60 * 60);
