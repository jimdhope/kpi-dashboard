<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Certificates';

// Include the admin header
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';



require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

// Logic for generating certificates goes here
// You may need to fetch user data or competition data based on your requirements

?>

<div class="container py-5">
    <h1 class="display-4 text-center">Generate Certificates</h1>
    <!-- Form for generating certificates -->
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?> 