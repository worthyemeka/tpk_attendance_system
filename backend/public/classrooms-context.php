<?php
declare(strict_types=1);

function api_classroom_context_sessions(PDO $db, array $actor): array {
    $requested = (int)($_GET['serviceSessionId'] ?? 0);
    if ($requested > 0) {
        $s = $db->prepare("SELECT id,name,service_type AS serviceType,service_date AS serviceDate,starts_at AS startsAt FROM service_sessions WHERE id=? AND campus_id=? AND service_type IS NOT NULL LIMIT 1");
        $s->execute([$requested, (int)$actor['campus_id']]);
        $row = $s->fetch();
        if (!$row) api_error('SERVICE_SESSION_NOT_FOUND', 'This service is not available for your campus.', 404);
        return [$row];
    }
    $scope = strtoupper(trim((string)($_GET['serviceScope'] ?? 'SECOND_SERVICE')));
    if (!in_array($scope, ['FIRST_SERVICE', 'SECOND_SERVICE', 'ALL'], true)) $scope = 'SECOND_SERVICE';
    if ($scope === 'ALL' && $actor['access_level'] !== 'TPK_SUPER_ADMIN') api_error('FORBIDDEN', 'Only a Super Admin can compare all services.', 403);
    $date = trim((string)($_GET['date'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = (new DateTimeImmutable('now', new DateTimeZone('Africa/Lagos')))->format('Y-m-d');
    $where = ['campus_id=?', 'service_date=?', "service_type IS NOT NULL"];
    $params = [(int)$actor['campus_id'], $date];
    if ($scope !== 'ALL') { $where[] = 'service_type=?'; $params[] = $scope; }
    $s = $db->prepare('SELECT id,name,service_type AS serviceType,service_date AS serviceDate,starts_at AS startsAt FROM service_sessions WHERE '.implode(' AND ', $where).' ORDER BY starts_at');
    $s->execute($params);
    return $s->fetchAll();
}

function api_classroom_context_snapshot(PDO $db, array $actor, ?array $service): array {
    $sessionId = (int)($service['id'] ?? 0);
    $allowed=null;
    // Classroom browsing is shared across the campus, not roster membership.
    $where = ['c.campus_id=?', 'c.is_active=1'];
    $params = [(int)$actor['campus_id']];
    if ($allowed !== null) {
        if (!$allowed) return ['serviceSession'=>$service, 'summary'=>['activeClasses'=>0,'checkedIn'=>0,'teachersAssigned'=>0,'needAttention'=>0], 'items'=>[]];
        $where[] = 'c.id IN ('.implode(',', array_fill(0, count($allowed), '?')).')';
        $params = array_merge($params, $allowed);
    }
    if (($classId = (int)($_GET['classId'] ?? 0)) > 0) { $where[] = 'c.id=?'; $params[] = $classId; }
    if (($search = trim((string)($_GET['search'] ?? ''))) !== '') {
        $like = '%'.$search.'%';
        $where[] = "(c.name LIKE ? OR EXISTS(SELECT 1 FROM children sc WHERE sc.class_id=c.id AND CONCAT(sc.first_name,' ',sc.last_name) LIKE ?) OR EXISTS(SELECT 1 FROM roster_assignments sra JOIN staff_users su ON su.id=sra.user_id WHERE sra.class_id=c.id AND sra.service_session_id=? AND su.name LIKE ?))";
        $params = array_merge($params, [$like, $like, $sessionId, $like]);
    }
    $s = $db->prepare('SELECT c.id,c.name,c.age_label AS ageLabel,c.min_age AS minAge,c.max_age AS maxAge,COUNT(ch.id) AS registered FROM classes c LEFT JOIN children ch ON ch.class_id=c.id AND ch.is_active=1 WHERE '.implode(' AND ', $where).' GROUP BY c.id,c.name,c.age_label,c.min_age,c.max_age ORDER BY c.display_order,c.name');
    $s->execute($params);
    $items=[]; $checked=0; $teachers=0; $attention=0;
    $today=(new DateTimeImmutable('now',new DateTimeZone('Africa/Lagos')))->format('Y-m-d');
    $past=(string)($service['serviceDate'] ?? '') !== '' && (string)$service['serviceDate'] <= $today;
    foreach ($s->fetchAll() as $row) {
        $id=(int)$row['id']; $registered=(int)$row['registered']; $present=0;
        if ($sessionId) { $a=$db->prepare("SELECT COUNT(*) FROM attendance WHERE service_session_id=? AND class_id=? AND status IN ('CHECKED_IN','PICKUP_REQUESTED','PICKED_UP')"); $a->execute([$sessionId,$id]); $present=(int)$a->fetchColumn(); }
        $row['registered']=$registered; $row['present']=$present; $row['absent']=$past ? max(0,$registered-$present) : 0; $row['attendancePercentage']=$registered ? (int)round($present/$registered*100) : 0;
        $row['teachers']=api_classroom_teachers($db,$id,$service); $row['teacherCount']=count($row['teachers']); $row['status']=$row['teacherCount'] ? 'RUNNING_SMOOTHLY' : 'NO_TEACHER_ASSIGNED';
        if ($row['status'] !== 'RUNNING_SMOOTHLY') $attention++; $items[]=$row; $checked+=$present; $teachers+=(int)$row['teacherCount'];
    }
    $status=trim((string)($_GET['status'] ?? '')); if ($status !== '') $items=array_values(array_filter($items, fn($row) => $row['status'] === $status));
    return ['serviceSession'=>$service, 'summary'=>['activeClasses'=>count($items),'checkedIn'=>$checked,'teachersAssigned'=>$teachers,'needAttention'=>$attention], 'items'=>$items];
}

function api_classrooms_context(PDO $db): never {
    $actor=api_actor($db); $scope=strtoupper(trim((string)($_GET['serviceScope'] ?? ''))); $sessions=api_classroom_context_sessions($db,$actor);
    if (count($sessions)>1 || $scope==='ALL') {
        $groups=[]; $summary=['activeClasses'=>0,'checkedIn'=>0,'teachersAssigned'=>0,'needAttention'=>0];
        foreach ($sessions as $service) { $group=api_classroom_context_snapshot($db,$actor,$service); $groups[]=$group; foreach ($summary as $key=>$value) $summary[$key]+=(int)($group['summary'][$key]??0); }
        $items=[]; foreach ($groups as $group) $items=array_merge($items,$group['items']);
        api_ok(['mode'=>'ALL','serviceSessions'=>$sessions,'groups'=>$groups,'summary'=>$summary,'items'=>$items]);
    }
    $service=$sessions[0]??null; $group=api_classroom_context_snapshot($db,$actor,$service);
    api_ok(['mode'=>'THIS','serviceSession'=>$service,'serviceSessions'=>$sessions,'summary'=>$group['summary'],'items'=>$group['items']]);
}
