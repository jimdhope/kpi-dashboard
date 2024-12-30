<?php
// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Define paths
define('ROOT_PATH', dirname(__DIR__));
define('INCLUDES_PATH', ROOT_PATH . '/includes');
define('CLASSES_PATH', INCLUDES_PATH . '/classes');
define('LOG_PATH', ROOT_PATH . '/logs');
define('PUBLIC_PATH', ROOT_PATH . '/public');

// Set error log path
ini_set('error_log', LOG_PATH . '/error.log');

// Verify paths exist
if (!is_dir(INCLUDES_PATH) || !is_dir(CLASSES_PATH)) {
    error_log("Critical path missing: INCLUDES_PATH or CLASSES_PATH");
    die("Configuration error: Invalid path structure");
}

// Load config first
require_once INCLUDES_PATH . '/app_config.php';

// Autoload classes with error handling
spl_autoload_register(function ($class) {
    $file = CLASSES_PATH . '/' . $class . '.php';
    error_log("Attempting to load class: " . $class . " from " . $file);
    if (file_exists($file)) {
        require_once $file;
    } else {
        error_log("Class file not found: " . $file);
        throw new Exception("Missing required class: " . $class);
    }
});

try {
    error_log("Bootstrap: Starting initialization");
    
    // Initialize database with detailed error
    $db = Database::getInstance();
    if (!$db) {
        throw new Exception("Database connection failed - check credentials");
    }
    error_log("Bootstrap: Database connected");

    // Initialize ConfigManager
    $config = ConfigManager::getInstance();
    $settings = $config->loadSettings();
    
    if (!$settings) {
        throw new Exception("Settings load failed - check database 'settings' table");
    }
    error_log("Bootstrap: Settings loaded");

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    error_log("Bootstrap: Session started");

} catch (Exception $e) {
    error_log("Bootstrap Error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    die("Application initialization failed: " . $e->getMessage());
}
?>