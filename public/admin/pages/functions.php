<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';

$db = Database::getInstance()->getConnection();

function addPodToDatabase($podName, $podDescription, $podId = null) {
    global $db; // Use the global database instance

    if ($podId) {
        // Update existing pod
        $stmt = $db->prepare("UPDATE pods SET name = ?, description = ? WHERE id = ?");
        $stmt->execute([$podName, $podDescription, $podId]);
    } else {
        // Insert new pod
        $stmt = $db->prepare("INSERT INTO pods (name, description) VALUES (?, ?)");
        $stmt->execute([$podName, $podDescription]);
    }
}

// Check if the form is submitted for adding a pod
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pod_name']) && isset($_POST['pod_description'])) {
    $podName = $_POST['pod_name'];
    $podDescription = $_POST['pod_description'];
    $podId = isset($_POST['pod_id']) ? intval($_POST['pod_id']) : null;

    addPodToDatabase($podName, $podDescription, $podId);
    header("Location: /public/admin/pages/pods.php?message=Pod saved successfully");
    exit();
}

// Check if the form is submitted for assigning users to pods
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pod_id']) && isset($_POST['person_ids'])) {
    $podId = intval($_POST['pod_id']);
    $personIds = $_POST['person_ids']; // This will be an array of user IDs

    // Prepare the SQL statement for inserting into the pod_assignments table
    $stmt = $db->prepare("INSERT INTO pod_assignments (pod_id, staff_id) VALUES (?, ?)");

    // Loop through each user ID and insert into the database
    foreach ($personIds as $personId) {
        $stmt->execute([$podId, intval($personId)]);
    }

    header("Location: /public/admin/pages/pods.php?message=Users assigned to pod successfully");
    exit();
}

// Handle KPI rule submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ruleName'])) {
    try {
        $ruleName = $_POST['ruleName'];
        $rulePoints = intval($_POST['rulePoints']);
        $ruleEmoji = $_POST['ruleEmoji'] ?? '';
        $competitionId = intval($_POST['competition_id']);

        // Check if we're editing or creating
        if (isset($_POST['rule_id']) && !empty($_POST['rule_id'])) {
            // Update existing rule
            $stmt = $db->prepare("
                UPDATE competition_rules 
                SET name = ?, 
                    points = ?, 
                    emoji = ?, 
                    competition_id = ? 
                WHERE id = ?
            ");
            $stmt->execute([$ruleName, $rulePoints, $ruleEmoji, $competitionId, intval($_POST['rule_id'])]);
        } else {
            // Insert new rule
            $stmt = $db->prepare("
                INSERT INTO competition_rules (name, points, emoji, competition_id) 
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$ruleName, $rulePoints, $ruleEmoji, $competitionId]);
        }

        header("Location: /public/admin/pages/rules.php?message=Rule saved successfully");
        exit();
    } catch (PDOException $e) {
        header("Location: /public/admin/pages/rules.php?error=" . urlencode($e->getMessage()));
        exit();
    }
}

// Handle rule deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id']) && isset($_POST['action']) && $_POST['action'] === 'delete_rule') {
    try {
        $ruleId = intval($_POST['delete_id']);
        $stmt = $db->prepare("DELETE FROM competition_rules WHERE id = ?");
        $stmt->execute([$ruleId]);
        
        header("Location: /public/admin/pages/rules.php?message=Rule deleted successfully");
        exit();
    } catch (PDOException $e) {
        header("Location: /public/admin/pages/rules.php?error=Failed to delete rule: " . urlencode($e->getMessage()));
        exit();
    }
}

// Function to add or update a competition
function addOrUpdateCompetition($name, $startDate, $endDate, $competitionId = null) {
    global $db;

    if ($competitionId) {
        // Update existing competition
        $stmt = $db->prepare("UPDATE competitions SET name = ?, start_date = ?, end_date = ? WHERE id = ?");
        $stmt->execute([$name, $startDate, $endDate, $competitionId]);
    } else {
        // Insert new competition
        $stmt = $db->prepare("INSERT INTO competitions (name, start_date, end_date) VALUES (?, ?, ?)");
        $stmt->execute([$name, $startDate, $endDate]);
    }
}

