<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

$pageTitle = 'Dashboard';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

?>

<div class="container py-5">
    <h1 class="mb-4">Dashboard</h1>

    <?php
    // Get database connection properly
    $dbConnection = Database::getInstance()->getConnection();

    // Initialize date range
    $endDate = new DateTime();
    $startDate = (new DateTime())->modify('-30 days');

    if (isset($_GET['start_date'], $_GET['end_date'])) {
        $startDate = new DateTime($_GET['start_date']);
        $endDate = new DateTime($_GET['end_date']);
    }

    $filterType = $_GET['filter_type'] ?? 'overall';
    $filterId = $_GET['filter_id'] ?? null;

    // Helper function to get filter options
    function getFilterOptions($dbConnection, $type) {
        $query = match($type) {
            'user' => "SELECT id, CONCAT(first_name, ' ', last_name) as name FROM users ORDER BY name",
            'pod' => "SELECT id, name FROM pods ORDER BY name",
            default => null
        };
        
        if (!$query) return [];
        $stmt = $dbConnection->query($query);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // First, debug the query params function
    function getTopPerformers($dbConnection, $filterType, $filterId, $startDate, $endDate) {
        $query = "
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                COALESCE(SUM(ds.score * cr.points), 0) as total_points,
                COUNT(DISTINCT ds.date) as active_days
            FROM users u
            LEFT JOIN daily_scores ds ON u.id = ds.user_id 
                AND ds.date BETWEEN :start_date AND :end_date
            LEFT JOIN competition_rules cr ON ds.rule_id = cr.id
        ";

        $params = [
            ':start_date' => $startDate->format('Y-m-d'),
            ':end_date' => $endDate->format('Y-m-d')
        ];

        // Add filter conditions
        if ($filterType !== 'overall' && $filterId) {
            switch ($filterType) {
                case 'pod':
                    $query .= " WHERE EXISTS (SELECT 1 FROM pod_assignments pa WHERE pa.staff_id = u.id AND pa.pod_id = :filter_id)";
                    $params[':filter_id'] = $filterId;
                    break;
                case 'team':
                    $query .= " WHERE EXISTS (SELECT 1 FROM user_team ut WHERE ut.user_id = u.id AND ut.team_id = :filter_id)";
                    $params[':filter_id'] = $filterId;
                    break;
                case 'competition':
                    $query .= " WHERE ds.competition_id = :filter_id";
                    $params[':filter_id'] = $filterId;
                    break;
            }
        }

        $query .= " GROUP BY u.id, u.first_name, u.last_name ORDER BY total_points DESC LIMIT 3";
        
        $stmt = $dbConnection->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Initialize $rulesBreakdown before use
    $rulesQuery = "
        SELECT 
            cr.name as rule_name,
            cr.emoji,
            cr.points,
            COUNT(DISTINCT ds.id) as occurrences,
            COALESCE(SUM(ds.score), 0) as total_occurrences,
            COALESCE(SUM(ds.score * cr.points), 0) as total_points
        FROM competition_rules cr
        LEFT JOIN daily_scores ds ON cr.id = ds.rule_id 
            AND ds.date BETWEEN :start_date AND :end_date
    ";

    // Add filter conditions
    if ($filterType !== 'overall' && $filterId) {
        switch ($filterType) {
            case 'user':
                $rulesQuery .= " AND ds.user_id = :filter_id";
                break;
            case 'pod':
                $rulesQuery .= " AND EXISTS (
                    SELECT 1 FROM pod_assignments pa 
                    WHERE pa.staff_id = ds.user_id 
                    AND pa.pod_id = :filter_id
                )";
                break;
            case 'competition':
                $rulesQuery .= " AND ds.competition_id = :filter_id";
                break;
        }
    }

    // Group by rule details to merge identical rules
    $rulesQuery .= " GROUP BY cr.name, cr.emoji, cr.points
                    HAVING SUM(ds.score) > 0 
                    ORDER BY total_points DESC";

    $params = [
        ':start_date' => $startDate->format('Y-m-d'),
        ':end_date' => $endDate->format('Y-m-d')
    ];

    if ($filterType !== 'overall' && $filterId) {
        $params[':filter_id'] = $filterId;
    }

    $stmt = $dbConnection->prepare($rulesQuery);
    $stmt->execute($params);
    $rulesBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Add before Performance Analysis section
    function getIndividualPodium($dbConnection, $startDate, $endDate) {
        $query = "
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                COALESCE(SUM(ds.score * cr.points), 0) as total_points
            FROM users u
            LEFT JOIN daily_scores ds ON u.id = ds.user_id 
                AND ds.date BETWEEN :start_date AND :end_date
            LEFT JOIN competition_rules cr ON ds.rule_id = cr.id
            GROUP BY u.id, u.first_name, u.last_name
            HAVING total_points > 0
            ORDER BY total_points DESC
            LIMIT 3
        ";
        
        $stmt = $dbConnection->prepare($query);
        $stmt->execute([
            ':start_date' => $startDate->format('Y-m-d'),
            ':end_date' => $endDate->format('Y-m-d')
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    function getPodPodium($dbConnection, $startDate, $endDate) {
        $query = "
            SELECT 
                p.id,
                p.name,
                COALESCE(SUM(ds.score * cr.points), 0) as total_points
            FROM pods p
            LEFT JOIN pod_assignments pa ON p.id = pa.pod_id
            LEFT JOIN daily_scores ds ON pa.staff_id = ds.user_id 
                AND ds.date BETWEEN :start_date AND :end_date
            LEFT JOIN competition_rules cr ON ds.rule_id = cr.id
            GROUP BY p.id, p.name
            HAVING total_points > 0
            ORDER BY total_points DESC
            LIMIT 3
        ";
        
        $stmt = $dbConnection->prepare($query);
        $stmt->execute([
            ':start_date' => $startDate->format('Y-m-d'),
            ':end_date' => $endDate->format('Y-m-d')
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    $individualPodium = getIndividualPodium($dbConnection, $startDate, $endDate);
    $podPodium = getPodPodium($dbConnection, $startDate, $endDate);
    ?>

    <!-- Podiums Section -->
    <div class="row mb-4">
        <!-- Individual Podium -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">
                    <h2 class="h5 mb-0">Top Performers</h2>
                </div>
                <div class="card-body">
                    <?php foreach ($individualPodium as $index => $performer): ?>
                        <div class="leaderboard-table position-<?php echo $index + 1; ?>">
                            <div class="person-name">
                                <?php echo htmlspecialchars($performer['first_name'] . ' ' . $performer['last_name']); ?>
                            </div>
                            <div class="points-cell">
                                <?php echo number_format($performer['total_points']); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <!-- Pod Podium -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">
                    <h2 class="h5 mb-0">Top Pods</h2>
                </div>
                <div class="card-body">
                    <?php foreach ($podPodium as $index => $pod): ?>
                        <div class="leaderboard-table position-<?php echo $index + 1; ?>">
                            <div class="person-name">
                                <?php echo htmlspecialchars($pod['name']); ?>
                            </div>
                            <div class="points-cell">
                                <?php echo number_format($pod['total_points']); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Performance Analysis Section -->
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h2 class="h5 mb-0">Performance Analysis</h2>
                </div>
                <div class="card-body">
                    <div class="row">
                        <!-- Left Column: Filters -->
                        <div class="col-md-4 border-end">
                            <form id="dashboardFilter" method="GET" class="row g-3">
                                <div class="col-12">
                                    <label class="form-label">Date Range</label>
                                    <div class="input-group">
                                        <input type="date" name="start_date" class="form-control" value="<?php echo $startDate->format('Y-m-d'); ?>">
                                        <input type="date" name="end_date" class="form-control" value="<?php echo $endDate->format('Y-m-d'); ?>">
                                    </div>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">View Type</label>
                                    <select name="filter_type" class="form-select" id="filterType">
                                        <option value="overall" <?php echo $filterType === 'overall' ? 'selected' : ''; ?>>Overall</option>
                                        <option value="user" <?php echo $filterType === 'user' ? 'selected' : ''; ?>>By User</option>
                                        <option value="pod" <?php echo $filterType === 'pod' ? 'selected' : ''; ?>>By Pod</option>
                                    </select>
                                </div>
                                <div class="col-12" id="filterOptions">
                                    <?php if ($filterType !== 'overall'): 
                                        $options = ($filterType === 'competition') 
                                            ? getFilterOptions($dbConnection, $filterType, $startDate, $endDate)
                                            : getFilterOptions($dbConnection, $filterType);
                                    ?>
                                        <label class="form-label">Select <?php echo ucfirst($filterType); ?></label>
                                        <select name="filter_id" class="form-select">
                                            <?php foreach ($options as $option): ?>
                                                <option value="<?php echo $option['id']; ?>" 
                                                        <?php echo $filterId == $option['id'] ? 'selected' : ''; ?>>
                                                    <?php echo htmlspecialchars($option['name']); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                    <?php endif; ?>
                                </div>
                            </form>
                        </div>

                        <!-- Right Column: Rules Table -->
                        <div class="col-md-8">
                            <?php if (!empty($rulesBreakdown)): ?>
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Rule</th>
                                                <th>Points Value</th>
                                                <th>Times Achieved</th>
                                                <th>Total Points</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach ($rulesBreakdown as $rule): ?>
                                                <tr>
                                                    <td><?php echo $rule['emoji'] . ' ' . htmlspecialchars($rule['rule_name']); ?></td>
                                                    <td><?php echo $rule['points']; ?></td>
                                                    <td><?php echo number_format($rule['total_occurrences']); ?></td>
                                                    <td><?php echo number_format($rule['total_points']); ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            <?php else: ?>
                                <div class="alert alert-info">
                                    No rules data available for the selected period.
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Auto-submit on filter type change
    document.getElementById('filterType').addEventListener('change', function() {
        document.getElementById('dashboardFilter').submit();
    });

    // Auto-submit on filter selection change
    document.querySelector('select[name="filter_id"]')?.addEventListener('change', function() {
        document.getElementById('dashboardFilter').submit();
    });

    // Auto-submit on date change
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.addEventListener('change', function() {
            document.getElementById('dashboardFilter').submit();
        });
    });
});
</script>

<?php require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>