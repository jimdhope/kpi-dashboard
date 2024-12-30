<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Users';

// First, ensure we have a proper database connection
try {
    // Assuming Database class has a getConnection() method that returns PDO object
    $pdo = $db->getConnection();

    // Replace existing query with proper PDO usage
    $stmt = $pdo->prepare("SELECT * FROM users ORDER BY last_name, first_name");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Initialize variables for the form
    $firstName = '';
    $lastName = '';
    $action = 'Add User'; // Default action
    $editId = null; // Initialize edit ID

    // Check if an edit is requested
    if (isset($_GET['edit_id'])) {
        $editId = intval($_GET['edit_id']);
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$editId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            $firstName = htmlspecialchars($user['first_name']);
            $lastName = htmlspecialchars($user['last_name']);
            $action = 'Edit User'; // Change action to Edit
        }
    }

    // Check if a delete is requested
    if (isset($_GET['delete_id'])) {
        $deleteId = intval($_GET['delete_id']);
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$deleteId]);
        header("Location: /public/admin/pages/people.php?message=User deleted successfully");
        exit();
    }
} catch (PDOException $e) {
    // Handle database errors
    error_log('Database Error: ' . $e->getMessage());
    echo "An error occurred. Please try again later.";
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
    <h1 class="mb-4">People Management</h1>

    <div class="row">
        <!-- Left Column: Add/Edit User Form -->
        <div class="col-md-6">
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="h5 mb-0"><?php echo $action; ?></h2>
                </div>
                <div class="card-body">
                    <form method="POST" action="/public/admin/pages/functions.php" id="userForm">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">First Name</label>
                                    <input type="text" name="first_name" class="form-control" value="<?php echo $firstName; ?>" required>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Last Name</label>
                                    <input type="text" name="last_name" class="form-control" value="<?php echo $lastName; ?>" required>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" name="edit_id" value="<?php echo $editId; ?>">
                        <button type="submit" class="btn btn-primary"><?php echo $action; ?></button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Right Column: Users List -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">
                    <h2 class="h5 mb-0">Users List</h2>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <div class="mb-3">
                            <table class="table">
                                <tbody>
                                    <?php foreach ($users as $user): ?>
                                    <tr>
                                        <td>
                                            <?php echo htmlspecialchars($user['first_name'] . ' ' . $user['last_name']); ?>
                                        </td>
                                        <td>
                                            <a href="?edit_id=<?php echo $user['id']; ?>" class="text-warning">Edit</a>
                                        </td>
                                        <td>
                                            <a href="?delete_id=<?php echo $user['id']; ?>" class="text-danger" onclick="return confirm('Are you sure you want to delete this user?');">Delete</a>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>