// Function to add or update a team
function addOrUpdateTeam($teamName, $competitionId, $teamId = null) {
    global $db;

    if ($teamId) {
        // Update existing team
        $stmt = $db->prepare("UPDATE teams SET name = ?, competition_id = ? WHERE id = ?");
        $stmt->execute([$teamName, $competitionId, $teamId]);
    } else {
        // Insert new team
        $stmt = $db->prepare("INSERT INTO teams (name, competition_id) VALUES (?, ?)");
        $stmt->execute([$teamName, $competitionId]);
    }
}

// Check if the form is submitted for adding or editing a competition
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['competition_name']) && isset($_POST['start_date']) && isset($_POST['end_date'])) {
    $competitionName = $_POST['competition_name'];
    $startDate = $_POST['start_date'];
    $endDate = $_POST['end_date'];
    $competitionId = isset($_POST['competition_id']) ? intval($_POST['competition_id']) : null;

    addOrUpdateCompetition($competitionName, $startDate, $endDate, $competitionId);
    header("Location: /public/admin/pages/competitions.php?message=Competition saved successfully");
    exit();
}

// Check if the form is submitted for adding or editing a team
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['team_name']) && isset($_POST['competition_id'])) {
    $teamName = $_POST['team_name'];
    $competitionId = intval($_POST['competition_id']);
    $teamId = isset($_POST['team_id']) ? intval($_POST['team_id']) : null;

    addOrUpdateTeam($teamName, $competitionId, $teamId);
    header("Location: /public/admin/pages/teams.php?message=Team saved successfully");
    exit();
}

// Check if the form is submitted for deleting a team
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['team_id']) && isset($_POST['action']) && $_POST['action'] === 'delete_team') {
    $teamId = intval($_POST['team_id']);
    $stmt = $db->prepare("DELETE FROM teams WHERE id = ?");
    $stmt->execute([$teamId]);
    header("Location: /public/admin/pages/competitions.php?message=Team deleted successfully");
    exit();
}

// Check if the form is submitted for deleting a competition
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['competition_id']) && isset($_POST['action']) && $_POST['action'] === 'delete_competition') {
    $competitionId = intval($_POST['competition_id']);
    $stmt = $db->prepare("DELETE FROM competitions WHERE id = ?");
    $stmt->execute([$competitionId]);
    header("Location: /public/admin/pages/competitions.php?message=Competition deleted successfully");
    exit();
}

// Check if a competition ID is provided to fetch teams
if (isset($_GET['competition_id'])) {
    $competitionId = intval($_GET['competition_id']);
    $stmt = $db->prepare("SELECT * FROM teams WHERE competition_id = ?");
    $stmt->execute([$competitionId]);
    $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Return the teams as a JSON response
    header('Content-Type: application/json');
    echo json_encode($teams);
    exit();
}

// Check if a pod ID is provided to fetch members
if (isset($_GET['pod_id'])) {
    $podId = intval($_GET['pod_id']);
    $stmt = $db->prepare("SELECT users.* FROM users 
        JOIN pod_assignments ON users.id = pod_assignments.staff_id 
        WHERE pod_assignments.pod_id = ?");
    $stmt->execute([$podId]);
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Return the members as a JSON response
    header('Content-Type: application/json');
    echo json_encode($members);
    exit();
}

try {
    // Check if the form is submitted for assigning users to teams
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['team_id']) && isset($_POST['person_ids'])) {
        $teamId = intval($_POST['team_id']);
        $personIds = $_POST['person_ids']; // This will be an array of user IDs

        // Prepare the SQL statement for inserting into the user_team table
        $stmt = $db->prepare("INSERT INTO user_team (team_id, user_id) VALUES (?, ?)");

        // Loop through each user ID and insert into the database
        foreach ($personIds as $personId) {
            // Check if the user is already assigned to the team
            $checkStmt = $db->prepare("SELECT COUNT(*) FROM user_team WHERE team_id = ? AND user_id = ?");
            $checkStmt->execute([$teamId, intval($personId)]);
            $exists = $checkStmt->fetchColumn();

            if ($exists == 0) {
                // Only insert if the user is not already assigned to the team
                $stmt->execute([$teamId, intval($personId)]);
            }
        }

        header("Location: /public/admin/pages/teams.php?message=Users assigned to team successfully");
        exit();
    }
} catch (PDOException $e) {
    // Log the error message
    error_log("Database error: " . $e->getMessage());
    // Redirect with an error message
    header("Location: /public/admin/pages/teams.php?error=Database error occurred. Please try again.");
    exit();
}

