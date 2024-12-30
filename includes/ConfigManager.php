<?php
class ConfigManager {
    private static $instance = null;
    private $settings = [];
    private $configFile;
    private $backupDir;

    private function __construct($configFile) {
        $this->configFile = $configFile;
        $this->backupDir = dirname($configFile) . '/backups';
        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
        $this->settings = [
            'database' => [
                'host' => 'localhost',
                'dbname' => 'kpi_internal',
                'username' => 'root',
                'password' => '',
                'charset' => 'utf8mb4'
            ],
            // Add other configuration sections as needed
        ];
    }

    public static function getInstance($configFile = null) {
        if (self::$instance === null) {
            self::$instance = new self($configFile);
        }
        return self::$instance;
    }

    public function loadSettings() {
        return $this->settings;
    }

    public function getSetting($section, $key = null) {
        if ($key === null) {
            return $this->settings[$section] ?? null;
        }
        return $this->settings[$section][$key] ?? null;
    }

    public function updateConfig($settings) {
        // Backup current config
        $backupFile = $this->backupDir . '/app_config_' . date('Y-m-d_His') . '.php';
        if (!copy($this->configFile, $backupFile)) {
            throw new Exception("Failed to create backup");
        }

        // Read current config
        $content = file_get_contents($this->configFile);
        if ($content === false) {
            throw new Exception("Failed to read config file");
        }

        // Update settings
        foreach ($settings as $key => $value) {
            $pattern = "/define\('$key',\s*'.*?'\);/";
            $replacement = "define('$key', '$value');";
            $content = preg_replace($pattern, $replacement, $content);
        }

        // Write new config
        if (file_put_contents($this->configFile, $content) === false) {
            throw new Exception("Failed to write config file");
        }
    }
}