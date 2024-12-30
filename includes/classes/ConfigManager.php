<?php
class ConfigManager {
    private static $instance = null;
    private $settings = [];
    private $db;
    private $inTransaction = false;

    private function __construct() {
        $this->db = Database::getInstance();
        $this->loadSettings();
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function updateConfig($newSettings) {
        $connection = $this->db->getConnection();
        
        try {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }
            
            $connection->beginTransaction();
            
            $stmt = $connection->prepare(
                "INSERT INTO settings (setting_name, setting_value) 
                 VALUES (:name, :value) 
                 ON DUPLICATE KEY UPDATE setting_value = :value"
            );
            
            foreach ($newSettings as $key => $value) {
                $stmt->execute([
                    ':name' => $key,
                    ':value' => $value
                ]);
            }
            
            $connection->commit();
            $this->loadSettings();
            return true;

        } catch (Exception $e) {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }
            error_log("Config Update Error: " . $e->getMessage());
            throw new Exception("Failed to update configuration");
        }
    }

    public function loadSettings() {
        try {
            $stmt = $this->db->query("SELECT setting_name, setting_value FROM settings");
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($results as $row) {
                $this->settings[$row['setting_name']] = $row['setting_value'];
            }
            return true;
        } catch (Exception $e) {
            error_log("Settings Load Error: " . $e->getMessage());
            return false;
        }
    }

    public function getSetting($key, $default = null) {
        return $this->settings[$key] ?? $default;
    }

    public function getSettings() {
        return $this->settings;
    }
}