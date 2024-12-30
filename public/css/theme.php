<?php
header('Content-Type: text/css');
require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

$configManager = ConfigManager::getInstance();
$settings = $configManager->getSettings();
?>

:root {
    --theme-color1: <?php echo $settings['APP_THEME_COLOR1'] ?? '#00B945'; ?>;
    --theme-color2: <?php echo $settings['APP_THEME_COLOR2'] ?? '#332648'; ?>;
    --theme-color3: <?php echo $settings['APP_THEME_COLOR3'] ?? '#625fc3'; ?>;
    --theme-color4: <?php echo $settings['APP_THEME_COLOR4'] ?? '#ffd000'; ?>;
    --theme-color5: <?php echo $settings['APP_THEME_COLOR5'] ?? '#272729'; ?>;
    --theme-color6: <?php echo $settings['APP_THEME_COLOR6'] ?? '#333333'; ?>;
    --background-color: <?php echo $settings['APP_BACKGROUND_COLOR'] ?? '#ffffff'; ?>;
    --text-h1-color: <?php echo $settings['TEXT_H1_COLOR'] ?? '#ffffff'; ?>;
    --text-h2-color: <?php echo $settings['TEXT_H2_COLOR'] ?? '#ffffff'; ?>;
    --text-h3-color: <?php echo $settings['TEXT_H3_COLOR'] ?? '#ffffff'; ?>;
    --text-h4-color: <?php echo $settings['TEXT_H4_COLOR'] ?? '#ffffff'; ?>;
    --text-h5-color: <?php echo $settings['TEXT_H5_COLOR'] ?? '#ffffff'; ?>;
    --text-h6-color: <?php echo $settings['TEXT_H6_COLOR'] ?? '#ffffff'; ?>;
    --text-p-color: <?php echo $settings['TEXT_P_COLOR'] ?? '#ffffff'; ?>;
}

body { background-color: var(--background-color); color: var(--theme-color6); }
.btn-primary { background-color: var(--theme-color1); border-color: var(--theme-color1); }
.card { background-color: var(--theme-color2); color: var(--theme-color6); }
.nav-link { color: var(--theme-color6); }
.nav-link:hover { color: var(--theme-color1); }