// Add after existing POST handlers
if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
    isset($_POST['action']) && $_POST['action'] === 'remove_user_from_team' &&
    isset($_POST['team_id']) && isset($_POST['user_id'])) {
    
    try {
        $teamId = intval($_POST['team_id']);
        $userId = intval($_POST['user_id']);
        
        $stmt = $db->prepare("DELETE FROM user_team WHERE team_id = ? AND user_id = ?");
        $stmt->execute([$teamId, $userId]);
        
        header("Location: /public/admin/pages/teams.php?message=User removed from team successfully");
        exit();
    } catch (PDOException $e) {
        error_log("Error removing user from team: " . $e->getMessage());
        header("Location: /public/admin/pages/teams.php?error=Failed to remove user from team");
        exit();
    }
}

// Add this handler after existing POST handlers

if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
    isset($_POST['action']) && $_POST['action'] === 'assign_users' && 
    isset($_POST['team_id']) && isset($_POST['user_ids'])) {
    
    try {
        $teamId = intval($_POST['team_id']);
        $userIds = $_POST['user_ids'];
        
        $stmt = $db->prepare("INSERT INTO user_team (team_id, user_id) VALUES (?, ?)");
        
        foreach ($userIds as $userId) {
            // Check if assignment already exists
            $checkStmt = $db->prepare("SELECT COUNT(*) FROM user_team WHERE team_id = ? AND user_id = ?");
            $checkStmt->execute([$teamId, intval($userId)]);
            
            if ($checkStmt->fetchColumn() == 0) {
                $stmt->execute([$teamId, intval($userId)]);
            }
        }
        
        header("Location: /public/admin/pages/teams.php?message=Users assigned successfully");
        exit();
        
    } catch (PDOException $e) {
        error_log("Error assigning users to team: " . $e->getMessage());
        header("Location: /public/admin/pages/teams.php?error=Failed to assign users");
        exit();
    }
}

// Function to add a pod assignment
function addPodAssignment($podId, $staffId, $teamId) {
    global $db;
    $stmt = $db->prepare("INSERT INTO pod_assignments (pod_id, staff_id, team_id) VALUES (?, ?, ?)");
    $stmt->execute([$podId, $staffId, $teamId]);
}

// Function to update a pod assignment
function updatePodAssignment($podId, $staffId, $teamId) {
    global $db;
    $stmt = $db->prepare("UPDATE pod_assignments SET team_id = ? WHERE pod_id = ? AND staff_id = ?");
    $stmt->execute([$teamId, $podId, $staffId]);
}

// Function to delete a pod assignment
function deletePodAssignment($podId, $staffId) {
    global $db;
    $stmt = $db->prepare("DELETE FROM pod_assignments WHERE pod_id = ? AND staff_id = ?");
    $stmt->execute([$podId, $staffId]);
}

