<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_response([]);
$db = db();
$method = $_SERVER['REQUEST_METHOD'];
$path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$campus = $db->query("SELECT id FROM campuses WHERE code = 'PETRA-WUSE' LIMIT 1")->fetch();
if (!$campus) json_response(['error' => 'Run backend/database/seed.sql first.'], 503);
$campusId = (int)$campus['id'];

function family_rows(PDO $db, int $campusId, string $q): array {
    $like = "%$q%";
    $sql = "SELECT DISTINCT f.id, f.family_code AS familyCode, f.surname, f.phone FROM families f
      LEFT JOIN family_passes p ON p.family_id=f.id AND p.is_active=1 WHERE f.campus_id=? AND f.is_active=1
      AND (f.surname LIKE ? OR f.phone LIKE ? OR f.family_code LIKE ? OR p.opaque_token LIKE ?) ORDER BY f.surname LIMIT 20";
    $stmt=$db->prepare($sql); $stmt->execute([$campusId,$like,$like,$like,$like]); $families=$stmt->fetchAll();
    foreach ($families as &$family) {
        $g=$db->prepare('SELECT id, first_name AS firstName, last_name AS lastName, relationship, is_authorized AS isAuthorized FROM guardians WHERE family_id=?'); $g->execute([$family['id']]); $family['guardians']=$g->fetchAll();
        $c=$db->prepare('SELECT c.id, c.first_name AS firstName, c.last_name AS lastName, cl.name FROM children c LEFT JOIN classes cl ON cl.id=c.class_id WHERE c.family_id=? AND c.is_active=1'); $c->execute([$family['id']]);
        $family['children']=array_map(fn($row)=>['id'=>$row['id'],'firstName'=>$row['firstName'],'lastName'=>$row['lastName'],'class'=>['name'=>$row['name']]],$c->fetchAll());
    }
    return $families;
}

function active_session(PDO $db, int $campusId): ?array {
    $stmt=$db->prepare('SELECT id, service_date, service_order FROM service_sessions WHERE campus_id=? AND is_open=1 AND service_date=CURDATE() ORDER BY starts_at DESC LIMIT 1'); $stmt->execute([$campusId]); return $stmt->fetch() ?: null;
}

function create_service_follow_up(PDO $db, int $campusId, int $sessionId): array {
    $session=$db->prepare('SELECT id, COALESCE(service_date,DATE(starts_at)) AS serviceDate FROM service_sessions WHERE id=? AND campus_id=?'); $session->execute([$sessionId,$campusId]); $service=$session->fetch(); if (!$service) json_response(['error'=>'Service session not found.'],404);
    $absent=$db->prepare("SELECT ch.id AS childId, ch.class_id AS classId FROM children ch JOIN families f ON f.id=ch.family_id WHERE f.campus_id=? AND f.is_active=1 AND ch.is_active=1 AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.service_session_id=? AND a.child_id=ch.id)"); $absent->execute([$campusId,$sessionId]); $children=$absent->fetchAll();
    $missedTask=$db->prepare("INSERT INTO follow_up_tasks(campus_id,child_id,class_id,service_session_id,task_type,priority) SELECT ?,?,?,?,?, 'NORMAL' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM follow_up_tasks WHERE child_id=? AND service_session_id=? AND task_type='MISSED_SERVICE' AND status IN ('OPEN','IN_PROGRESS'))");
    foreach($children as $child) $missedTask->execute([$campusId,$child['childId'],$child['classId'],$sessionId,'MISSED_SERVICE',$child['childId'],$sessionId]);
    $dates=$db->prepare("SELECT DISTINCT COALESCE(service_date,DATE(starts_at)) AS serviceDate FROM service_sessions WHERE campus_id=? AND COALESCE(service_date,DATE(starts_at)) <= ? ORDER BY serviceDate DESC LIMIT 2"); $dates->execute([$campusId,$service['serviceDate']]); $serviceDates=array_column($dates->fetchAll(),'serviceDate'); $twoWeekCount=0;
    if (count($serviceDates) === 2) {
        $twoWeek=$db->prepare("SELECT ch.id AS childId,ch.class_id AS classId FROM children ch JOIN families f ON f.id=ch.family_id WHERE f.campus_id=? AND f.is_active=1 AND ch.is_active=1 AND NOT EXISTS (SELECT 1 FROM attendance a JOIN service_sessions s ON s.id=a.service_session_id WHERE a.child_id=ch.id AND COALESCE(s.service_date,DATE(s.starts_at))=?) AND NOT EXISTS (SELECT 1 FROM attendance a JOIN service_sessions s ON s.id=a.service_session_id WHERE a.child_id=ch.id AND COALESCE(s.service_date,DATE(s.starts_at))=?)"); $twoWeek->execute([$campusId,$serviceDates[0],$serviceDates[1]]);
        $twoWeekTask=$db->prepare("INSERT INTO follow_up_tasks(campus_id,child_id,class_id,service_session_id,task_type,priority) SELECT ?,?,?,?,?, 'HIGH' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM follow_up_tasks WHERE child_id=? AND task_type='TWO_WEEK_ABSENCE' AND status IN ('OPEN','IN_PROGRESS'))");
        foreach($twoWeek->fetchAll() as $child) { $twoWeekTask->execute([$campusId,$child['childId'],$child['classId'],$sessionId,'TWO_WEEK_ABSENCE',$child['childId']]); $twoWeekCount++; }
    }
    $payload=['serviceSessionId'=>$sessionId,'serviceDate'=>$service['serviceDate'],'absentChildIds'=>array_map(fn($child)=>(int)$child['childId'],$children),'twoWeekAbsenceCount'=>$twoWeekCount];
    $report=$db->prepare("INSERT INTO service_report_dispatches(campus_id,service_session_id,report_type,delivery_channel,status,payload) VALUES(?,?, 'ABSENT_CHILDREN','IN_APP','QUEUED',?)"); $report->execute([$campusId,$sessionId,json_encode($payload,JSON_THROW_ON_ERROR)]);
    return ['reportId'=>(int)$db->lastInsertId(),'absentChildren'=>count($children),'twoWeekFollowUps'=>$twoWeekCount];
}

