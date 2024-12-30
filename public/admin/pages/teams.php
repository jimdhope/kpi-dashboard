<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

function getCompetitionTeams($db, $competitionId) {
    $stmt = $db->prepare("SELECT id FROM teams WHERE competition_id = ?");
    $stmt->execute([$competitionId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

// Update function to use PDO connection
function randomlyAssignPodToTeams($dbConnection, $podId, $competitionId) {
    try {
        $dbConnection->beginTransaction();
        
        // Get pod members
        $stmt = $dbConnection->prepare("SELECT staff_id FROM pod_assignments WHERE pod_id = ?");
        $stmt->execute([$podId]);
        $members = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Get teams for competition
        $stmt = $dbConnection->prepare("SELECT id FROM teams WHERE competition_id = ?");
        $stmt->execute([$competitionId]);
        $teams = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($members) || empty($teams)) {
            throw new Exception('No members or teams found');
        }

        // Clear existing assignments
        $stmt = $dbConnection->prepare("
            DELETE FROM user_team 
            WHERE user_id IN (SELECT staff_id FROM pod_assignments WHERE pod_id = ?)
            AND team_id IN (SELECT id FROM teams WHERE competition_id = ?)
        ");
        $stmt->execute([$podId, $competitionId]);

        // Randomly assign members
        shuffle($members);
        $membersPerTeam = ceil(count($members) / count($teams));
        
        foreach ($members as $index => $memberId) {
            $teamIndex = floor($index / $membersPerTeam);
            if (isset($teams[$teamIndex])) {
                $stmt = $dbConnection->prepare("INSERT INTO user_team (user_id, team_id) VALUES (?, ?)");
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

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['random_assign'])) {
    $dbConnection = Database::getInstance()->getConnection();
    $podId = filter_input(INPUT_POST, 'pod_id', FILTER_VALIDATE_INT);
    $competitionId = filter_input(INPUT_POST, 'competition_id', FILTER_VALIDATE_INT);
    
    if ($podId && $competitionId) {
        if (randomlyAssignPodToTeams($dbConnection, $podId, $competitionId)) {
            header("Location: teams.php?filterCompetition=" . $competitionId);
            exit;
        }
    }
}

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Teams';

// Get all competitions
$competitions = $db->query("SELECT * FROM competitions ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);

// After getting competitions, add filter handling
$selectedCompetition = isset($_GET['filterCompetition']) ? intval($_GET['filterCompetition']) : null;

// Modify teams query to include filter
$teamsQuery = "
    SELECT t.*, c.name as competition_name, 
           GROUP_CONCAT(CONCAT(u.first_name, ' ', u.last_name) SEPARATOR ', ') as members
    FROM teams t
    LEFT JOIN competitions c ON t.competition_id = c.id
    LEFT JOIN user_team ut ON t.id = ut.team_id
    LEFT JOIN users u ON ut.user_id = u.id";

if ($selectedCompetition) {
    $teamsQuery .= " WHERE t.competition_id = ?";
    $params = [$selectedCompetition];
} else {
    $params = [];
}

$teamsQuery .= " GROUP BY t.id, t.name, t.competition_id, c.name ORDER BY c.name, t.name";

// Debug query
error_log("Teams Query: " . $teamsQuery);
error_log("Params: " . print_r($params, true));

$teams = $db->query($teamsQuery, $params)->fetchAll(PDO::FETCH_ASSOC);

// Initialize variables for the form
$teamName = '';
$action = 'Add Team'; // Default action

// Check if an edit is requested
if (isset($_GET['edit_id'])) {
    $editId = intval($_GET['edit_id']);
    $team = $db->query("SELECT * FROM teams WHERE id = ?", [$editId])->fetch(PDO::FETCH_ASSOC);
    
    if ($team) {
        $teamName = htmlspecialchars($team['name'] ?? '');
        $action = 'Edit Team'; // Change action to Edit
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
    <h1 class="mb-4">Teams</h1>

    <div class="row">
        <!-- Left Column Forms -->
        <div class="col-lg-8">
            <!-- Add/Edit Team Form -->
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="h5 mb-0"><?php echo $action; ?></h2>
                </div>
                <div class="card-body">
                    <form method="POST" action="functions.php" id="teamForm">
                        <div class="mb-3">
                            <label class="form-label">Team Name</label>
                            <input type="text" name="team_name" class="form-control" value="<?php echo $teamName; ?>" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Select Competition</label>
                            <select name="competition_id" class="form-select" required>
                                <option value="">Select Competition</option>
                                <?php 
                                foreach ($competitions as $competition): 
                                ?>
                                <option value="<?php echo $competition['id']; ?>">
                                    <?php echo htmlspecialchars($competition['name']); ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <input type="hidden" name="team_id" value="<?php echo isset($editId) ? $editId : ''; ?>">
                        <button type="submit" class="btn btn-primary"><?php echo $action; ?></button>
                    </form>
                </div>
            </div>

            <!-- Random Pod Assignment -->
            <div class="card mb-4">
                <div class="card-header">
                    <h3>Random Pod Assignment</h3>
                </div>
                <div class="card-body">
                    <form id="randomAssignForm" class="row g-3" method="POST" action="">
                        <div class="col-md-4">
                            <label class="form-label">Select Pod</label>
                            <select name="pod_id" class="form-select" required>
                                <option value="">Choose Pod...</option>
                                <?php
                                $pods = $db->query("SELECT id, name FROM pods ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
                                foreach ($pods as $pod) {
                                    echo "<option value='{$pod['id']}'>{$pod['name']}</option>";
                                }
                                ?>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Select Competition</label>
                            <select name="competition_id" class="form-select" required>
                                <option value="">Choose Competition...</option>
                                <?php
                                foreach ($competitions as $competition) {
                                    echo "<option value='{$competition['id']}'>{$competition['name']}</option>";
                                }
                                ?>
                            </select>
                        </div>
                        <div class="col-md-4 d-flex align-items-end">
                            <button type="submit" class="btn btn-primary" name="random_assign">
                                Randomly Assign Users
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Assign Users to Teams -->
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="h5 mb-0">Assign Users to Teams</h2>
                </div>
                <div class="card-body">
                    <form method="POST" action="functions.php">
                        <input type="hidden" name="action" value="assign_users">
                        
                        <div class="row mb-3">
                            <!-- Competition Select -->
                            <div class="col-md-6">
                                <label class="form-label">Select Competition</label>
                                <select id="assignCompetition" name="competition_id" class="form-select" required>
                                    <option value="">Select Competition</option>
                                    <?php foreach ($competitions as $competition): ?>
                                        <option value="<?php echo $competition['id']; ?>">
                                            <?php echo htmlspecialchars($competition['name']); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>

                            <!-- Team Select -->
                            <div class="col-md-6">
                                <label class="form-label">Select Team</label>
                                <select id="assignTeam" name="team_id" class="form-select" required>
                                    <option value="">Select Competition First</option>
                                </select>
                            </div>
                        </div>

                        <div class="row mb-3">
                            <!-- Pod Select -->
                            <div class="col-md-12">
                                <label class="form-label">Select Pod</label>
                                <select id="assignPod" name="pod_id" class="form-select" required>
                                    <option value="">Select Pod</option>
                                    <?php 
                                    $pods = $db->query("SELECT * FROM pods ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
                                    foreach ($pods as $pod): 
                                    ?>
                                        <option value="<?php echo $pod['id']; ?>">
                                            <?php echo htmlspecialchars($pod['name']); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                        </div>

                        <!-- Users Multiple Select -->
                        <div class="mb-3">
                            <label class="form-label">Select Users to Assign</label>
                            <select id="assignUsers" name="user_ids[]" class="form-select" multiple size="8" required>
                                <option value="">Select Pod First</option>
                            </select>
                        </div>

                        <button type="submit" class="btn btn-primary">Assign Users to Team</button>
                    </form>
                </div>
                <script>
                document.getElementById('assignCompetition').addEventListener('change', function() {
                    const competitionId = this.value;
                    const teamSelect = document.getElementById('assignTeam');
                    
                    teamSelect.innerHTML = '<option value="">Select Team</option>';
                    
                    if (competitionId) {
                        fetch(`functions.php?action=get_teams&competition_id=${competitionId}`)
                            .then(response => response.json())
                            .then(teams => {
                                teams.forEach(team => {
                                    const option = document.createElement('option');
                                    option.value = team.id;
                                    option.textContent = team.name;
                                    teamSelect.appendChild(option);
                                });
                            });
                    }
                });

                document.getElementById('assignPod').addEventListener('change', function() {
                    const podId = this.value;
                    const userSelect = document.getElementById('assignUsers');
                    
                    userSelect.innerHTML = '<option value="">Loading users...</option>';
                    
                    if (podId) {
                        fetch(`functions.php?action=get_pod_users&pod_id=${podId}`)
                            .then(response => response.json())
                            .then(users => {
                                userSelect.innerHTML = users.length > 0 
                                    ? users.map(user => 
                                        `<option value="${user.id}">${user.first_name} ${user.last_name}</option>`
                                    ).join('')
                                    : '<option value="">No users found in this pod</option>';
                            });
                    }
                });
                </script>
            </div>

            <script>
            document.getElementById('assignCompetition').addEventListener('change', updateUserList);
            document.getElementById('assignPod').addEventListener('change', updateUserList);

            function updateUserList() {
                const competitionId = document.getElementById('assignCompetition').value;
                const podId = document.getElementById('assignPod').value;
                const userSelect = document.getElementById('assignUsers');

                if (competitionId && podId) {
                    fetch(`functions.php?action=get_unassigned_users&competition_id=${competitionId}&pod_id=${podId}`)
                        .then(response => response.json())
                        .then(users => {
                            userSelect.innerHTML = users.length > 0 
                                ? users.map(user => `<option value="${user.id}">${user.first_name} ${user.last_name}</option>`).join('')
                                : '<option value="">No unassigned users found</option>';
                        });
                }
            }

            document.getElementById('assignPod').addEventListener('change', function() {
                const podId = this.value;
                const userSelect = document.getElementById('assignUsers');
                
                userSelect.innerHTML = '<option value="">Loading users...</option>';
                
                if (podId) {
                    fetch(`functions.php?action=get_pod_users&pod_id=${podId}`)
                        .then(response => response.json())
                        .then(users => {
                            userSelect.innerHTML = users.length > 0 
                                ? users.map(user => 
                                    `<option value="${user.id}">${user.first_name} ${user.last_name}</option>`
                                ).join('')
                                : '<option value="">No users found in this pod</option>';
                        })
                        .catch(error => console.error('Error:', error));
                }
            });
            </script>
        </div>

        <!-- Right Column - Teams List -->
        <div class="col-lg-4">
            <div class="card">
                <div class="card-header">
                    <h2 class="h5 mb-0">Current Teams</h2>
                    <form method="GET" class="mt-3">
                        <select name="filterCompetition" class="form-select" onchange="this.form.submit()">
                            <option value="">All Competitions</option>
                            <?php foreach ($competitions as $competition): ?>
                                <option value="<?php echo $competition['id']; ?>" 
                                        <?php echo $selectedCompetition == $competition['id'] ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($competition['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </form>
                </div>
                <div class="card-body p-0">
                    <?php
                    $currentCompetition = null;
                    foreach ($teams as $team):
                        if ($currentCompetition !== $team['competition_name']):
                            if ($currentCompetition !== null): ?>
                                </div>
                            <?php endif; 
                            $currentCompetition = $team['competition_name'];
                            ?>
                            <div class="competition-section border-bottom p-3">
                                <h2 class="mb-3"><?php echo htmlspecialchars($currentCompetition); ?></h2>
                        <?php endif; ?>
                        
                        <div class="team-item mb-3 ps-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <h3 class="h5 mb-2"><?php echo htmlspecialchars($team['name']); ?></h3>
                                <div class="team-actions">
                                    <a href="?edit_id=<?php echo $team['id']; ?>" 
                                       class="btn btn-sm btn-link">Edit</a>
                                    <button onclick="deleteTeam(<?php echo $team['id']; ?>)" 
                                            class="btn btn-sm btn-link text-danger">Remove</button>
                                </div>
                            </div>
                            <?php if ($team['members']): ?>
                                <div class="team-members ps-3">
                                    <?php 
                                    $members = explode(', ', $team['members']);
                                    foreach ($members as $member): ?>
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <p class="mb-0"><?php echo htmlspecialchars($member); ?></p>
                                            <button onclick="removeMember(<?php echo $team['id']; ?>, '<?php echo htmlspecialchars($member); ?>')" 
                                                    class="btn btn-sm btn-link text-danger p-0">Remove</button>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                    <?php if ($currentCompetition !== null): ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.competition-section:not(:last-child) {
    border-bottom: 1px solid rgba(0,0,0,.125);
}
.team-actions {
    white-space: nowrap;
}
.btn-link {
    text-decoration: none;
    padding: 0.25rem 0.5rem;
}
</style>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>