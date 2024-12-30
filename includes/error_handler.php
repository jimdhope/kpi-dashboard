<?php
// Set the path for the error log
$logFile = __DIR__ . '/../logs/error.log'; // Adjust the path as needed

// Check if the log directory exists, if not create it
if (!file_exists(dirname($logFile))) {
    mkdir(dirname($logFile), 0755, true);
}

// Set the error log
ini_set('error_log', $logFile);

function customErrorHandler($errno, $errstr, $errfile, $errline) {
    $logFile = __DIR__ . '/../logs/error.log';
    $severity = getSeverityName($errno);
    $message = date('[Y-m-d H:i:s]') . " [$severity] $errstr in $errfile on line $errline\n";
    error_log($message, 3, $logFile);
    
    if (defined('DEVELOPMENT_MODE') && DEVELOPMENT_MODE) {
        displayDevError($errno, $errstr, $errfile, $errline);
    } else {
        displayProductionError();
    }
}

// Ensure error reporting is set correctly
if (defined('DEVELOPMENT_MODE') && DEVELOPMENT_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0); // Suppress errors in production
}

function getSeverityName($errno) {
    switch ($errno) {
        case E_ERROR: return 'ERROR';
        case E_WARNING: return 'WARNING';
        case E_NOTICE: return 'NOTICE';
        default: return 'UNKNOWN';
    }
}

function displayDevError($errno, $errstr, $errfile, $errline) {
    // Clean output buffer
    if (ob_get_level()) {
        ob_clean();
    }
    $error_message = "$errstr in $errfile on line $errline";
    include __DIR__ . '/error_page.php';
    exit();
}

function displayProductionError() {
    // Clean output buffer
    if (ob_get_level()) {
        ob_clean();
    }
    include __DIR__ . '/error_page.php';
    exit();
}

set_error_handler('customErrorHandler');
set_exception_handler(function($e) {
    customErrorHandler($e->getCode(), $e->getMessage(), $e->getFile(), $e->getLine());
}); 