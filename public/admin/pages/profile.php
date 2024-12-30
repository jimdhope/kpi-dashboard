<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Profile';

// Fetch user profile
$user = $db->query("SELECT * FROM users WHERE id = ?", [$userId])->fetch(PDO::FETCH_ASSOC);

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Validate email
        if (!filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email address');
        }

        // Update user profile
        $stmt = $db->prepare(
            "UPDATE users SET 
            email = ?, 
            first_name = ?, 
            last_name = ?, 
            updated_at = NOW() 
            WHERE id = ?"
        );
        $stmt->execute([$_POST['email'], $_POST['first_name'], $_POST['last_name'], $userId]);

        // Handle password change if requested
        if (!empty($_POST['new_password'])) {
            if (strlen($_POST['new_password']) < 8) {
                throw new Exception('Password must be at least 8 characters long');
            }
            
            $hashedPassword = password_hash($_POST['new_password'], PASSWORD_DEFAULT);
            $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
            $stmt->execute([$hashedPassword, $userId]);
        }
    } catch (Exception $e) {
        // Handle exception
    }
}

$pageTitle = 'My Profile';
$headerButtons = ''; // Add any buttons if needed
?>

<div class="container py-5">
    <h1 class="display-4 text-center">Profile</h1>
    <div class="section">
        <form method="POST">
            <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" name="email" id="email" class="form-control" value="<?php echo htmlspecialchars($user['email']); ?>" required>
            </div>
            <div class="mb-3">
                <label for="first_name" class="form-label">First Name</label>
                <input type="text" name="first_name" id="first_name" class="form-control" value="<?php echo htmlspecialchars($user['first_name']); ?>" required>
            </div>
            <div class="mb-3">
                <label for="last_name" class="form-label">Last Name</label>
                <input type="text" name="last_name" id="last_name" class="form-control" value="<?php echo htmlspecialchars($user['last_name']); ?>" required>
            </div>
            <div class="mb-3">
                <label for="new_password" class="form-label">New Password</label>
                <input type="password" name="new_password" id="new_password" class="form-control">
                <small class="form-text text-muted">Leave blank if you don't want to change the password.</small>
            </div>
            <button type="submit" class="btn btn-primary">Update Profile</button>
        </form>
    </div>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?> 