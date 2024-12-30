<?php
// Error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Include necessary files
require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

// Function to get setting from the database
function getSetting($name) {
    global $db; // Assuming $db is your database connection
    $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_name = ?");
    $stmt->execute([$name]);
    return $stmt->fetchColumn();
}

// Define application constants from the database
define('APP_NAME', getSetting('APP_NAME') ?: 'Default Site Name'); // Set your application name
define('APP_TIMEZONE', getSetting('APP_TIMEZONE') ?: 'America/New_York'); // Set your timezone
define('SITE_URL', 'http://kpi.internal'); // Set your site URL 

// After defining APP_NAME and APP_TIMEZONE
echo "APP_NAME: " . APP_NAME . "<br>";
echo "APP_TIMEZONE: " . APP_TIMEZONE . "<br>";