if ($method === 'GET' && $path === '/api/classes') { $s=$db->prepare('SELECT id,name,age_label AS ageLabel,color FROM classes WHERE campus_id=? AND is_active=1 ORDER BY name'); $s->execute([$campusId]); json_response($s->fetchAll()); }
if ($method === 'GET' && $path === '/api/families') json_response(family_rows($db,$campusId,trim($_GET['q'] ?? '')));

if ($method === 'POST' && $path === '/api/families') {
    $v=body(); foreach(['surname','phone','guardianFirstName','guardianLastName','childFirstName','childLastName','classId'] as $field) if (empty($v[$field])) json_response(['error'=>'Please complete the required child and guardian details.'],422);
    $class=$db->prepare('SELECT id FROM classes WHERE id=? AND campus_id=? AND is_active=1'); $class->execute([(int)$v['classId'],$campusId]); if(!$class->fetch()) json_response(['error'=>'Choose an active Petra Wuse class.'],422);
    $code='PETRA-WUSE-'.strtoupper(substr(bin2hex(random_bytes(4)),0,6)); $token='fp_'.bin2hex(random_bytes(16)); $db->beginTransaction(); try {
      $db->prepare('INSERT INTO families(campus_id,family_code,surname,phone,notes) VALUES(?,?,?,?,?)')->execute([$campusId,$code,trim($v['surname']),trim($v['phone']),$v['notes']??null]); $familyId=(int)$db->lastInsertId();
      $db->prepare("INSERT INTO guardians(family_id,first_name,last_name,phone,relationship,is_primary,is_authorized) VALUES(?,?,?,?, 'Parent',1,1)")->execute([$familyId,trim($v['guardianFirstName']),trim($v['guardianLastName']),trim($v['phone'])]);
      $db->prepare('INSERT INTO children(family_id,class_id,first_name,last_name,safeguarding_notes) VALUES(?,?,?,?,?)')->execute([$familyId,(int)$v['classId'],trim($v['childFirstName']),trim($v['childLastName']),$v['pickupNote']??null]); $childId=(int)$db->lastInsertId();
      $db->prepare("INSERT INTO family_passes(family_id,type,opaque_token,label) VALUES(?, 'PHYSICAL_QR', ?, 'Family pass')")->execute([$familyId,$token]); audit($db,$campusId,'CHILD_REGISTERED','Child',$childId,['familyCode'=>$code]); $db->commit();
    } catch(Throwable $e) { $db->rollBack(); throw $e; }
    json_response(['id'=>$familyId,'familyCode'=>$code],201);
}

