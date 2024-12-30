<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars(APP_NAME); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="/public/css/main.css" rel="stylesheet">
    <link rel="stylesheet" href="/public/css/theme.php">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="/public/index.php"><?php echo htmlspecialchars(APP_NAME); ?></a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a href="/public/admin/pages/dashboard.php" class="nav-link">Dashboard</a>
                    </li>
                    <li class="nav-item dropdown">
                        <button class="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                            Management
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/public/admin/pages/people.php">People</a></li>
                            <li><a class="dropdown-item" href="/public/admin/pages/pods.php">Pods</a></li>
                            <li><a class="dropdown-item" href="/public/admin/pages/teams.php">Teams</a></li>
                            <li><a class="dropdown-item" href="/public/admin/pages/rules.php">Rules</a></li>
                            <li><a class="dropdown-item" href="/public/admin/pages/competitions.php">Competitions</a></li>
                            <li><a class="dropdown-item" href="/public/admin/pages/scores.php">Scores</a></li>
                        </ul>
                    </li>
                    <li class="nav-item dropdown">
                        <button class="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                            Scorecards
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/public/admin/pages/results.php">Daily Scorecard</a></li>
                            <li><a class="dropdown-item" href="/public/admin/pages/weekly_scores.php">Weekly Scorecard</a></li>
                        </ul>
                    </li>
                    <li class="nav-item">
                        <a href="/public/admin/pages/settings.php" class="nav-link">Settings</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>