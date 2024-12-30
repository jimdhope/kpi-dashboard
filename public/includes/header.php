<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($settings['APP_NAME']) ? $settings['APP_NAME'] : 'KPI Competition'; ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/public/css/main.css">
    <link rel="stylesheet" href="/public/css/theme.php">
</head>
<body>
    <header>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container d-flex justify-content-between align-items-center">
            <h1 class="navbar-brand mb-0"><?php echo htmlspecialchars(APP_NAME); ?></h1>
            <div class="nav-buttons">
                <a href="/admin/pages/dashboard.php" class="btn btn-outline-light">Admin Area</a>
            </div>
        </div>
    </nav>
    </header>
    <main>
</body>
</html>