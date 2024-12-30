<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Rules';

// Fetch all competitions for dropdown
$competitions = $db->query("SELECT * FROM competitions ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);

// Add this after competitions query, before the HTML output
$filterCompetition = isset($_GET['filterCompetition']) ? intval($_GET['filterCompetition']) : null;

// Build rules query
$rulesQuery = "
    SELECT cr.*, c.name as competition_name 
    FROM competition_rules cr
    LEFT JOIN competitions c ON cr.competition_id = c.id";

if ($filterCompetition) {
    $rulesQuery .= " WHERE cr.competition_id = ?";
    $rules = $db->query($rulesQuery, [$filterCompetition])->fetchAll(PDO::FETCH_ASSOC);
} else {
    $rulesQuery .= " ORDER BY c.name, cr.name";
    $rules = $db->query($rulesQuery)->fetchAll(PDO::FETCH_ASSOC);
}

// Initialize form variables
$ruleName = '';
$rulePoints = 0; // Initialize points
$ruleEmoji = '';
$selectedCompetition = '';
$action = 'Add Competition Rule'; // Default action

// Check if an edit is requested
if (isset($_GET['edit_id'])) {
    $editId = intval($_GET['edit_id']);
    $rule = $db->query("
        SELECT cr.*, c.id as competition_id 
        FROM competition_rules cr
        LEFT JOIN competitions c ON cr.competition_id = c.id
        WHERE cr.id = ?", 
        [$editId])->fetch(PDO::FETCH_ASSOC);
    
    if ($rule) {
        $ruleName = $rule['name'];
        $rulePoints = $rule['points'];
        $ruleEmoji = $rule['emoji'];
        $selectedCompetition = $rule['competition_id'];
        $action = 'Edit Competition Rule';
    }
}

// Display messages
if (isset($_GET['message'])) echo '<div class="alert alert-success">' . htmlspecialchars($_GET['message']) . '</div>';
if (isset($_GET['error'])) echo '<div class="alert alert-danger">' . htmlspecialchars($_GET['error']) . '</div>';

?>

<div class="container py-5">
    <h1 class="text-center mb-4">Rule Management</h1>

    <div class="row">
        <!-- Form Section -->
        <div class="col-md-4">
            <div class="card">
                <div class="card-body">
                    <h2 class="mb-3"><?php echo $action; ?></h2>
                    <form method="POST" action="functions.php">
                        <?php if (isset($_GET['edit_id'])): ?>
                            <input type="hidden" name="rule_id" value="<?php echo intval($_GET['edit_id']); ?>">
                        <?php endif; ?>
                        <div class="mb-3">
                            <label for="competition" class="form-label">Competition</label>
                            <select class="form-select" id="competition" name="competition_id" required>
                                <option value="">Select Competition</option>
                                <?php foreach ($competitions as $competition): ?>
                                    <option value="<?php echo $competition['id']; ?>" 
                                            <?php echo $selectedCompetition == $competition['id'] ? 'selected' : ''; ?>>
                                        <?php echo htmlspecialchars($competition['name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="ruleName" class="form-label">Rule Name</label>
                            <input type="text" class="form-control" id="ruleName" name="ruleName" 
                                   value="<?php echo htmlspecialchars($ruleName); ?>" required>
                        </div>
                        <div class="mb-3">
                            <label for="ruleEmoji" class="form-label">Rule Emoji</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="ruleEmoji" name="ruleEmoji" 
                                       value="<?php echo htmlspecialchars($ruleEmoji); ?>" required readonly>
                                <button type="button" id="emoji-button" class="btn btn-secondary">Pick Emoji</button>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="rulePoints" class="form-label">Points</label>
                            <input type="number" class="form-control" id="rulePoints" name="rulePoints" 
                                   value="<?php echo htmlspecialchars($rulePoints); ?>" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100">Save Rule</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Rules List Section -->
        <div class="col-md-8">
            <div class="card rules-card">
                <div class="card-body">
                    <form method="GET" class="mb-3">
                        <select class="form-select" id="filterCompetition" name="filterCompetition" onchange="this.form.submit()">
                            <option value="">All Competitions</option>
                            <?php foreach ($competitions as $competition): ?>
                                <option value="<?php echo $competition['id']; ?>" 
                                    <?php echo (isset($_GET['filterCompetition']) && $_GET['filterCompetition'] == $competition['id']) ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($competition['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </form>

                    <ul class="list-group rules-list">
                        <?php foreach ($rules as $rule): ?>
                            <li class="list-group-item">
                                <div class="d-flex align-items-center justify-content-between w-100">
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="rule-emoji"><?php echo $rule['emoji']; ?></span>
                                        <span class="rule-name"><?php echo htmlspecialchars($rule['name']); ?></span>
                                        <span class="rule-points"><?php echo $rule['points']; ?> points</span>
                                        <span class="rule-competition"><?php echo htmlspecialchars($rule['competition_name']); ?></span>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <a href="?edit_id=<?php echo $rule['id']; ?>" class="btn btn-warning btn-sm">Edit</a>
                                        <form method="POST" action="functions.php" class="d-inline">
                                            <input type="hidden" name="delete_id" value="<?php echo $rule['id']; ?>">
                                            <input type="hidden" name="action" value="delete_rule">
                                            <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                                        </form>
                                    </div>
                                </div>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Emoji Picker Modal -->
<div id="emojiPicker" style="display:none; position: absolute; background: white; border: 1px solid #ccc; z-index: 1000;">
    <div style="display: flex; flex-wrap: wrap; padding: 10px;">
        <?php
        // List of emojis (you can expand this list)
        $emojis = ['😀', '😂', '😍', '😎', '🤔', '😢', '😡', '👍', '👎', '🎉', '❤️', '🔥','💲','🔥','💡','📞','📧','1️⃣'];
        foreach ($emojis as $emoji) {
            echo '<span style="font-size: 24px; cursor: pointer; margin: 5px;" class="emoji">' . $emoji . '</span>';
        }
        ?>
    </div>
</div>

<script>
document.getElementById('emoji-button').addEventListener('click', function() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

// Add event listener to emoji spans
document.querySelectorAll('.emoji').forEach(function(emoji) {
    emoji.addEventListener('click', function() {
        document.getElementById('ruleEmoji').value = this.textContent; // Set the emoji input value
        document.getElementById('emojiPicker').style.display = 'none'; // Hide the picker
    });
});
</script>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>