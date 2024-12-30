<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/classes/ConfigManager.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Settings';

// Ensure this points to the correct bootstrap file
require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $configManager = ConfigManager::getInstance();
        
        // Collect all settings including background color
        $newSettings = [
            'APP_NAME' => $_POST['site_name'],
            'APP_TIMEZONE' => $_POST['timezone'],
            'APP_THEME_COLOR1' => $_POST['theme_color1'],
            'APP_THEME_COLOR2' => $_POST['theme_color2'],
            'APP_THEME_COLOR3' => $_POST['theme_color3'],
            'APP_THEME_COLOR4' => $_POST['theme_color4'],
            'APP_THEME_COLOR5' => $_POST['theme_color5'],
            'APP_THEME_COLOR6' => $_POST['theme_color6'],
            'APP_BACKGROUND_COLOR' => $_POST['background_color'],
            'TEXT_H1_COLOR' => $_POST['text_h1_color'],
            'TEXT_H2_COLOR' => $_POST['text_h2_color'],
            'TEXT_H3_COLOR' => $_POST['text_h3_color'],
            'TEXT_H4_COLOR' => $_POST['text_h4_color'],
            'TEXT_H5_COLOR' => $_POST['text_h5_color'],
            'TEXT_H6_COLOR' => $_POST['text_h6_color'],
            'TEXT_P_COLOR' => $_POST['text_p_color']
        ];
        
        $configManager->updateConfig($newSettings);
        $_SESSION['success'] = "Settings updated successfully";
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit();
    } catch (Exception $e) {
        error_log("Settings update error: " . $e->getMessage());
        $_SESSION['error'] = "Settings update failed: " . $e->getMessage();
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit();
    }
}

// Fetch current settings
try {
    $configManager = ConfigManager::getInstance();
    $settings = $configManager->getSettings();
    
    if (!is_array($settings)) {
        throw new Exception("Failed to load settings");
    }
} catch (Exception $e) {
    error_log("Settings fetch error: " . $e->getMessage());
    $_SESSION['error'] = "Failed to load settings";
    $settings = [];
}

// Display messages from session
$error = $_SESSION['error'] ?? null;
$success = $_SESSION['success'] ?? null;
unset($_SESSION['error'], $_SESSION['success']);

$pageTitle = $settings['APP_NAME'] ?? 'Site Settings';
$headerButtons = '';
?>

