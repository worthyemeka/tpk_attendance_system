<?php
declare(strict_types=1);

function api_sunday_schedule(PDO $db): never {
    $actor = api_actor($db, true);
    if (!api_table_exists($db, 'sunday_service_plans')) api_error('SCHEDULE_NOT_READY', 'Sunday service settings are not ready yet.', 503);
    $v = api_method() === 'GET' ? $_GET : api_input();
    $date = (string)($v['serviceDate'] ?? '');
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Africa/Lagos'));
    if (!$day || $day->format('Y-m-d') !== $date || $day->format('w') !== '0') api_error('VALIDATION_ERROR', 'Choose a valid Sunday.', 422);
    $campus = (int)$actor['campus_id'];
    $q = $db->prepare('SELECT theme FROM sunday_service_plans WHERE campus_id=? AND service_date=?');
    $q->execute([$campus, $date]);
    $plan = $q->fetch();
    $q = $db->prepare('SELECT id,name,starts_at AS startsAt,ends_at AS endsAt,service_type AS serviceType FROM service_sessions WHERE campus_id=? AND service_date=? ORDER BY service_order,starts_at,id');
    $q->execute([$campus, $date]);
    $existing = $q->fetchAll();
    if (api_method() === 'GET') api_ok(['serviceDate'=>$date,'theme'=>$plan['theme']??'','sessions'=>$existing]);
    if (api_method() !== 'PUT') api_error('METHOD_NOT_ALLOWED', 'Use GET or PUT.', 405);
    $theme = trim((string)($v['theme'] ?? ''));
    $sessions = $v['sessions'] ?? [];
    if (strlen($theme)>150 || !is_array($sessions) || count($sessions)<1 || count($sessions)>12) api_error('VALIDATION_ERROR', 'Choose 1–12 services and a theme of up to 150 characters.', 422);
    $ids = array_map('intval', array_column($existing, 'id'));
    $keep = []; $prepared = []; $previousEnd = '';
    foreach ($sessions as $i=>$row) {
        if(!is_array($row))api_error('VALIDATION_ERROR','Provide valid service settings.',422);
        $id = (int)($row['id'] ?? 0);
        if ($id && (!in_array($id,$ids,true) || in_array($id,$keep,true))) api_error('VALIDATION_ERROR', 'A service does not belong to this Sunday or was repeated.',422);
        if ($id) $keep[]=$id;
        $start = (string)($row['startTime']??''); $end = (string)($row['endTime']??'');
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/',$start) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/',$end) || $end<=$start || ($previousEnd && $start<$previousEnd)) api_error('VALIDATION_ERROR','Set valid, chronological service times without overlaps.',422);
        $previousEnd=$end;
        $ordinal=$i+1;
        $name=count($sessions)===1 ? ($theme ?: 'First Service') : ($i===0?'First Service':($i===1?'Second Service':"Service {$ordinal}"));
        if (count($sessions)>1 && $theme) $name.=' · '.$theme;
        if (strlen($name)>150) api_error('VALIDATION_ERROR','Please shorten the service theme.',422);
        // Existing IDs and types are preserved; new services get stable types.
        $old=$id ? $existing[array_search($id,$ids,true)] : null;
        $type=$old['serviceType']??($i===0?'FIRST_SERVICE':($i===1?'SECOND_SERVICE':"SERVICE_{$ordinal}"));
        $prepared[]=[$id,$name,$date.' '.$start.':00',$date.' '.$end.':00',$ordinal,$type];
    }
    $remove=array_values(array_diff($ids,$keep));
    // Check every service reference, including tables installed by later features.
    $refs=$db->query("SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME='service_session_id'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($remove as $id) foreach ($refs as $table) {
        $q=$db->prepare("SELECT COUNT(*) FROM `{$table}` WHERE service_session_id=?");$q->execute([$id]);
        if ($q->fetchColumn()) api_error('SERVICE_HAS_RECORDS','This service already has records. Its attendance and assignments must be reconciled before reducing the service count.',409);
    }
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO sunday_service_plans(campus_id,service_date,theme,updated_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE theme=VALUES(theme),updated_by=VALUES(updated_by)')->execute([$campus,$date,$theme?:null,$actor['id']]);
        foreach ($remove as $id) $db->prepare('DELETE FROM service_sessions WHERE id=? AND campus_id=?')->execute([$id,$campus]);
        foreach ($prepared as [$id,$name,$start,$end,$order,$type]) {
            if ($id) $db->prepare('UPDATE service_sessions SET name=?,starts_at=?,ends_at=?,service_order=? WHERE id=? AND campus_id=?')->execute([$name,$start,$end,$order,$id,$campus]);
            else $db->prepare('INSERT INTO service_sessions(campus_id,service_date,name,starts_at,ends_at,service_order,service_type,is_open) VALUES(?,?,?,?,?,?,?,1)')->execute([$campus,$date,$name,$start,$end,$order,$type]);
        }
        api_audit($db,$actor,'SUNDAY_SCHEDULE_UPDATED','SundaySchedule',0,['serviceDate'=>$date,'serviceCount'=>count($prepared),'theme'=>$theme]);
        $db->commit();
    } catch(Throwable $e) { if($db->inTransaction())$db->rollBack();throw $e; }
    api_ok(['serviceDate'=>$date,'saved'=>true]);
}
