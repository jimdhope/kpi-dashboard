<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Pods';

// Get all pods
try {
    $pods = $db->query("SELECT * FROM pods ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage()); // Log the error message
    die("Database error occurred. Please contact administrator."); // Show a user-friendly message
}

// Get all users
$users = $db->query("SELECT * FROM users ORDER BY last_name")->fetchAll(PDO::FETCH_ASSOC);

// Initialize variables for the form
$podName = '';
$podDescription = '';
$action = 'Add Pod'; // Default action

// Check if an edit is requested
if (isset($_GET['edit_id'])) {
    $editId = intval($_GET['edit_id']);
    $pod = $db->query("SELECT * FROM pods WHERE id = ?", [$editId])->fetch(PDO::FETCH_ASSOC);
    
    if ($pod) {
        $podName = htmlspecialchars($pod['name'] ?? '');
        $podDescription = htmlspecialchars($pod['description'] ?? '');
        $action = 'Edit Pod'; // Change action to Edit
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
    <h1 class="mb-4">Pod Management</h1>

    <div class="row">
        <!-- Left Column: Add/Edit Pod Form -->
        <div class="col-md-6">
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="h5 mb-0"><?php echo $action; ?></h2>
                </div>
                <div class="card-body">
                    <form method="POST" action="functions.php" id="podForm">
                        <div class="mb-3">
                            <label class="form-label">Pod Name</label>
                            <input type="text" name="pod_name" class="form-control" value="<?php echo $podName; ?>" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Description</label>
                            <textarea name="pod_description" class="form-control" required><?php echo $podDescription; ?></textarea>
                        </div>
                        <input type="hidden" name="pod_id" value="<?php echo isset($editId) ? $editId : ''; ?>"> <!-- Hidden field for pod ID -->
                        <button type="submit" class="btn btn-primary"><?php echo $action; ?></button>
                    </form>
                </div>
            </div>

            <!-- Move Assign Users to Pods Section Here -->
            <div class="card mt-4">
                <div class="card-header">
                    <h2 class="h5 mb-0">Assign Users to Pods</h2>
                </div>
                <div class="card-body">
                    <form method="POST" action="functions.php">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="podSelect" class="form-label">Select Pod</label>
                                <select name="pod_id" id="podSelect" class="form-select" required>
                                    <option value="">Select a Pod</option>
                                    <?php foreach ($pods as $pod): ?>
                                        <option value="<?php echo $pod['id']; ?>"><?php echo htmlspecialchars($pod['name']); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="userSelect" class="form-label">Select Users</label>
                                <select name="person_ids[]" id="userSelect" class="form-select" multiple required>
                                    <?php foreach ($users as $user): ?>
                                        <option value="<?php echo $user['id']; ?>"><?php echo htmlspecialchars($user['first_name'] . ' ' . $user['last_name']); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary">Assign Users</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Right Column: Pods List with Assigned Users -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">
                    <h2 class="h5 mb-0">Pods List</h2>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <?php foreach ($pods as $pod): ?>
                            <div class="mb-3">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h5 style="margin-bottom: 0;">
                                        <?php echo htmlspecialchars($pod['name']); ?>
                                    </h5>
                                    <div>
                                        <div class="d-flex">
                                            <a href="?edit_id=<?php echo $pod['id']; ?>" class="text-warning" style="margin-right: 10px;">Edit</a>
                                            <form method="POST" action="functions.php" style="display:inline;">
                                                <input type="hidden" name="delete_id" value="<?php echo $pod['id']; ?>">
                                                <button type="submit" class="text-danger" style="background: none; border: none; padding: 0; cursor: pointer;">Delete</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <p><?php echo htmlspecialchars($pod['description']); ?></p>
                                <ul>
                                    <?php
                                    // Fetch users assigned to this pod
                                    $assignedUsers = $db->query("SELECT users.* FROM users 
                                        JOIN pod_assignments ON users.id = pod_assignments.staff_id 
                                        WHERE pod_assignments.pod_id = ?", [$pod['id']])->fetchAll(PDO::FETCH_ASSOC);
                                    
                                    foreach ($assignedUsers as $user): ?>
                                        <li>
                                            <?php echo htmlspecialchars($user['first_name'] . ' ' . $user['last_name']); ?>
                                            <form method="POST" action="functions.php" style="display:inline; float: right;">
                                                <input type="hidden" name="pod_id" value="<?php echo $pod['id']; ?>">
                                                <input type="hidden" name="person_ids[]" value="<?php echo $user['id']; ?>">
                                                <button type="submit" class="text-danger" style="background: none; border: none; padding: 0; cursor: pointer;">Remove</button>
                                            </form>
                                        </li>
                                    <?php endforeach; ?>
                                </ul>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?> 