if ($method === 'POST' && $path === '/api/attendance/check-in') {
    $v=body(); $childId=(int)($v['childId']??0); $session=active_session($db,$campusId); $sessionId=(int)($session['id']??0); if(!$sessionId) json_response(['error'=>'There is no open service session.'],409);
    $child=$db->prepare('SELECT c.id,c.first_name,c.last_name,c.class_id,cl.name FROM children c JOIN classes cl ON cl.id=c.class_id JOIN families f ON f.id=c.family_id WHERE c.id=? AND f.campus_id=? AND c.is_active=1'); $child->execute([$childId,$campusId]); $child=$child->fetch(); if(!$child) json_response(['error'=>'Child not found at Petra Wuse or needs a class assignment.'],404);
    try {$db->prepare("INSERT INTO attendance(service_session_id,child_id,class_id,status) VALUES(?,?,?,'CHECKED_IN')")->execute([$sessionId,$childId,$child['class_id']]);} catch(Throwable $e){json_response(['error'=>$child['first_name'].' is already checked in for this service.'],409);} audit($db,$campusId,'CHILD_CHECKED_IN','Attendance',(int)$db->lastInsertId()); json_response(['childName'=>$child['first_name'].' '.$child['last_name'],'className'=>$child['name']]);
}

if ($method === 'POST' && $path === '/api/services/close') {
    $v=body(); $active=active_session($db,$campusId); $sessionId=(int)($v['serviceSessionId'] ?? $active['id'] ?? 0); if(!$sessionId) json_response(['error'=>'Choose an open service session.'],422); $db->beginTransaction(); try { $report=create_service_follow_up($db,$campusId,$sessionId); $close=$db->prepare('UPDATE service_sessions SET is_open=0, ends_at=NOW() WHERE id=? AND campus_id=? AND is_open=1'); $close->execute([$sessionId,$campusId]); if(!$close->rowCount()) throw new RuntimeException('This service is already closed or unavailable.'); audit($db,$campusId,'SERVICE_CLOSED','ServiceSession',$sessionId,$report); $db->commit(); } catch(Throwable $e) {$db->rollBack(); json_response(['error'=>$e->getMessage()],409);} json_response(['message'=>'Service closed. The private absent-child follow-up report is queued.']+$report);
}

if ($method === 'POST' && $path === '/api/attendance/tick') {
    $v=body(); $childId=(int)($v['childId']??0); $date=$v['date']??''; $present=(bool)($v['present']??true); if(!$childId || !preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)) json_response(['error'=>'A child and valid attendance date are required.'],422); $year=(int)substr($date,0,4); $month=(int)substr($date,5,2); $week=min(4,(int)ceil((int)substr($date,8,2)/7));
    $db->prepare('INSERT IGNORE INTO calendar_years(year_number) VALUES(?)')->execute([$year]); $y=(int)$db->query("SELECT id FROM calendar_years WHERE year_number=$year")->fetch()['id']; $db->prepare('INSERT IGNORE INTO calendar_months(year_id,month_number) VALUES(?,?)')->execute([$y,$month]); $m=$db->prepare('SELECT id FROM calendar_months WHERE year_id=? AND month_number=?');$m->execute([$y,$month]);$monthId=(int)$m->fetch()['id']; $db->prepare('INSERT IGNORE INTO calendar_weeks(month_id,week_number) VALUES(?,?)')->execute([$monthId,$week]); $w=$db->prepare('SELECT id FROM calendar_weeks WHERE month_id=? AND week_number=?');$w->execute([$monthId,$week]);$weekId=(int)$w->fetch()['id'];
    $db->prepare("INSERT INTO daily_attendance(child_id,attendance_date,calendar_year_id,calendar_month_id,calendar_week_id,status) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status), recorded_at=CURRENT_TIMESTAMP")->execute([$childId,$date,$y,$monthId,$weekId,$present?'PRESENT':'ABSENT']); audit($db,$campusId,'DAILY_ATTENDANCE_TICKED','Child',$childId,['date'=>$date,'present'=>$present]); json_response(['message'=>$present?'Attendance ticked.':'Attendance cleared.','year'=>$year,'month'=>$month,'week'=>$week]);
}

if ($method === 'GET' && $path === '/api/calendar') { $year=max(2020,(int)($_GET['year']??date('Y'))); $month=min(12,max(1,(int)($_GET['month']??date('n')))); $start=sprintf('%04d-%02d-01',$year,$month); $days=(int)date('t',strtotime($start)); $weeks=[]; for($week=1;$week<=4;$week++){ $from=($week-1)*7+1; $to=min($week*7,$days); $weeks[]=['week'=>$week,'days'=>range($from,$to)]; } json_response(['year'=>$year,'month'=>$month,'monthName'=>date('F',strtotime($start)),'weeks'=>$weeks]); }
json_response(['error'=>'Route not found.'],404);