<div class="container py-5" style="background-color: #121212; color: white;">
    <?php if (isset($error)): ?>
        <div class="alert alert-danger">
            <?php echo htmlspecialchars($error); ?>
        </div>
    <?php endif; ?>

    <?php if (isset($success)): ?>
        <div class="alert alert-success">
            <?php echo htmlspecialchars($success); ?>
        </div>
    <?php endif; ?>

    <!-- Introduction -->
    <h1>Welcome.</h1>
    <h2>Please configure the competition tracker below</h2>

    <!-- Settings Form -->
    <div class="card mb-4" style="background-color: #332648; color: white;">
        <div class="card-header">
            <h2 class="h5 mb-0">Site Settings</h2>
        </div>
        <div class="card-body">
            <form method="POST" action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']); ?>">
                <div class="mb-3">
                    <label for="site_name" class="form-label">Site Name</label>
                    <input type="text" name="site_name" id="site_name" class="form-control" 
                           value="<?php echo htmlspecialchars($settings['APP_NAME'] ?? ''); ?>" required>
                </div>
                <div class="mb-3">
                    <label for="timezone" class="form-label">Timezone</label>
                    <select name="timezone" id="timezone" class="form-control" required>
                        <?php
                        // List of timezones
                        $timezones = DateTimeZone::listIdentifiers();
                        foreach ($timezones as $timezone) {
                            $selected = (isset($settings['APP_TIMEZONE']) && $settings['APP_TIMEZONE'] === $timezone) ? 'selected' : '';
                            echo "<option value=\"$timezone\" $selected>$timezone</option>";
                        }
                        ?>
                    </select>
                </div>
                <div class="mb-3">
                    <h4 class="form-label">Theme Colors</h4>
                    <div class="row g-3">
                        <div class="col">
                            <label for="theme_color1" class="form-label">Primary</label>
                            <div class="input-group">
                                <input type="color" name="theme_color1" id="theme_color1" class="form-control color-input" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR1'] ?? '#00B945'); ?>" required>
                                <input type="text" class="form-control hex-input" id="hex_color1" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR1'] ?? '#00B945'); ?>" 
                                       pattern="^#[0-9A-Fa-f]{6}$" required>
                            </div>
                        </div>
                        <div class="col">
                            <label for="theme_color2" class="form-label">Secondary</label>
                            <div class="input-group">
                                <input type="color" name="theme_color2" id="theme_color2" class="form-control color-input" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR2'] ?? '#332648'); ?>" required>
                                <input type="text" class="form-control hex-input" id="hex_color2" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR2'] ?? '#332648'); ?>" 
                                       pattern="^#[0-9A-Fa-f]{6}$" required>
                            </div>
                        </div>
                        <div class="col">
                            <label for="theme_color3" class="form-label">Accent 1</label>
                            <div class="input-group">
                                <input type="color" name="theme_color3" id="theme_color3" class="form-control color-input" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR3'] ?? '#625fc3'); ?>" required>
                                <input type="text" class="form-control hex-input" id="hex_color3" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR3'] ?? '#625fc3'); ?>" 
                                       pattern="^#[0-9A-Fa-f]{6}$" required>
                            </div>
                        </div>
                        <div class="col">
                            <label for="theme_color4" class="form-label">Accent 2</label>
                            <div class="input-group">
                                <input type="color" name="theme_color4" id="theme_color4" class="form-control color-input" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR4'] ?? '#ffd000'); ?>" required>
                                <input type="text" class="form-control hex-input" id="hex_color4" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR4'] ?? '#ffd000'); ?>" 
                                       pattern="^#[0-9A-Fa-f]{6}$" required>
                            </div>
                        </div>
                        <div class="col">
                            <label for="theme_color5" class="form-label">Dark</label>
                            <div class="input-group">
                                <input type="color" name="theme_color5" id="theme_color5" class="form-control color-input" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR5'] ?? '#272729'); ?>" required>
                                <input type="text" class="form-control hex-input" id="hex_color5" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR5'] ?? '#272729'); ?>" 
                                       pattern="^#[0-9A-Fa-f]{6}$" required>
                            </div>
                        </div>
                        <div class="col">
                            <label for="theme_color6" class="form-label">Text Color</label>
                            <div class="input-group">
                                <input type="color" name="theme_color6" id="theme_color6" class="form-control color-input" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR6'] ?? '#333333'); ?>" required>
                                <input type="text" class="form-control hex-input" id="hex_color6" 
                                       value="<?php echo htmlspecialchars($settings['APP_THEME_COLOR6'] ?? '#333333'); ?>" 
                                       pattern="^#[0-9A-Fa-f]{6}$" required>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <label for="background_color" class="form-label">Background Color</label>
                    <div class="input-group">
                        <input type="color" name="background_color" id="background_color" class="form-control color-input" 
                               value="<?php echo htmlspecialchars($settings['APP_BACKGROUND_COLOR'] ?? '#ffffff'); ?>" required>
                        <input type="text" class="form-control hex-input" id="hex_background_color" 
                               value="<?php echo htmlspecialchars($settings['APP_BACKGROUND_COLOR'] ?? '#ffffff'); ?>" 
                               pattern="^#[0-9A-Fa-f]{6}$" required>
                    </div>
                </div>
                <div class="mb-3">
                    <h4 class="form-label">Text Colors</h4>
                    <div class="row g-3">
                        <?php
                        $textElements = [
                            'h1' => 'Heading 1',
                            'h2' => 'Heading 2',
                            'h3' => 'Heading 3',
                            'h4' => 'Heading 4',
                            'h5' => 'Heading 5',
                            'h6' => 'Heading 6',
                            'p' => 'Paragraph'
                        ];
                        
                        foreach ($textElements as $element => $label): ?>
                            <div class="col-md-3 mb-3">
                                <label for="text_<?php echo $element; ?>_color" class="form-label"><?php echo $label; ?></label>
                                <div class="input-group">
                                    <input type="color" 
                                           name="text_<?php echo $element; ?>_color" 
                                           id="text_<?php echo $element; ?>_color" 
                                           class="form-control color-input"
                                           value="<?php echo htmlspecialchars($settings['TEXT_'.strtoupper($element).'_COLOR'] ?? '#ffffff'); ?>" 
                                           required>
                                    <input type="text" 
                                           class="form-control hex-input" 
                                           id="hex_text_<?php echo $element; ?>_color"
                                           value="<?php echo htmlspecialchars($settings['TEXT_'.strtoupper($element).'_COLOR'] ?? '#ffffff'); ?>"
                                           pattern="^#[0-9A-Fa-f]{6}$" 
                                           required>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary" style="background-color: #00B945; border-color: #00B945;">Save Settings</button>
            </form>
        </div>
    </div>
</div>

<script>
document.querySelector('form').addEventListener('submit', function(e) {
    const colors = {
        color1: document.getElementById('theme_color1').value,
        color2: document.getElementById('theme_color2').value,
        color3: document.getElementById('theme_color3').value,
        color4: document.getElementById('theme_color4').value,
        color5: document.getElementById('theme_color5').value,
        color6: document.getElementById('theme_color6').value,
        backgroundColor: document.getElementById('background_color').value
    };
    
    document.documentElement.style.setProperty('--theme-color1', colors.color1);
    document.documentElement.style.setProperty('--theme-color2', colors.color2);
    document.documentElement.style.setProperty('--theme-color3', colors.color3);
    document.documentElement.style.setProperty('--theme-color4', colors.color4);
    document.documentElement.style.setProperty('--theme-color5', colors.color5);
    document.documentElement.style.setProperty('--theme-color6', colors.color6);
    document.documentElement.style.setProperty('--background-color', colors.backgroundColor);
});

function setupColorInputs(colorId, hexId) {
    const colorInput = document.getElementById(colorId);
    const hexInput = document.getElementById(hexId);

    colorInput.addEventListener('input', (e) => {
        hexInput.value = e.target.value.toUpperCase();
    });

    hexInput.addEventListener('input', (e) => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            colorInput.value = e.target.value;
        }
    });
}

// Setup all color inputs
setupColorInputs('theme_color1', 'hex_color1');
setupColorInputs('theme_color2', 'hex_color2');
setupColorInputs('theme_color3', 'hex_color3');
setupColorInputs('theme_color4', 'hex_color4');
setupColorInputs('theme_color5', 'hex_color5');
setupColorInputs('theme_color6', 'hex_color6');
setupColorInputs('background_color', 'hex_background_color');

// Add to existing JavaScript
// Setup text color inputs
['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].forEach(element => {
    setupColorInputs(`text_${element}_color`, `hex_text_${element}_color`);
});
</script>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>