<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/bootstrap.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/header.php';

// Initialize variables
$db = Database::getInstance();
$pageTitle = 'Daily Results';

// Get selections
$selectedDate = $_GET['date'] ?? date('Y-m-d');
$selectedPod = $_GET['pod'] ?? '';

// Get saved targets first
$savedTargets = [];
if ($selectedPod) {
    $savedTargets = $db->query("
        SELECT pt.rule_id, pt.target_value, cr.name as rule_name
        FROM pod_targets pt
        JOIN competition_rules cr ON pt.rule_id = cr.id
        WHERE pt.pod_id = ?", 
        [$selectedPod])->fetchAll(PDO::FETCH_ASSOC);

    // Set default selections from saved targets
    if (!empty($savedTargets)) {
        $selectedRule1 = $_GET['rule1'] ?? $savedTargets[0]['rule_id'] ?? '';
        $selectedRule2 = $_GET['rule2'] ?? ($savedTargets[1]['rule_id'] ?? '');
        $target1 = isset($_GET['target1']) ? intval($_GET['target1']) : $savedTargets[0]['target_value'] ?? 0;
        $target2 = isset($_GET['target2']) ? intval($_GET['target2']) : $savedTargets[1]['target_value'] ?? 0;
    } else {
        $selectedRule1 = $_GET['rule1'] ?? '';
        $selectedRule2 = $_GET['rule2'] ?? '';
        $target1 = isset($_GET['target1']) && $_GET['target1'] !== '' ? intval($_GET['target1']) : null;
        $target2 = isset($_GET['target2']) && $_GET['target2'] !== '' ? intval($_GET['target2']) : null;
    }
}

