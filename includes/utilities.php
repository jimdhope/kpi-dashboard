function getTeamPoints($podId, $startDate, $endDate) {
    $db = Database::getInstance();
    
    $query = "
        SELECT 
            t.id as team_id,
            t.name as team_name,
            GROUP_CONCAT(CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as members,
            SUM(s.points) as total_points
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN people p ON tm.person_id = p.id
        LEFT JOIN scores s ON p.id = s.person_id
        WHERE t.pod_id = ?
        AND s.date BETWEEN ? AND ?
        GROUP BY t.id, t.name
        ORDER BY total_points DESC
    ";
    
    return $db->query($query, [$podId, $startDate, $endDate])->fetchAll(PDO::FETCH_ASSOC);
}

function getLeaderboardData($podId, $startDate, $endDate) {
    $db = Database::getInstance();
    
    $query = "
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            SUM(s.points) as total_points
        FROM people p
        LEFT JOIN scores s ON p.id = s.person_id
        WHERE p.pod_id = ?
        AND s.date BETWEEN ? AND ?
        GROUP BY p.id, p.first_name, p.last_name
        ORDER BY total_points DESC
    ";
    
    return $db->query($query, [$podId, $startDate, $endDate])->fetchAll(PDO::FETCH_ASSOC);
}