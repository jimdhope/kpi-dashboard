<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Rules';

// Debug POST data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    error_log('POST Data: ' . print_r($_POST, true));
}

// Get selections
$selectedDate = $_GET['date'] ?? date('Y-m-d');
$selectedPod = isset($_GET['pod']) ? $_GET['pod'] : 'all';

// Get existing scores for the selected date and pod
$existingScores = [];
if ($selectedPod && $selectedDate) {
    $scores = $db->query("
        SELECT user_id, rule_id, score 
        FROM daily_scores 
        WHERE pod_id = ? AND date = ?",
        [$selectedPod, $selectedDate])->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($scores as $score) {
        $existingScores[$score['user_id']][$score['rule_id']] = $score['score'];
    }
}

// Fetch pods for dropdown
$pods = $db->query("SELECT * FROM pods ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);

// Initialize arrays
$users = [];
$rules = [];
$teamInfo = [];

if ($selectedPod) {
    $usersQuery = "
        SELECT DISTINCT u.*, pa.pod_id, p.name as pod_name
        FROM users u 
        JOIN pod_assignments pa ON u.id = pa.staff_id
        JOIN pods p ON pa.pod_id = p.id 
        WHERE pa.pod_id = ?
        ORDER BY u.first_name ASC"; // Changed ORDER BY clause to sort by first name in ascending order
    
    $users = $db->query($usersQuery, [$selectedPod])->fetchAll(PDO::FETCH_ASSOC);

    // Get team and competition info for this pod
    $teamInfo = $db->query("
        SELECT DISTINCT t.id as team_id, t.name as team_name, c.id as competition_id, c.name as competition_name
        FROM teams t
        JOIN competitions c ON t.competition_id = c.id
        JOIN user_team ut ON ut.team_id = t.id
        JOIN users u ON u.id = ut.user_id
        JOIN pod_assignments pa ON pa.staff_id = u.id
        WHERE pa.pod_id = ?
        LIMIT 1", 
        [$selectedPod])->fetch(PDO::FETCH_ASSOC);
    
    // Get competition rules if we found a team
    if ($teamInfo) {
        $rules = $db->query("
            SELECT id, name 
            FROM competition_rules 
            WHERE competition_id = ?",
            [$teamInfo['competition_id']])->fetchAll(PDO::FETCH_ASSOC);
    }
}


// Form submission handling
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $scores = $_POST['scores'] ?? [];
    $podId = intval($_POST['pod_id']);
    $date = $_POST['date'];
    $competitionId = $_POST['competition_id'];

    try {
        $dbConnection = $db->getConnection();
        $stmt = $dbConnection->prepare("
            INSERT INTO daily_scores (user_id, rule_id, score, date, pod_id, competition_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE score = VALUES(score)
        ");

        foreach ($scores as $userId => $userScores) {
            foreach ($userScores as $ruleId => $score) {
                $stmt->execute([
                    $userId,
                    $ruleId,
                    intval($score),
                    $date,
                    $podId,
                    $competitionId
                ]);
            }
        }
        header("Location: scores.php?pod=$podId&date=$date&message=Scores saved successfully");
        exit();
    } catch (Exception $e) {
        error_log("Score save error: " . $e->getMessage());
        header("Location: scores.php?pod=$podId&date=$date&error=" . urlencode($e->getMessage()));
        exit();
    }
}
?>

<!-- Selection Form -->
<div class="container py-5">
    <h1 class="mb-4">Score Management</h1>

    <form method="GET">
        <div class="row mb-4">
            <div class="col-md-6">
                <label class="form-label">Date</label>
                <input type="date" name="date" class="form-control" 
                       value="<?php echo htmlspecialchars($selectedDate); ?>"
                       onchange="this.form.submit()">
            </div>
            <div class="col-md-6">
                <label class="form-label">Pod</label>
                <div class="d-flex">
                    <select name="pod" class="form-select" onchange="this.form.submit()">
                        <option value="">Select Pod</option>
                        <?php foreach ($pods as $pod): ?>
                            <option value="<?php echo $pod['id']; ?>" 
                                    <?php echo $selectedPod == $pod['id'] ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($pod['name']); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
        </div>
    </form>

    <!-- Scores Table -->
    <?php if ($selectedPod && !empty($users) && !empty($rules)): ?>
        <div id="scoreUpdateStatus" class="alert" style="display:none;"></div>
        <table class="table">
            <thead>
                <tr>
                    <th>Name</th>
                    <?php foreach ($rules as $rule): ?>
                        <th><?php echo htmlspecialchars($rule['name']); ?></th>
                    <?php endforeach; ?>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($user['first_name'] . ' ' . $user['last_name']); ?></td>
                        <?php foreach ($rules as $rule): ?>
                            <td>
                                <input type="number" 
                                    class="form-control score-input" 
                                    style="width: 70px;"
                                    value="<?php echo $existingScores[$user['id']][$rule['id']] ?? ''; ?>"
                                    data-user-id="<?php echo $user['id']; ?>"
                                    data-rule-id="<?php echo $rule['id']; ?>"
                                    data-pod-id="<?php echo $selectedPod; ?>"
                                    data-competition-id="<?php echo $teamInfo['competition_id']; ?>">
                            </td>
                        <?php endforeach; ?>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
    
    <div id="scoresTableContainer">
        <!-- Scores table will be loaded here -->
    </div>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>

<style>
.table {
    width: auto !important;
    min-width: 0 !important;
}

.table td, .table th {
    padding: 0.3rem !important;
    white-space: nowrap;
}

.score-input {
    width: 60px !important;
    background: #fff !important;
    color: #000 !important;
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.score-input');
    const statusDiv = document.getElementById('scoreUpdateStatus');
    const podSelect = document.querySelector('select[name="pod"]');

    if (inputs && statusDiv) {
        inputs.forEach(input => {
            input.addEventListener('change', async function() {
                statusDiv.style.display = 'block';
                statusDiv.className = 'alert alert-info';
                statusDiv.textContent = 'Updating...';
                
                try {
                    const response = await fetch('/public/admin/pages/functions.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            'action': 'update_score',
                            'user_id': this.dataset.userId,
                            'rule_id': this.dataset.ruleId,
                            'score': this.value,
                            'pod_id': this.dataset.podId,
                            'competition_id': this.dataset.competitionId,
                            'date': document.querySelector('input[name="date"]').value
                        })
                    });

                    const responseText = await response.text();
                    console.log('Server response:', responseText); // Debug log

                    let result;
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        console.error('JSON Parse Error:', responseText);
                        throw new Error('Invalid server response');
                    }

                    if (!response.ok || !result.success) {
                        throw new Error(result.error || `Server error: ${response.status}`);
                    }

                    statusDiv.className = 'alert alert-success';
                    statusDiv.textContent = 'Score updated successfully';
                } catch (error) {
                    console.error('Update failed:', error);
                    statusDiv.className = 'alert alert-danger';
                    statusDiv.textContent = `Update failed: ${error.message}`;
                } finally {
                    setTimeout(() => {
                        if (statusDiv.className.includes('info')) {
                            statusDiv.style.display = 'none';
                        }
                    }, 2000);
                }
            });
        });
    }

    if (podSelect) {
        podSelect.addEventListener('change', function() {
            const podId = this.value;
            const date = document.querySelector('input[name="date"]').value;
            
            if (podId) {
                window.location.href = `scores.php?pod=${podId}&date=${date}`;
            }
        });
    }
});
</script>