// Only save if target values have been explicitly set
if ($selectedPod && (isset($_GET['target1']) || isset($_GET['target2']))) {
    $dbConnection = $db->getConnection();
    $stmt = $dbConnection->prepare("
        INSERT INTO pod_targets (pod_id, rule_id, target_value, date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE target_value = VALUES(target_value), date = VALUES(date)
    ");
    
    if ($selectedRule1 && isset($_GET['target1'])) {
        $stmt->execute([$selectedPod, $selectedRule1, $target1, $selectedDate]);
    }
    if ($selectedRule2 && isset($_GET['target2'])) {
        $stmt->execute([$selectedPod, $selectedRule2, $target2, $selectedDate]);
    }
}

// Fetch pods for dropdown
$pods = $db->query("SELECT * FROM pods ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);

// Fetch all rules for dropdowns and key
$rules = $db->query("
    SELECT DISTINCT cr.* 
    FROM competition_rules cr
    JOIN daily_scores ds ON cr.id = ds.rule_id
    WHERE ds.pod_id = ?", 
    [$selectedPod])->fetchAll(PDO::FETCH_ASSOC);

// Get all pod members first
if ($selectedPod) {
    $podMembers = $db->query("
        SELECT DISTINCT
            u.id,
            u.first_name
        FROM users u
        JOIN pod_assignments pa ON u.id = pa.staff_id
        WHERE pa.pod_id = ?
        ORDER BY u.first_name",
        [$selectedPod]
    )->fetchAll(PDO::FETCH_ASSOC);

    // Get scores separately
    $scores = $db->query("
        SELECT 
            u.id,
            u.first_name,
            cr.emoji,
            cr.points,
            ds.score,
            COALESCE((ds.score * cr.points), 0) as total_points,
            ds.rule_id
        FROM users u
        JOIN pod_assignments pa ON u.id = pa.staff_id
        LEFT JOIN daily_scores ds ON (u.id = ds.user_id AND ds.date = ?)
        LEFT JOIN competition_rules cr ON ds.rule_id = cr.id
        WHERE pa.pod_id = ? AND ds.score > 0",
        [$selectedDate, $selectedPod]
    )->fetchAll(PDO::FETCH_ASSOC);

    // Initialize display results for all members
    $displayResults = [];
    foreach ($podMembers as $member) {
        $displayResults[$member['first_name']] = [
            'emojis' => '',
            'total' => 0
        ];
    }

    // Add scores where they exist
    foreach ($scores as $row) {
        $name = $row['first_name'];
        if (!empty($row['emoji']) && !empty($row['score'])) {
            $displayResults[$name]['emojis'] .= str_repeat($row['emoji'], $row['score']);
            $displayResults[$name]['total'] += $row['total_points'];
        }
    }

    // Calculate rule totals
    $ruleTotals = [];
    foreach ($scores as $row) {
        if (!empty($row['rule_id'])) {
            if (!isset($ruleTotals[$row['rule_id']])) {
                $ruleTotals[$row['rule_id']] = 0;
            }
            $ruleTotals[$row['rule_id']] += (int)$row['score'];
        }
    }
}

// Format content for Teams
$teamsFormattedContent = '';
if ($selectedPod && !empty($results)) {
    // Rules Key Header
    $teamsFormattedContent .= "Competition Results\r\n\r\n";
    foreach ($rules as $rule) {
        $teamsFormattedContent .= str_pad($rule['emoji'] . ' ' . $rule['name'], 25) . 
                                 '(' . $rule['points'] . ' pts) | ';
    }
    $teamsFormattedContent = rtrim($teamsFormattedContent, " | ") . "\r\n\r\n";

    // Create HTML table
    $teamsFormattedContent .= "<table>\n";
    
    // Table Header
    $teamsFormattedContent .= "<tr>\n";
    $teamsFormattedContent .= "<td width='150'>Name</td>\n";
    $teamsFormattedContent .= "<td width='400'>Wins</td>\n";
    $teamsFormattedContent .= "<td width='100'>Points</td>\n";
    $teamsFormattedContent .= "</tr>\n";
    
    // Table Content
    foreach ($displayResults as $name => $data) {
        $teamsFormattedContent .= "<tr>\n";
        $teamsFormattedContent .= "<td>" . $name . "</td>\n";
        $teamsFormattedContent .= "<td>" . $data['emojis'] . "</td>\n";
        $teamsFormattedContent .= "<td>" . $data['total'] . "</td>\n";
        $teamsFormattedContent .= "</tr>\n";
    }
    
    $teamsFormattedContent .= "</table>\n";

    // Targets Footer
    if ($selectedRule1 || $selectedRule2) {
        $teamsFormattedContent .= "\r\nDaily Targets:\r\n";
        if ($selectedRule1) {
            $ruleName = $rules[array_search($selectedRule1, array_column($rules, 'id'))]['name'];
            $teamsFormattedContent .= str_pad($ruleName . ": " . 
                                    $ruleTotals[$selectedRule1] . "/" . $target1, 30) . "\r\n";
        }
        if ($selectedRule2) {
            $ruleName = $rules[array_search($selectedRule2, array_column($rules, 'id'))]['name'];
            $teamsFormattedContent .= str_pad($ruleName . ": " . 
                                    $ruleTotals[$selectedRule2] . "/" . $target2, 30) . "\r\n";
        }
    }
}

// Add copy button and pre-formatted content
?>

<div class="container py-5">
    <h1 class="mb-4" style="color: #eeeeee;">Daily Scorecard</h1>

    <!-- Date and Pod Selectors - Moved outside selectedPod condition -->
    <div class="card mb-4">
        <div class="card-body">
            <form id="selectionForm" method="GET" class="row g-3">
                <div class="col-md-6">
                    <label for="date" class="form-label">Date</label>
                    <input type="date" id="date" name="date" class="form-control" 
                        value="<?php echo htmlspecialchars($selectedDate); ?>">
                </div>
                <div class="col-md-6">
                    <label for="pod" class="form-label">Pod</label>
                    <select id="pod" name="pod" class="form-select">
                        <option value="">Select Pod</option>
                        <?php foreach ($pods as $pod): ?>
                            <option value="<?php echo $pod['id']; ?>" 
                                <?php echo ($selectedPod == $pod['id']) ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($pod['name']); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </form>
        </div>
    </div>

    <?php if ($selectedPod): ?>
        <!-- Target Settings Card -->
        <div class="card mb-4">
            <div class="card-body">
                <h5 class="card-title">Target Settings</h5>
                <form id="targetForm" method="POST" action="/path/to/functions.php">
                    <input type="hidden" name="action" value="update_targets">
                    <input type="hidden" name="pod_id" value="<?php echo $selectedPod; ?>">
                    <input type="hidden" name="date" value="<?php echo $selectedDate; ?>">
                    <div class="row g-3">
                        <!-- Rule 1 Settings -->
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h6 class="card-subtitle mb-2">Rule 1</h6>
                                    <div class="d-flex flex-column gap-2">
                                        <select name="rule1" class="form-select">
                                            <option value="">Select Rule</option>
                                            <?php foreach ($rules as $rule): ?>
                                                <option value="<?php echo $rule['id']; ?>" 
                                                    <?php echo ($selectedRule1 == $rule['id']) ? 'selected' : ''; ?>>
                                                    <?php echo $rule['emoji'] . ' ' . htmlspecialchars($rule['name']); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <input type="number" name="target1" class="form-control" 
                                            placeholder="Target" 
                                            value="<?php echo $target1 !== null ? $target1 : ''; ?>">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Rule 2 Settings -->
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h6 class="card-subtitle mb-2">Rule 2</h6>
                                    <div class="d-flex flex-column gap-2">
                                        <select name="rule2" class="form-select">
                                            <option value="">Select Rule</option>
                                            <?php foreach ($rules as $rule): ?>
                                                <option value="<?php echo $rule['id']; ?>" 
                                                    <?php echo ($selectedRule2 == $rule['id']) ? 'selected' : ''; ?>>
                                                    <?php echo $rule['emoji'] . ' ' . htmlspecialchars($rule['name']); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <input type="number" name="target2" class="form-control" 
                                            placeholder="Target" 
                                            value="<?php echo $target2 !== null ? $target2 : ''; ?>">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12">
                            <button type="submit" class="btn btn-primary">Save Targets</button>
                        </div>
                    </div>
                </form>

                <!-- Add target totals display div -->
                <!--
                <div id="targetTotals" class="mt-3">
                   <?php if ($selectedRule1 || $selectedRule2): ?>
                        <?php 
                        $targetDisplay = [];
                        if ($selectedRule1) {
                            $targetDisplay[] = sprintf("%s: %d/%d",
                                htmlspecialchars($rules[array_search($selectedRule1, array_column($rules, 'id'))]['name']),
                                ($ruleTotals[$selectedRule1] ?? 0),
                                $target1
                            );
                        }
                        if ($selectedRule2) {
                            $targetDisplay[] = sprintf("%s: %d/%d",
                                htmlspecialchars($rules[array_search($selectedRule2, array_column($rules, 'id'))]['name']),
                                ($ruleTotals[$selectedRule2] ?? 0),
                                $target2
                            );
                        }
                        echo implode(' | ', $targetDisplay);
                        ?>
                    <?php endif; ?>
                </div>
                -->

                <script>
                document.getElementById('targetForm').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const formData = new FormData(this);
                    
                    fetch('functions.php', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Show success message
                            alert('Targets saved successfully');
                            // Reload page with current selections
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('date', document.getElementById('date').value);
                            currentUrl.searchParams.set('pod', document.getElementById('pod').value);
                            window.location.href = currentUrl.toString();
                        } else {
                            alert('Failed to save targets: ' + (data.error || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Failed to save targets');
                    });
                });

                // Auto-submit selection form when changes occur
                document.querySelectorAll('#selectionForm select, #selectionForm input').forEach(element => {
                    element.addEventListener('change', function() {
                        document.getElementById('selectionForm').submit();
                    });
                });
                </script>
            </div>
        </div>

        <!-- Results Card -->
        <div class="card">
            <div class="card-body">
                <!-- Rules Key -->
                <?php if (!empty($rules)): ?>
                    <div class="rules-key mb-3">
                        <?php foreach ($rules as $rule): ?>
                            <span class="me-3">
                                <?php echo $rule['emoji'] . ' ' . htmlspecialchars($rule['name']); ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <!-- Results Table -->
                <table class="table table-sm mb-0">
                    <tbody>
                        <?php foreach ($displayResults as $name => $data): ?>
                            <tr>
                                <td class="text-nowrap"><?php echo htmlspecialchars($name); ?></td>
                                <td class="text-nowrap"><?php echo $data['emojis']; ?></td>
                                <td class="text-nowrap text-end"><?php echo $data['total']; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <!-- Target Totals -->
                <?php if ($selectedRule1 || $selectedRule2): ?>
                    <div class="mt-3 pt-3">
                        <div class="d-flex align-items-center">
                            <?php 
                            $targetDisplay = [];
                            if ($selectedRule1) {
                                $rule1Name = $rules[array_search($selectedRule1, array_column($rules, 'id'))]['name'];
                                $targetDisplay[] = sprintf("%s: %d/%d",
                                    htmlspecialchars($rule1Name),
                                    ($ruleTotals[$selectedRule1] ?? 0),
                                    $target1
                                );
                            }
                            if ($selectedRule2) {
                                $rule2Name = $rules[array_search($selectedRule2, array_column($rules, 'id'))]['name'];
                                $targetDisplay[] = sprintf("%s: %d/%d",
                                    htmlspecialchars($rule2Name),
                                    ($ruleTotals[$selectedRule2] ?? 0),
                                    $target2
                                );
                            }
                            echo implode(' | ', $targetDisplay);
                            ?>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    <?php endif; ?>
</div>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/public/admin/includes/footer.php'; ?>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const resultsForm = document.getElementById('resultsForm');
    const rule1Select = document.querySelector('select[name="rule1"]');
    const rule2Select = document.querySelector('select[name="rule2"]');
    const target1Input = document.querySelector('input[name="target1"]');
    const target2Input = document.querySelector('input[name="target2"]');

    function updateTargets(event) {
        event.preventDefault();
        const formData = new FormData(resultsForm);
        
        fetch(resultsForm.action, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update target displays
                if (data.ruleTotals) {
                    Object.keys(data.ruleTotals).forEach(ruleId => {
                        const targetElement = document.querySelector(`[data-rule-target="${ruleId}"]`);
                        if (targetElement) {
                            targetElement.textContent = `${data.ruleTotals[ruleId].name}: ${data.ruleTotals[ruleId].current}/${data.ruleTotals[ruleId].target}`;
                        }
                    });
                }
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Add change event listeners
    [rule1Select, rule2Select, target1Input, target2Input].forEach(element => {
        if (element) {
            element.addEventListener('change', updateTargets);
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const targetForm = document.getElementById('targetForm');

    targetForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(targetForm);
        
        fetch('functions.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the target totals display
                const targetDisplay = document.querySelector('.target-totals');
                if (targetDisplay && data.ruleTotals) {
                    let displayHtml = [];
                    Object.keys(data.ruleTotals).forEach(ruleId => {
                        const ruleData = data.ruleTotals[ruleId];
                        displayHtml.push(`${ruleData.name}: ${ruleData.current}/${ruleData.target}`);
                    });
                    targetDisplay.innerHTML = displayHtml.join(' | ');
                }
            } else {
                console.error('Failed to save targets:', data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    });
});

document.getElementById('pod').addEventListener('change', function() {
    document.getElementById('selectionForm').submit();
});

document.getElementById('date').addEventListener('change', function() {
    document.getElementById('selectionForm').submit();
});

document.getElementById('targetForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    
    fetch('functions.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('date', document.getElementById('date').value);
            currentUrl.searchParams.set('pod', document.getElementById('pod').value);
            window.location.href = currentUrl.toString();
        } else {
            alert('Failed to save targets: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to save targets');
    });
});
</script>