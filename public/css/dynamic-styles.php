<?php
header('Content-Type: text/css');
require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/config.php';  // Update path

// Add debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

?>

:root {
    --theme-color1: <?php echo $settings['APP_THEME_COLOR1'] ?? '#00b945'; ?>;
    --theme-color2: <?php echo $settings['APP_THEME_COLOR2'] ?? '#332648'; ?>;
    --theme-color3: <?php echo $settings['APP_THEME_COLOR3'] ?? '#625fc3'; ?>;
    --theme-color4: <?php echo $settings['APP_THEME_COLOR4'] ?? '#ffd000'; ?>;
    --theme-color5: <?php echo $settings['APP_THEME_COLOR5'] ?? '#272729'; ?>;
    --text-color: <?php echo $settings['APP_TEXT_COLOR'] ?? '#ffffff'; ?>;
}

/* Test styles to verify CSS is loading */
body {
    background-color: var(--theme-color2);
    color: var(--text-color);
}

.test-element {
    background-color: var(--theme-color1);
    color: var(--text-color);
}