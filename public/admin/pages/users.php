<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Users';

// Get all users
$users = $db->query("SELECT * FROM users ORDER BY last_name")->fetchAll(PDO::FETCH_ASSOC);

$pageTitle = 'Users';
$headerButtons = '<a href="' . SITE_URL . '/admin/pages/users/add.php" class="btn btn-primary">Add User</a>';
?>

<!-- Users list -->
<div class="container py-5">
    <h1 class="mb-4">Users</h1>
    
    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($users as $user): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($user['first_name']); ?></td>
                            <td><?php echo htmlspecialchars($user['last_name']); ?></td>
                            <td><?php echo htmlspecialchars($user['email']); ?></td>
                            <td>
                                <a href="<?php echo SITE_URL; ?>/admin/pages/users/edit.php?id=<?php echo $user['id']; ?>" class="btn btn-sm btn-primary">Edit</a>
                                <a href="<?php echo SITE_URL; ?>/admin/pages/users/delete.php?id=<?php echo $user['id']; ?>" class="btn btn-sm btn-danger" onclick="return confirm('Are you sure you want to delete this user?');">Delete</a>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?> 