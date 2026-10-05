<?php
declare(strict_types=1);

/*
 * One-time production repair for the TPK Wuse schedule on 4 October 2026.
 *
 * Run from the Oracle VM after a database backup:
 *   php backend/tools/repair_2026_10_04_first_service.php --confirm
 *
 * The script refuses to run without --confirm, aborts on service-scoped
 * uniqueness conflicts, and only deletes duplicate Second Service rows after
 * every dependent operational record has been moved to First Service.
 */
require_once dirname(__DIR__) . '/config.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This repair is CLI-only.\n");
    exit(1);
}
if (!in_array('--confirm', $argv, true)) {
    fwrite(STDERR, "Refusing to modify data without --confirm.\n");
    exit(2);
}

$db = db();
$date = '2026-10-04';
$hasTable = static function (string $table) use ($db): bool {
    $query = $db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');
    $query->execute([$table]);
    return (bool)$query->fetchColumn();
};
$rows = static function (string $sql, array $params = []) use ($db): array {
    $query = $db->prepare($sql);
    $query->execute($params);
    return $query->fetchAll();
};
$execute = static function (string $sql, array $params = []) use ($db): void {
    $query = $db->prepare($sql);
    $query->execute($params);
};

$sessions = $rows(
    "SELECT id,campus_id,service_type FROM service_sessions
     WHERE service_date=? AND service_type IN ('FIRST_SERVICE','SECOND_SERVICE')
     ORDER BY campus_id,service_type",
    [$date],
);
$firstByCampus = [];
$secondByCampus = [];
foreach ($sessions as $session) {
    $campus = (int)$session['campus_id'];
    if ($session['service_type'] === 'FIRST_SERVICE') $firstByCampus[$campus][] = (int)$session['id'];
    if ($session['service_type'] === 'SECOND_SERVICE') $secondByCampus[$campus][] = (int)$session['id'];
}
if (!$secondByCampus) {
    fwrite(STDOUT, "No 4 October Second Service rows found; nothing to repair.\n");
    exit(0);
}
foreach ($secondByCampus as $campus => $secondIds) {
    if (count($firstByCampus[$campus] ?? []) !== 1) {
        throw new RuntimeException("Campus {$campus} must have exactly one First Service row for {$date}.");
    }
}

$map = [];
foreach ($secondByCampus as $campus => $secondIds) {
    $firstId = $firstByCampus[$campus][0];
    foreach ($secondIds as $secondId) $map[$secondId] = $firstId;
}
$oldIds = array_keys($map);

/* Refuse to merge records that would collide with First Service's unique keys. */
foreach ($map as $secondId => $firstId) {
    if ($hasTable('attendance')) {
        $query = $db->prepare('SELECT COUNT(*) FROM attendance old JOIN attendance first_service ON first_service.service_session_id=? AND first_service.child_id=old.child_id WHERE old.service_session_id=?');
        $query->execute([$firstId, $secondId]);
        if ((int)$query->fetchColumn() > 0) throw new RuntimeException('Repair stopped: attendance already exists for a child in First Service.');
    }
    if ($hasTable('service_pickup_codes')) {
        $query = $db->prepare('SELECT COUNT(*) FROM service_pickup_codes old JOIN service_pickup_codes first_service ON first_service.service_session_id=? AND first_service.family_id=old.family_id WHERE old.service_session_id=?');
        $query->execute([$firstId, $secondId]);
        if ((int)$query->fetchColumn() > 0) throw new RuntimeException('Repair stopped: a family already has a First Service pickup code.');
    }
}

$db->beginTransaction();
try {
    $mapFirst = [];
    foreach ($map as $secondId => $firstId) $mapFirst[$secondId] = $firstId;
    $updateSessionRefs = [
        'attendance', 'service_pickup_codes', 'pickup_passes', 'service_report_dispatches',
        'follow_up_tasks', 'classroom_assignments', 'classroom_notes', 'classroom_weekly_reviews',
        'assembly_activities', 'assembly_notes', 'check_in_requests', 'sunday_volunteer_assignments',
    ];
    foreach ($updateSessionRefs as $table) {
        if (!$hasTable($table)) continue;
        foreach ($mapFirst as $secondId => $firstId) {
            if ($table === 'service_pickup_codes') {
                // Sequences start at 1 per service. Offset the moved sequences
                // while retaining the display codes and QR tokens already issued.
                $max = $db->prepare('SELECT COALESCE(MAX(sequence_number),0) FROM service_pickup_codes WHERE service_session_id=?');
                $max->execute([$firstId]);
                $offset = (int)$max->fetchColumn();
                $execute('UPDATE service_pickup_codes SET sequence_number=sequence_number+? WHERE service_session_id=? ORDER BY sequence_number DESC', [$offset,$secondId]);
            }
            $execute("UPDATE `{$table}` SET service_session_id=? WHERE service_session_id=?", [$firstId, $secondId]);
        }
    }

    /* Assign unscoped 4 October roster rows to that campus's First Service too. */
    if ($hasTable('roster_assignments')) {
        foreach ($mapFirst as $secondId => $firstId) {
            $execute(
                'UPDATE roster_assignments SET service_session_id=? WHERE assignment_date=? AND service_session_id=?',
                [$firstId, $date, $secondId],
            );
        }
        foreach ($firstByCampus as $campus => $firstIds) {
            $execute(
                "UPDATE roster_assignments ra JOIN staff_users u ON u.id=ra.user_id
                 SET ra.service_session_id=?
                 WHERE ra.assignment_date=? AND u.campus_id=?
                   AND ra.service_session_id IS NULL",
                [$firstIds[0], $date, $campus],
            );
        }
    }

    foreach ($oldIds as $secondId) $execute('DELETE FROM service_sessions WHERE id=?', [$secondId]);
    if ($hasTable('sunday_service_plans')) foreach ($firstByCampus as $campus => $firstIds) {
        $execute('INSERT INTO sunday_service_plans(campus_id,service_date) VALUES(?,?) ON DUPLICATE KEY UPDATE service_date=VALUES(service_date)', [$campus,$date]);
    }
    $db->commit();
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    throw $error;
}

fwrite(STDOUT, "Repaired {$date}: all mapped assignments and operational records now use First Service; duplicate Second Service rows were removed.\n");
