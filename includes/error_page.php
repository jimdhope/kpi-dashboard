<?php
if (!headers_sent()) {
    http_response_code(500);
}

// Display the error message if available
$error_message = isset($error_message) ? htmlspecialchars($error_message) : 'Unknown error';
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - <?php echo defined('APP_NAME') ? APP_NAME : 'Competition Tracker'; ?></title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <center>
    <div class="container">
        <h1>Oops! Something went wrong</h1>
        <div class="alert alert-danger">
            <?php echo $error_message; // Display the error message ?>
        </div>
        <a href="/" class="btn btn-primary">Go Home</a>
    </div>
    </center>
</body>
</html> 