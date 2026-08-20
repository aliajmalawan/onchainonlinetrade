<?php
/**
 * Creates the database, tables, and a demo admin.
 * Run once from the terminal:   php setup_db.php
 */
require_once __DIR__ . '/config.php';

// Connect WITHOUT selecting a database so we can create it.
$dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    exit("\n[x] Can't connect to MySQL: " . $e->getMessage()
        . "\n    Is XAMPP MySQL running? Check credentials in config.php\n\n");
}

$pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`
            CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `" . DB_NAME . "`");

$pdo->exec("
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('user','admin') NOT NULL DEFAULT 'user',
    kyc_status    ENUM('unverify','verify','rejected') NOT NULL DEFAULT 'unverify',
    profit_mode   TINYINT(1) NOT NULL DEFAULT 0,
    loss_mode     TINYINT(1) NOT NULL DEFAULT 0,
    status        ENUM('active','rejected') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");
try {
    $pdo->exec('ALTER TABLE users ADD COLUMN profit_mode TINYINT(1) NOT NULL DEFAULT 0');
} catch (PDOException $e) {
}
try {
    $pdo->exec('ALTER TABLE users ADD COLUMN loss_mode TINYINT(1) NOT NULL DEFAULT 0');
} catch (PDOException $e) {
}
// Migration: Add status column if it doesn't exist, and migrate from old verified column
try {
    $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active','rejected') NOT NULL DEFAULT 'active'");
} catch (PDOException $e) {
}
// Migration: Convert old verified/kyc_status to new kyc_status ENUM
$hasKycStatus = (bool) $pdo->query("SHOW COLUMNS FROM users LIKE 'kyc_status'")->fetch();
$hasVerified = (bool) $pdo->query("SHOW COLUMNS FROM users LIKE 'verified'")->fetch();
if (!$hasKycStatus) {
    $pdo->exec("ALTER TABLE users ADD COLUMN kyc_status ENUM('unverify','verify','rejected') NOT NULL DEFAULT 'unverify'");
} else {
    $pdo->exec("ALTER TABLE users MODIFY COLUMN kyc_status ENUM('unverify','verify','rejected') NOT NULL DEFAULT 'unverify'");
}
if ($hasVerified) {
    // Map old values: verified=1 -> verify, verified=0 -> unverify, status=rejected -> rejected
    $pdo->exec("UPDATE users SET kyc_status = 'verify' WHERE verified = 1");
    $pdo->exec("UPDATE users SET kyc_status = 'unverify' WHERE verified = 0 AND status != 'rejected'");
    $pdo->exec("UPDATE users SET kyc_status = 'rejected' WHERE status = 'rejected'");
    $pdo->exec("ALTER TABLE users DROP COLUMN verified");
}
$pdo->exec("
CREATE TABLE IF NOT EXISTS tokens (
    token      CHAR(64) PRIMARY KEY,
    user_id    INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    location   VARCHAR(150) DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");
try {
    $pdo->exec('ALTER TABLE tokens ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL');
} catch (PDOException $e) {
}
try {
    $pdo->exec('ALTER TABLE tokens ADD COLUMN user_agent VARCHAR(255) DEFAULT NULL');
} catch (PDOException $e) {
}
try {
    $pdo->exec('ALTER TABLE tokens ADD COLUMN location VARCHAR(150) DEFAULT NULL');
} catch (PDOException $e) {
}

$pdo->exec("
CREATE TABLE IF NOT EXISTS holdings (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    coin_id    VARCHAR(80)  NOT NULL,
    symbol     VARCHAR(30)  NOT NULL,
    name       VARCHAR(120) NOT NULL,
    image      VARCHAR(255) DEFAULT NULL,
    amount     DECIMAL(30,10) NOT NULL,
    buy_price  DECIMAL(30,10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("
CREATE TABLE IF NOT EXISTS trade_history (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    action        ENUM('add','update','remove') NOT NULL,
    coin_id       VARCHAR(80)  NOT NULL,
    symbol        VARCHAR(30)  NOT NULL,
    name          VARCHAR(120) NOT NULL,
    amount        DECIMAL(30,10) NOT NULL,
    price         DECIMAL(30,10) NOT NULL,
    direction     ENUM('buy','sell') DEFAULT NULL,
    duration      INT DEFAULT NULL,
    condition_pct DECIMAL(6,4) DEFAULT NULL,
    profit_amount DECIMAL(30,10) NOT NULL DEFAULT 0,
    loss_amount   DECIMAL(30,10) NOT NULL DEFAULT 0,
    opening_price DECIMAL(30,10) DEFAULT NULL,
    result        ENUM('Profit','Loss') DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");
// Migration: add the Step-6 trade-detail columns to an existing table.
foreach ([
    "ALTER TABLE trade_history ADD COLUMN direction ENUM('buy','sell') DEFAULT NULL",
    "ALTER TABLE trade_history ADD COLUMN duration INT DEFAULT NULL",
    "ALTER TABLE trade_history ADD COLUMN condition_pct DECIMAL(6,4) DEFAULT NULL",
    "ALTER TABLE trade_history ADD COLUMN profit_amount DECIMAL(30,10) NOT NULL DEFAULT 0",
    "ALTER TABLE trade_history ADD COLUMN loss_amount DECIMAL(30,10) NOT NULL DEFAULT 0",
    "ALTER TABLE trade_history ADD COLUMN opening_price DECIMAL(30,10) DEFAULT NULL",
    "ALTER TABLE trade_history ADD COLUMN result ENUM('Profit','Loss') DEFAULT NULL",
] as $migration) {
    try {
        $pdo->exec($migration);
    } catch (PDOException $e) {
    }
}

$pdo->exec("CREATE TABLE IF NOT EXISTS withdraw_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    amount     DECIMAL(30,10) NOT NULL,
    currency   VARCHAR(20) NOT NULL DEFAULT 'USD',
    network    VARCHAR(80) DEFAULT NULL,
    address    VARCHAR(255) DEFAULT NULL,
    fee        DECIMAL(30,10) DEFAULT NULL,
    tx_id      VARCHAR(255) DEFAULT NULL,
    status     ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS deposit_requests (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    amount         DECIMAL(30,10) NOT NULL,
    currency       VARCHAR(20) NOT NULL DEFAULT 'USDT',
    network        VARCHAR(80) DEFAULT NULL,
    address        VARCHAR(255) DEFAULT NULL,
    tx_id          VARCHAR(255) DEFAULT NULL,
    tx_proof_image VARCHAR(255) DEFAULT NULL,
    status         ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");
try {
    $pdo->exec('ALTER TABLE deposit_requests ADD COLUMN tx_proof_image VARCHAR(255) DEFAULT NULL');
} catch (PDOException $e) {
}

$pdo->exec("CREATE TABLE IF NOT EXISTS deposit_addresses (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    currency   VARCHAR(20) NOT NULL,
    network    VARCHAR(80) NOT NULL,
    address    VARCHAR(255) NOT NULL,
    qr_image   VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY currency_network (currency, network)
) ENGINE=InnoDB");
try {
    $pdo->exec('ALTER TABLE deposit_addresses ADD COLUMN qr_image VARCHAR(255) DEFAULT NULL');
} catch (PDOException $e) {
}

// Seed the addresses that used to be hardcoded in the frontend, so the
// deposit form keeps working after switching to admin-managed addresses.
$seedAddresses = [
    ['USDT', 'TRC20', 'TXn9GvzQq2FhKzYc6yqAqW2wV8rF7ZpNam'],
    ['USDT', 'ERC20', '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'],
    ['USDT', 'BEP20', '0x9d5A1E4B2fC0E8F9C2eD3B44a8b9F1D2c3E4f5a6'],
];
$seedStmt = $pdo->prepare('INSERT IGNORE INTO deposit_addresses (currency, network, address) VALUES (?, ?, ?)');
foreach ($seedAddresses as $row) {
    $seedStmt->execute($row);
}

$pdo->exec("CREATE TABLE IF NOT EXISTS support_messages (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    sender     ENUM('user','admin') NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS kyc_documents (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    id_type    ENUM('passport','national_id','driving_license') NOT NULL,
    front_path VARCHAR(255) DEFAULT NULL,
    back_path  VARCHAR(255) DEFAULT NULL,
    selfie_path VARCHAR(255) DEFAULT NULL,
    status     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    data JSON DEFAULT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

echo "[ok] Tables ready.\n";

// Seed a demo admin (same credentials as the frontend demo).
$email = 'ghk171854@gmail.com';
$stmt  = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);

if (!$stmt->fetch()) {
    $hash = password_hash('admin123', PASSWORD_DEFAULT);
    $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
        ->execute(['Super Admin', $email, $hash, 'admin']);
    echo "[ok] Seeded demo admin -> ghk171854@gmail.com / admin123\n";
} else {
    echo "[i] Admin already exists, skipping seed.\n";
}

echo "[ok] Database setup complete.\n";