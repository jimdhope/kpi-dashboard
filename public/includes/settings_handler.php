<?php
function update_theme_settings($settings) {
    $env_file = "../.env";
    $env_content = file_get_contents($env_file);
    
    $color_vars = [
        'APP_THEME_COLOR1',
        'APP_THEME_COLOR2',
        'APP_THEME_COLOR3',
        'APP_THEME_COLOR4',
        'APP_THEME_COLOR5',
        'APP_TEXT_COLOR'
    ];

    foreach ($color_vars as $var) {
        if (isset($settings[$var])) {
            $env_content = preg_replace(
                "/$var=.*/",
                "$var=" . $settings[$var],
                $env_content
            );
        }
    }
    
    file_put_contents($env_file, $env_content);
}