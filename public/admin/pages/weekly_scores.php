<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/pages/functions.php';

// Define page title before header include
$pageTitle = 'Weekly Scores';

require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

try {
    // Initialize variables
    $db = Database::getInstance();
    $dbConnection = $db->getConnection();

    // Get selections
    $selectedPod = $_GET['pod'] ?? '';
    $startDate = isset($_GET['start_date']) ? new DateTime($_GET['start_date']) : new DateTime('last monday');
    $endDate = new DateTime();

    // Get pods for dropdown
    $stmt = $dbConnection->prepare("SELECT * FROM pods ORDER BY name");
    $stmt->execute();
    $pods = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($selectedPod) {
        $teamData = getTeamPoints(
            $selectedPod, 
            $startDate->format('Y-m-d'), 
            $endDate->format('Y-m-d')
        );

        $leaderboardData = getLeaderboardData(
            $selectedPod,
            $startDate->format('Y-m-d'),
            $endDate->format('Y-m-d')
        );
    }
} catch (Exception $e) {
    error_log("Weekly Scores Error: " . $e->getMessage());
    die("An error occurred loading the weekly scores");
}
?>

<div class="container py-5">
    <h1 class="mb-4">Weekly Scorecard</h1>

    <form method="GET" class="card mb-4">
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Pod</label>
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
                <div class="col-md-6">
                    <label class="form-label">Start Date</label>
                    <input type="date" name="start_date" class="form-control" 
                           value="<?php echo $startDate->format('Y-m-d'); ?>" 
                           onchange="this.form.submit()">
                </div>
            </div>
        </div>
    </form>

    <?php if ($selectedPod): ?>
    <div class="row">
        <!-- Team Points Column -->
        <div class="col-md-6">
            <div class="card weekly-scorecard">
                <div class="card-header">
                    <h5 class="card-title mb-0">Team Points</h5>
                </div>
                <div class="card-body">
                    <?php foreach ($teamData as $index => $team): ?>
                        <div class="team-table position-<?php echo $index + 1; ?>">
                            <div class="team-info">
                                <h2 class="team-name mb-0"><?php echo htmlspecialchars($team['team_name']); ?></h2>
                                <h2 class="team-members mb-0"><?php echo htmlspecialchars($team['members']); ?></h2>
                            </div>
                            <div class="points-cell"><?php echo number_format($team['total_points']); ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <!-- Leaderboard Column -->
        <div class="col-md-6">
            <div class="card weekly-scorecard">
                <div class="card-header">
                    <h5 class="card-title mb-0">Leaderboard</h5>
                </div>
                <div class="card-body">
                    <?php foreach ($leaderboardData as $index => $person): ?>
                        <div class="leaderboard-table position-<?php echo $index + 1; ?>">
                            <div class="person-name">
                                <?php echo htmlspecialchars($person['first_name'] . ' ' . $person['last_name']); ?>
                            </div>
                            <div class="points-cell">
                                <?php echo number_format($person['total_points']); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>