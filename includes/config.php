<?php
// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Add error logging
error_log("Starting config.php initialization");

try {
    // Include the database connection
    require_once __DIR__ . '/../public/includes/db.php';

    // Initialize settings array
    $settings = [];

    // Get settings from database if connection exists
    if (isset($db)) {
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings");
        $stmt->execute();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    if (!function_exists('getSetting')) {
        function getSetting($key, $default = null) {
            global $settings;
            return $settings[$key] ?? $default;
        }
    }

    // Define application constants with fallbacks
    if (!defined('APP_NAME')) {
        define('APP_NAME', getSetting('APP_NAME', 'Default App Name'));
    }

    if (!defined('APP_TIMEZONE')) {
        define('APP_TIMEZONE', getSetting('APP_TIMEZONE', 'UTC'));
    }

} catch (Exception $e) {
    error_log("Config initialization error: " . $e->getMessage());
    throw new Exception("Application initialization failed: " . $e->getMessage());
}
?>