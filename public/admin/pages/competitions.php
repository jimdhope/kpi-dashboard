<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Competitions';

// Get filter value
$filter = $_GET['filter'] ?? 'all';

// Get competitions based on filter
$query = "SELECT * FROM competitions";
if ($filter === 'active') {
    $query .= " WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE";
}
$query .= " ORDER BY name";

$competitions = $db->query($query)->fetchAll(PDO::FETCH_ASSOC);

// Initialize variables for the competition form
$competitionName = '';
$startDate = '';
$endDate = '';
$action = 'Add Competition'; // Default action

// Check if an edit is requested
if (isset($_GET['edit_id'])) {
    $editId = intval($_GET['edit_id']);
    $competition = $db->query("SELECT * FROM competitions WHERE id = ?", [$editId])->fetch(PDO::FETCH_ASSOC);
    
    if ($competition) {
        $competitionName = htmlspecialchars($competition['name']);
        $startDate = htmlspecialchars($competition['start_date']);
        $endDate = htmlspecialchars($competition['end_date']);
        $action = 'Edit Competition'; // Change action to Edit
    }
}

// Display success or error messages
if (isset($_GET['message'])) {
    echo '<div class="alert alert-success">' . htmlspecialchars($_GET['message']) . '</div>';
}
if (isset($_GET['error'])) {
    echo '<div class="alert alert-danger">' . htmlspecialchars($_GET['error']) . '</div>';
}
?>

<div class="container py-5">
    <h1 class="mb-4">Competition Management</h1>

    <div class="row">
        <!-- Left Column: Add Competition Form -->
        <div class="col-md-6">
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="h2 mb-0"><?php echo $action; ?></h2>
                </div>
                <div class="card-body">
                    <form method="POST" action="functions.php">
                        <div class="mb-3">
                            <label class="form-label">Competition Name</label>
                            <input type="text" name="competition_name" class="form-control" value="<?php echo $competitionName; ?>" required>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label class="form-label">Start Date</label>
                                <input type="date" name="start_date" class="form-control" value="<?php echo $startDate; ?>" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">End Date</label>
                                <input type="date" name="end_date" class="form-control" value="<?php echo $endDate; ?>" required>
                            </div>
                        </div>
                        <input type="hidden" name="competition_id" value="<?php echo isset($editId) ? $editId : ''; ?>">
                        <button type="submit" class="btn btn-primary"><?php echo $action; ?></button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Right Column: Competitions List -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">
                    <h2 class="h2 mb-0">Competitions List</h2>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <select class="form-select" id="competitionFilter" onchange="window.location.href='?filter=' + this.value">
                            <option value="all" <?php echo $filter === 'all' ? 'selected' : ''; ?>>All Competitions</option>
                            <option value="active" <?php echo $filter === 'active' ? 'selected' : ''; ?>>Active Competitions</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <?php foreach ($competitions as $competition): ?>
                            <div class="mb-3">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h3 style="margin-bottom: 0;">
                                        <?php echo htmlspecialchars($competition['name']); ?>
                                    </h3>
                                    <div>
                                        <div class="d-flex">
                                            <a href="?edit_id=<?php echo $competition['id']; ?>" class="text-warning" style="margin-right: 10px;">Edit</a>
                                            <form method="POST" action="functions.php" style="display:inline;">
                                                <input type="hidden" name="competition_id" value="<?php echo $competition['id']; ?>">
                                                <input type="hidden" name="action" value="delete_competition">
                                                <button type="submit" class="text-danger" style="background: none; border: none; padding: 0; cursor: pointer;">Delete</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <p>Starts on: <?php echo htmlspecialchars($competition['start_date']); ?>, Ends on: <?php echo htmlspecialchars($competition['end_date']); ?></p>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>