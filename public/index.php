<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

// Get settings
$configManager = ConfigManager::getInstance();
$settings = $configManager->getSettings();

$pageTitle = $settings['APP_NAME'] ?? 'KPI Competition';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/includes/header.php';

// Initialize database and fetch standings
$db = Database::getInstance();
$standings = $db->query("
    SELECT 
        u.first_name, 
        u.last_name, 
        COALESCE(SUM(s.points), 0) as total_points
    FROM users u
    LEFT JOIN scores s ON u.id = s.staff_id
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY total_points DESC
")->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <link rel="stylesheet" href="css/style.css">
    <!-- Other head elements -->
</head>
<body>
    <div class="container py-5">
        <div class="section-header mb-4">
            <h1>KPI Competition Standings</h1>
        </div>

        <div class="row">
            <div class="col-md-8 mx-auto">
                <div class="card weekly-scorecard">
                    <div class="card-body">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Name</th>
                                    <th>Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($standings as $index => $participant): ?>
                                <tr>
                                    <td><?php echo $index + 1; ?></td>
                                    <td><?php echo htmlspecialchars($participant['first_name'] . ' ' . $participant['last_name']); ?></td>
                                    <td><?php echo number_format($participant['total_points'], 0); ?></td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/includes/footer.php'; ?>