// Function to get pod assignments
function getPodAssignments($podId) {
    global $db;
    $stmt = $db->prepare("SELECT * FROM pod_assignments WHERE pod_id = ?");
    $stmt->execute([$podId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// Function to save scores
function saveScores($scores, $podId, $date, $competitionId) {
    $db = Database::getInstance()->getConnection();
    
    try {
        // Prepare statement
        $stmt = $db->prepare("
            INSERT INTO daily_scores 
            (user_id, rule_id, score, date, pod_id, competition_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        // Insert each score
        foreach ($scores as $userId => $userScores) {
            foreach ($userScores as $ruleId => $score) {
                $stmt->execute([
                    $userId,
                    $ruleId,
                    intval($score),
                    $date,
                    $podId,
                    $competitionId
                ]);
            }
        }
        return true;
    } catch (PDOException $e) {
        error_log("Score save error: " . $e->getMessage());
        return false;
    }
}

// Add this to functions.php after existing functions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_score') {
    header('Content-Type: application/json');
    
    try {
        $userId = intval($_POST['userId']);
        $ruleId = intval($_POST['ruleId']);
        $score = intval($_POST['score']);
        $podId = intval($_POST['podId']);
        $date = $_POST['date'];
        $competitionId = intval($_POST['competitionId']);

        $stmt = $db->prepare("
            INSERT INTO daily_scores (user_id, rule_id, score, date, pod_id, competition_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE score = VALUES(score)
        ");

        $stmt->execute([$userId, $ruleId, $score, $date, $podId, $competitionId]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        error_log("Score save error: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit();
}

// Add new functions at end of file
function getTeamPoints($podId, $startDate, $endDate) {
    global $db;
    $teamQuery = "
        WITH MemberPoints AS (
            SELECT 
                u.id,
                u.first_name,
                COALESCE(SUM(ds.score * cr.points), 0) as user_points
            FROM users u
            JOIN pod_assignments pa ON u.id = pa.staff_id AND pa.pod_id = ?
            LEFT JOIN daily_scores ds ON u.id = ds.user_id 
                AND ds.date BETWEEN ? AND ?
            LEFT JOIN competition_rules cr ON ds.rule_id = cr.id
            GROUP BY u.id, u.first_name
        )
        SELECT 
            c.name as competition_name,
            t.name as team_name,
            GROUP_CONCAT(DISTINCT mp.first_name ORDER BY mp.first_name SEPARATOR ', ') as members,
            COALESCE(SUM(mp.user_points), 0) as total_points
        FROM competitions c
        INNER JOIN teams t ON t.competition_id = c.id
        INNER JOIN user_team ut ON ut.team_id = t.id
        INNER JOIN MemberPoints mp ON mp.id = ut.user_id
        WHERE CURDATE() BETWEEN c.start_date AND c.end_date
        GROUP BY c.id, t.id, c.name, t.name
        ORDER BY c.name, total_points DESC";

    return $db->query($teamQuery, [$podId, $startDate, $endDate])->fetchAll(PDO::FETCH_ASSOC);
}

function getLeaderboardData($podId, $startDate, $endDate) {
    global $db;
    $leaderboardQuery = "
        SELECT 
            u.first_name,
            u.last_name,
            COALESCE(SUM(ds.score * cr.points), 0) as total_points
        FROM users u
        JOIN pod_assignments pa ON u.id = pa.staff_id
        LEFT JOIN daily_scores ds ON u.id = ds.user_id 
            AND ds.date BETWEEN ? AND ?
        LEFT JOIN competition_rules cr ON ds.rule_id = cr.id
        WHERE pa.pod_id = ?
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY total_points DESC";

    return $db->query($leaderboardQuery, [$startDate, $endDate, $podId])->fetchAll(PDO::FETCH_ASSOC);
}

// Add new function to get teams by competition
function getTeamsByCompetition($competitionId) {
    global $db;
    try {
        return $db->query(
            "SELECT id, name FROM teams WHERE competition_id = ? ORDER BY name",
            [intval($competitionId)]
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Error getting teams: " . $e->getMessage());
        return [];
    }
}

// Add AJAX endpoint near other GET handlers
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_teams') {
    header('Content-Type: application/json');
    $competitionId = isset($_GET['competition_id']) ? intval($_GET['competition_id']) : 0;
    $teams = getTeamsByCompetition($competitionId);
    echo json_encode($teams);
    exit();
}

// Add new function to get unassigned users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_unassigned_users') {
    header('Content-Type: application/json');
    
    $competitionId = isset($_GET['competition_id']) ? intval($_GET['competition_id']) : 0;
    $podId = isset($_GET['pod_id']) ? intval($_GET['pod_id']) : 0;
    
    $query = "
        SELECT DISTINCT u.id, u.first_name, u.last_name 
        FROM users u
        JOIN pod_assignments pa ON u.id = pa.staff_id
        WHERE pa.pod_id = ?
        AND NOT EXISTS (
            SELECT 1 
            FROM user_team ut
            JOIN teams t ON ut.team_id = t.id
            WHERE ut.user_id = u.id
            AND t.competition_id = ?
        )
        ORDER BY u.first_name, u.last_name";
    
    try {
        $users = $db->query($query, [$podId, $competitionId])->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($users);
    } catch (Exception $e) {
        error_log("Error getting unassigned users: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to get users']);
    }
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_pod_users') {
    header('Content-Type: application/json');
    $podId = isset($_GET['pod_id']) ? intval($_GET['pod_id']) : 0;
    
    $query = "
        SELECT DISTINCT u.id, u.first_name, u.last_name
        FROM users u
        JOIN pod_assignments pa ON u.id = pa.staff_id
        WHERE pa.pod_id = ?
        ORDER BY u.first_name, u.last_name";
    
    $users = $db->query($query, [$podId])->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($users);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_score') {
    error_log("Starting score update process");
    
    while (ob_get_level()) ob_end_clean();
    header('Content-Type: application/json');
    
    try {
        // Correct PDO connection check
        if (!$db) {
            throw new Exception('Database instance not available');
        }
        
        if (!isset($_POST['user_id'], $_POST['rule_id'], $_POST['pod_id'], $_POST['date'], $_POST['competition_id'])) {
            throw new Exception('Missing required fields');
        }

        $userId = intval($_POST['user_id']);
        $ruleId = intval($_POST['rule_id']);
        $score = $_POST['score'] === '' ? null : intval($_POST['score']);
        $podId = intval($_POST['pod_id']);
        $date = $_POST['date'];
        $competitionId = intval($_POST['competition_id']);

        $query = "INSERT INTO daily_scores (user_id, rule_id, score, date, pod_id, competition_id) 
                 VALUES (?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE score = VALUES(score)";
        
        $stmt = $db->prepare($query);
        $result = $stmt->execute([$userId, $ruleId, $score, $date, $podId, $competitionId]);
        
        if (!$result) {
            throw new Exception('Failed to update score');
        }

        echo json_encode(['success' => true]);
        exit;

    } catch (Exception $e) {
        error_log("Score update error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
        exit;
    }
}
// Add Weekly Scores functions

function getPodTargets($podId, $selectedRules = []) {
    global $db;
    $query = "
        SELECT pt.*, cr.name as rule_name, cr.emoji 
        FROM pod_targets pt
        JOIN competition_rules cr ON pt.rule_id = cr.id
        WHERE pt.pod_id = ? AND pt.rule_id IN (?)";
    
    return $db->query($query, [$podId, implode(',', $selectedRules)])->fetchAll(PDO::FETCH_ASSOC);
}

// Update the target update handler
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_targets') {
    header('Content-Type: application/json');
    
    try {
        $podId = $_POST['pod_id'] ?? null;
        $rule1Id = $_POST['rule1'] ?? null;
        $rule2Id = $_POST['rule2'] ?? null;
        $target1 = isset($_POST['target1']) ? intval($_POST['target1']) : null;
        $target2 = isset($_POST['target2']) ? intval($_POST['target2']) : null;
        
        $dbConnection = Database::getInstance()->getConnection();
        
        // Start transaction
        $dbConnection->beginTransaction();
        
        try {
            // First delete existing targets
            $stmt = $dbConnection->prepare("DELETE FROM pod_targets WHERE pod_id = ?");
            $stmt->execute([$podId]);
            
            // Prepare insert statement
            $stmt = $dbConnection->prepare("
                INSERT INTO pod_targets (pod_id, rule_id, target_value) 
                VALUES (?, ?, ?)
            ");
            
            // Insert new targets
            if ($rule1Id && $target1 !== null) {
                $stmt->execute([$podId, $rule1Id, $target1]);
            }
            
            if ($rule2Id && $target2 !== null) {
                $stmt->execute([$podId, $rule2Id, $target2]);
            }
            
            // Commit transaction
            $dbConnection->commit();
            
            // Get updated totals
            $ruleTotals = [];
            if ($rule1Id || $rule2Id) {
                $rules = array_filter([$rule1Id, $rule2Id]);
                $placeholders = str_repeat('?,', count($rules) - 1) . '?';
                
                $stmt = $dbConnection->prepare("
                    SELECT cr.id, cr.name, pt.target_value,
                           COALESCE(SUM(ds.score), 0) as current_score
                    FROM competition_rules cr
                    LEFT JOIN pod_targets pt ON cr.id = pt.rule_id AND pt.pod_id = ?
                    LEFT JOIN daily_scores ds ON cr.id = ds.rule_id AND ds.pod_id = ?
                    WHERE cr.id IN ({$placeholders})
                    GROUP BY cr.id, cr.name, pt.target_value
                ");
                
                $params = array_merge([$podId, $podId], $rules);
                $stmt->execute($params);
                
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $ruleTotals[$row['id']] = [
                        'name' => $row['name'],
                        'target' => $row['target_value'],
                        'current' => $row['current_score']
                    ];
                }
            }
            
            echo json_encode([
                'success' => true,
                'ruleTotals' => $ruleTotals
            ]);
            
        } catch (Exception $e) {
            $dbConnection->rollBack();
            throw $e;
        }
        
    } catch (Exception $e) {
        error_log("Target update error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

function calculateRuleTotals($podId, $ruleIds) {
    global $db;
    $totals = [];
    
    foreach ($ruleIds as $ruleId) {
        if (!$ruleId) continue;
        
        $stmt = $db->prepare("
            SELECT cr.name, pt.target_value, COALESCE(SUM(ds.score), 0) as current_total
            FROM competition_rules cr
            LEFT JOIN pod_targets pt ON cr.id = pt.rule_id AND pt.pod_id = ?
            LEFT JOIN daily_scores ds ON cr.id = ds.rule_id AND ds.pod_id = ?
            WHERE cr.id = ?
            GROUP BY cr.id, cr.name, pt.target_value
        ");
        
        $stmt->execute([$podId, $podId, $ruleId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            $totals[$ruleId] = [
                'name' => $result['name'],
                'current' => $result['current_total'],
                'target' => $result['target_value']
            ];
        }
    }
    
    return $totals;
}

// Add after existing functions
function assignPodRandomlyToTeams($dbConnection, $podId, $competitionId) {
    try {
        // Start transaction
        $dbConnection->beginTransaction();
        
        // Get pod members
        $stmt = $dbConnection->prepare("
            SELECT staff_id 
            FROM pod_assignments 
            WHERE pod_id = ?
        ");
        $stmt->execute([$podId]);
        $members = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($members)) {
            throw new Exception('No members found in pod');
        }

        // Get teams from competition
        $stmt = $dbConnection->prepare("
            SELECT id 
            FROM teams 
            WHERE competition_id = ?
        ");
        $stmt->execute([$competitionId]);
        $teams = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($teams)) {
            throw new Exception('No teams found in competition');
        }

        // Remove existing assignments
        $stmt = $dbConnection->prepare("
            DELETE FROM user_team 
            WHERE user_id IN (SELECT staff_id FROM pod_assignments WHERE pod_id = ?)
            AND team_id IN (SELECT id FROM teams WHERE competition_id = ?)
        ");
        $stmt->execute([$podId, $competitionId]);

        // Shuffle members
        shuffle($members);

        // Calculate members per team to distribute evenly
        $membersPerTeam = ceil(count($members) / count($teams));

        // Assign members to teams
        $stmt = $dbConnection->prepare("
            INSERT INTO user_team (user_id, team_id) 
            VALUES (?, ?)
        ");

        foreach ($members as $index => $memberId) {
            $teamIndex = floor($index / $membersPerTeam);
            if (isset($teams[$teamIndex])) {
                $stmt->execute([$memberId, $teams[$teamIndex]]);
            }
        }

        $dbConnection->commit();
        return true;

    } catch (Exception $e) {
        $dbConnection->rollBack();
        error_log("Random assignment error: " . $e->getMessage());
        return false;
    }
}

// Add new POST handler
if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
    isset($_POST['action']) && $_POST['action'] === 'random_assign' &&
    isset($_POST['pod_id']) && isset($_POST['competition_id'])) {

    $podId = intval($_POST['pod_id']);
    $competitionId = intval($_POST['competition_id']);
    
    if (assignPodRandomlyToTeams($db, $podId, $competitionId)) {
        header("Location: /public/admin/pages/teams.php?message=Pod members randomly assigned successfully");
    } else {
        header("Location: /public/admin/pages/teams.php?error=Failed to assign pod members");
    }
    exit();
}

// Add after existing POST handlers
if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
    isset($_POST['action']) && $_POST['action'] === 'random_assign' &&
    isset($_POST['pod_id']) && isset($_POST['competition_id'])) {
    
    try {
        $podId = intval($_POST['pod_id']);
        $competitionId = intval($_POST['competition_id']);
        
        if (assignPodRandomlyToTeams($db, $podId, $competitionId)) {
            header("Location: /public/admin/pages/teams.php?message=Pod members randomly assigned successfully");
        } else {
            header("Location: /public/admin/pages/teams.php?error=Failed to assign pod members");
        }
        exit();
    } catch (PDOException $e) {
        error_log("Error assigning pod members: " . $e->getMessage());
        header("Location: /public/admin/pages/teams.php?error=Failed to assign pod members");
        exit();
    }
}

// Handle user submissions (add/edit)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
    isset($_POST['first_name']) && isset($_POST['last_name'])) {
    try {
        $firstName = $_POST['first_name'];
        $lastName = $_POST['last_name'];
        $editId = isset($_POST['edit_id']) ? intval($_POST['edit_id']) : null;

        if ($editId) {
            // Update existing user
            $stmt = $db->prepare("
                UPDATE users 
                SET first_name = ?, last_name = ?
                WHERE id = ?
            ");
            $stmt->execute([$firstName, $lastName, $editId]);
        } else {
            // Insert new user
            $stmt = $db->prepare("
                INSERT INTO users (first_name, last_name) 
                VALUES (?, ?)
            ");
            $stmt->execute([$firstName, $lastName]);
        }

        header("Location: /public/admin/pages/people.php?message=User saved successfully");
        exit();
    } catch (PDOException $e) {
        error_log("Error saving user: " . $e->getMessage());
        header("Location: /public/admin/pages/people.php?error=Failed to save user");
        exit();
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
    isset($_POST['action']) && $_POST['action'] === 'update_targets') {
    try {
        $podId = intval($_POST['pod_id']);
        $date = $_POST['date'];
        $rule1Id = !empty($_POST['rule1']) ? intval($_POST['rule1']) : null;
        $rule2Id = !empty($_POST['rule2']) ? intval($_POST['rule2']) : null;
        $target1 = isset($_POST['target1']) ? intval($_POST['target1']) : null;
        $target2 = isset($_POST['target2']) ? intval($_POST['target2']) : null;

        $db->beginTransaction();
        
        // Delete existing targets for this pod and date
        $stmt = $db->prepare("DELETE FROM pod_targets WHERE pod_id = ? AND date = ?");
        $stmt->execute([$podId, $date]);
        
        // Insert new targets with date
        $stmt = $db->prepare("
            INSERT INTO pod_targets (pod_id, rule_id, target_value, date) 
            VALUES (?, ?, ?, ?)
        ");
        
        if ($rule1Id && $target1 !== null) {
            $stmt->execute([$podId, $rule1Id, $target1, $date]);
        }
        if ($rule2Id && $target2 !== null) {
            $stmt->execute([$podId, $rule2Id, $target2, $date]);
        }

        $db->commit();
        echo json_encode(['success' => true]);
        exit();
        
    } catch (Exception $e) {
        $db->rollBack();
        error_log("Target update error: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}