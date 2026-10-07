<?php
declare(strict_types=1);

function api_teacher_attendance_ready(PDO $db): void {
    foreach (['teacher_services','teacher_service_expected','teacher_service_attendance','teacher_service_absence_reasons','teacher_signin_attempts','teacher_welfare_cases','teacher_welfare_events'] as $table)
        if (!api_table_exists($db,$table)) api_error('TEACHER_ATTENDANCE_NOT_READY','Teacher check-in needs the backend and database update before it can be used.',503);
}
function api_teacher_now(): DateTimeImmutable { return new DateTimeImmutable('now',new DateTimeZone('Africa/Lagos')); }
function api_teacher_answer(string $answer): string { return strtolower(trim(preg_replace('/\s+/u',' ',$answer)??'')); }
function api_teacher_service_values(array $v): array {
    $kind=(string)($v['kind']??''); $date=(string)($v['date']??'');
    $day=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Africa/Lagos'));
    if (!$day||$day->format('Y-m-d')!==$date||!in_array($kind,['SUNDAY','MDWK'],true)||$day->format('w')!==($kind==='SUNDAY'?'0':'3')) api_error('VALIDATION_ERROR','Choose a Sunday or a Wednesday for the matching service type.',422);
    $start=(string)($v['startTime']??'');$end=(string)($v['endTime']??'');
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/',$start)||!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/',$end)||$end<=$start) api_error('VALIDATION_ERROR','Set a start and later closing time on the same service day.',422);
    $name=trim((string)($v['name']??''));$question=trim((string)($v['question']??''));$answers=$v['answers']??[];
    if($kind==='MDWK') return [$kind,'MDWK',$date.' 00:00:00',$date.' 21:00:00','','[]'];
    if($name===''||strlen($name)>150||$question===''||strlen($question)>250||!is_array($answers)||count($answers)<1||count($answers)>5)api_error('VALIDATION_ERROR','Provide a name, today’s question and 1–5 accepted answers.',422);
    $hashes=[];foreach($answers as $answer){if(!is_string($answer)||api_teacher_answer($answer)===''||strlen($answer)>100)api_error('VALIDATION_ERROR','Accepted answers must be 1–100 characters.',422);$hashes[]=password_hash(api_teacher_answer($answer),PASSWORD_DEFAULT);}
    return [$kind,$name,$date.' '.$start.':00',$date.' '.$end.':00',$question,json_encode($hashes)];
}
function api_teacher_welfare_manager(PDO $db,array $actor): bool {
    if($actor['access_level']==='TPK_SUPER_ADMIN')return true;
    $s=$db->prepare("SELECT 1 FROM staff_sub_unit_assignments assignment JOIN ministry_sub_units unit ON unit.id=assignment.sub_unit_id JOIN staff_users staff ON staff.id=assignment.staff_user_id WHERE staff.id=? AND staff.campus_id=? AND unit.campus_id=staff.campus_id AND unit.name='Teachers Welfare' AND unit.is_active=1 AND staff.is_active=1 AND staff.account_status='VERIFIED' AND staff.team_status<>'INACTIVE' LIMIT 1");$s->execute([$actor['id'],$actor['campus_id']]);return(bool)$s->fetchColumn();
}
// Use the existing Sunday schedule. MDWK is reminder-only, not attendance.
// Never backfill past services: that would invent historical absences.
function api_teacher_sync_services(PDO $db,array $actor,string $start,string $end): void {
    $now=api_teacher_now();$today=$now->format('Y-m-d');$zone=new DateTimeZone('Africa/Lagos');
    $from=max($start,$today);if($from>=$end)return;
    for($day=new DateTimeImmutable($from,$zone);$day->format('Y-m-d')<$end;$day=$day->modify('+1 day')){
        $date=$day->format('Y-m-d');
        if($day->format('w')==='0')tpk_ensure_sunday_sessions($db,(int)$actor['campus_id'],$day);
    }
    $s=$db->prepare("SELECT id,name,starts_at,ends_at FROM service_sessions WHERE campus_id=? AND service_date>=? AND service_date<? AND DAYOFWEEK(service_date)=1 AND ends_at IS NOT NULL ORDER BY starts_at");$s->execute([$actor['campus_id'],$from,$end]);
    foreach($s->fetchAll() as $session){
        $db->prepare("INSERT IGNORE INTO teacher_services(campus_id,kind,name,starts_at,ends_at,question,answer_hashes_json,created_by,service_session_id) VALUES(?,'SUNDAY',?,?,?,'','[]',?,?)")->execute([$actor['campus_id'],$session['name'],$session['starts_at'],$session['ends_at'],$actor['id'],$session['id']]);
        // Keep unstarted sessions in step with a changed Sunday schedule.
        $db->prepare("UPDATE teacher_services SET name=?,starts_at=?,ends_at=? WHERE campus_id=? AND service_session_id=? AND starts_at>?")->execute([$session['name'],$session['starts_at'],$session['ends_at'],$actor['campus_id'],$session['id'],$now->format('Y-m-d H:i:s')]);
    }
    $s=$db->prepare("SELECT id FROM teacher_services WHERE campus_id=? AND kind='SUNDAY' AND starts_at>=? AND starts_at<? AND ends_at>?");$s->execute([$actor['campus_id'],$start,$end,$now->format('Y-m-d H:i:s')]);
    foreach($s->fetchAll() as $row)api_teacher_expected($db,(int)$row['id'],(int)$actor['campus_id']);
}
function api_teacher_service(PDO $db,array $actor,int $id,bool $lock=false): array {
    $s=$db->prepare('SELECT * FROM teacher_services WHERE id=? AND campus_id=?'.($lock?' FOR UPDATE':''));$s->execute([$id,$actor['campus_id']]);$row=$s->fetch();
    if(!$row)api_error('SERVICE_NOT_FOUND','This teacher service is not available for your campus.',404);return $row;
}
function api_teacher_expected(PDO $db,int $id,int $campus): void {
    $db->prepare("INSERT IGNORE INTO teacher_service_expected(service_id,staff_user_id) SELECT ?,id FROM staff_users WHERE campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE'")->execute([$id,$campus]);
}
function api_teacher_queue_welfare(PDO $db,array $actor): void {
    // Idempotent on every attendance poll, including polls from ordinary teachers.
    $db->prepare("INSERT IGNORE INTO teacher_welfare_cases(service_id,staff_user_id) SELECT expected.service_id,expected.staff_user_id FROM teacher_service_expected expected JOIN teacher_services service ON service.id=expected.service_id LEFT JOIN teacher_service_attendance attendance ON attendance.service_id=expected.service_id AND attendance.staff_user_id=expected.staff_user_id WHERE service.campus_id=? AND service.kind='SUNDAY' AND service.ends_at<=? AND attendance.staff_user_id IS NULL")->execute([$actor['campus_id'],api_teacher_now()->format('Y-m-d H:i:s')]);
}
function api_teacher_attendance(PDO $db): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$manager=api_teacher_welfare_manager($db,$actor);$super=$actor['access_level']==='TPK_SUPER_ADMIN';
    $month=(string)($_GET['month']??api_teacher_now()->format('Y-m'));
    if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$month))api_error('VALIDATION_ERROR','Choose a valid month.',422);
    $start=$month.'-01';$end=(new DateTimeImmutable($start))->modify('+1 month')->format('Y-m-d');
    api_teacher_sync_services($db,$actor,$start,$end);
    $s=$db->prepare("SELECT id,kind,name,starts_at AS startsAt,ends_at AS endsAt,(question<>'') AS hasQuestion FROM teacher_services WHERE campus_id=? AND kind='SUNDAY' AND starts_at>=? AND starts_at<? ORDER BY starts_at");$s->execute([$actor['campus_id'],$start,$end]);$services=$s->fetchAll();foreach($services as &$row)$row['hasQuestion']=(bool)$row['hasQuestion'];unset($row);
    $now=api_teacher_now()->format('Y-m-d H:i:s');foreach($services as $row)if($now<$row['endsAt'])api_teacher_expected($db,(int)$row['id'],(int)$actor['campus_id']);
    api_teacher_queue_welfare($db,$actor);
    $id=(int)($_GET['serviceId']??0);$rows=[];
    if($id){$service=api_teacher_service($db,$actor,$id);if($service['kind']!=='SUNDAY')api_teacher_mdwk_removed($db);$s=$db->prepare("SELECT staff.id,staff.name,attendance.checked_in_at AS checkedInAt,attendance.attendance_mode AS attendanceMode,CASE WHEN attendance.staff_user_id IS NOT NULL THEN 'PRESENT' WHEN ? >= service.ends_at THEN 'ABSENT' ELSE 'AWAITING' END AS status FROM teacher_service_expected expected JOIN teacher_services service ON service.id=expected.service_id JOIN staff_users staff ON staff.id=expected.staff_user_id LEFT JOIN teacher_service_attendance attendance ON attendance.service_id=expected.service_id AND attendance.staff_user_id=expected.staff_user_id WHERE expected.service_id=? AND service.campus_id=? ORDER BY staff.name");$s->execute([$now,$id,$actor['campus_id']]);$rows=$s->fetchAll();}
    $s=$db->prepare("SELECT cases.id,cases.service_id AS serviceId,cases.staff_user_id AS teacherId,teacher.name AS teacherName,cases.assigned_to AS assignedTo,assignee.name AS assignedName,cases.status,cases.note,service.name AS serviceName,DATE(service.starts_at) AS serviceDate,profile.whatsapp_number AS phone FROM teacher_welfare_cases cases JOIN teacher_services service ON service.id=cases.service_id JOIN staff_users teacher ON teacher.id=cases.staff_user_id LEFT JOIN staff_users assignee ON assignee.id=cases.assigned_to LEFT JOIN teacher_profiles profile ON profile.staff_user_id=teacher.id WHERE service.campus_id=? AND service.kind='SUNDAY' AND service.starts_at>=? AND service.starts_at<?".($manager?'':' AND cases.assigned_to=?').' ORDER BY service.starts_at DESC,teacher.name');$params=[$actor['campus_id'],$start,$end];if(!$manager)$params[]=$actor['id'];$s->execute($params);$cases=$s->fetchAll();
    // Reasons never enter the public register or an ordinary assignee's response.
    if($manager){$s=$db->prepare('SELECT reason FROM teacher_service_absence_reasons WHERE service_id=? AND staff_user_id=?');foreach($cases as &$case){$s->execute([$case['serviceId'],$case['teacherId']]);$case['absenceReason']=$s->fetchColumn()?:null;}unset($case);}
    $teachers=[];if($manager){$s=$db->prepare("SELECT id,name FROM staff_users WHERE campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' ORDER BY name");$s->execute([$actor['campus_id']]);$teachers=$s->fetchAll();}
    $s=$db->prepare("SELECT DISTINCT staff.id,staff.name,profile.profile_image_url AS profileImageUrl,profile.whatsapp_number AS phone FROM staff_sub_unit_assignments assignment JOIN ministry_sub_units unit ON unit.id=assignment.sub_unit_id JOIN staff_users staff ON staff.id=assignment.staff_user_id LEFT JOIN teacher_profiles profile ON profile.staff_user_id=staff.id WHERE unit.campus_id=? AND unit.name='Teachers Welfare' AND unit.is_active=1 AND staff.campus_id=unit.campus_id AND staff.is_active=1 AND staff.account_status='VERIFIED' AND staff.team_status<>'INACTIVE' ORDER BY staff.name");$s->execute([$actor['campus_id']]);$welfareMembers=$s->fetchAll();
    api_ok(['welfareMembers'=>$welfareMembers,'services'=>$services,'items'=>$rows,'cases'=>$cases,'teachers'=>$teachers,'canManage'=>$manager,'canConfigure'=>$super,'serverTime'=>$now]);
}
function api_teacher_create_service(PDO $db): never {
    api_actor($db,true);api_error('USE_SUNDAY_SCHEDULE','Sunday services come from Sunday Schedule. Wednesday service has a reminder only.',409);
}
function api_teacher_qr(PDO $db,int $id): never {
    api_actor($db);api_error('QR_NOT_REQUIRED','Sunday attendance uses the I’m here button. No QR is required.',409);
}
function api_teacher_signin_window(array $service,?DateTimeImmutable $clock=null): void {
    if($service['kind']!=='SUNDAY')api_error('MDWK_SIGNIN_REMOVED','Wednesday service no longer requires sign-in.',410);
    $now=($clock??api_teacher_now())->setTimezone(new DateTimeZone('Africa/Lagos'))->format('Y-m-d H:i:s');
    $opens=substr($service['starts_at'],0,10).' 06:00:00';
    if($now<$opens||$now>=$service['ends_at'])api_error('SIGNIN_CLOSED','Sunday sign-in opens at 6am Lagos time and closes when this service ends.',409);
}
function api_teacher_security(PDO $db,int $id): never {
    $actor=api_actor($db,true);api_teacher_attendance_ready($db);$v=api_input();
    $service=api_teacher_service($db,$actor,$id);
    if($service['kind']!=='SUNDAY')api_error('MDWK_NO_QUESTION','Wednesday does not use a security question.',409);
    // Reuse strict question/answer validation without exposing saved answer hashes.
    $date=substr($service['starts_at'],0,10);
    $values=api_teacher_service_values(['kind'=>$service['kind'],'date'=>$date,'startTime'=>substr($service['starts_at'],11,5),'endTime'=>substr($service['ends_at'],11,5),'name'=>$service['name'],'question'=>$v['question']??'','answers'=>$v['answers']??[]]);
    $db->beginTransaction();try{$service=api_teacher_service($db,$actor,$id,true);if($service['ends_at']<=api_teacher_now()->format('Y-m-d H:i:s')){$db->rollBack();api_error('SIGNIN_CLOSED','A finished service is read-only.',409);}
    $db->prepare('UPDATE teacher_services SET question=?,answer_hashes_json=?,qr_hash=NULL,qr_expires_at=NULL WHERE id=?')->execute([$values[4],$values[5],$id]);
    api_audit($db,$actor,'TEACHER_SECURITY_QUESTION_UPDATED','TeacherService',$id);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['saved'=>true]);
}
function api_teacher_valid_qr(array $service,string $token): void {
    if($service['kind']!=='SUNDAY')api_error('MDWK_NO_QR','Use the Wednesday confirmation button on Overview.',409);
    $now=api_teacher_now()->format('Y-m-d H:i:s');
    if($now<$service['starts_at']||$now>=$service['ends_at'])api_error('SIGNIN_CLOSED','Teacher sign-in is closed for this service.',409);
    if(!preg_match('/^[a-f0-9]{64}$/',$token)||empty($service['qr_hash'])||empty($service['qr_expires_at'])||$now>=$service['qr_expires_at']||!hash_equals($service['qr_hash'],hash('sha256',$token)))api_error('QR_EXPIRED','Scan the current church QR. This code is expired or has been replaced.',422);
}
function api_teacher_challenge(PDO $db,int $id): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$service=api_teacher_service($db,$actor,$id);api_teacher_signin_window($service);
    api_ok(['question'=>$service['question'],'serviceName'=>$service['name'],'serviceDate'=>substr($service['starts_at'],0,10),'teacherName'=>$actor['name']]);
}
function api_teacher_signin(PDO $db,int $id): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$v=api_input();$db->beginTransaction();
    try{$service=api_teacher_service($db,$actor,$id,true);api_teacher_signin_window($service);
    // The authenticated teacher confirms their own presence. A knowledge
    // question is no longer required; identity, campus and time checks remain.
    if(($v['attended']??null)!==true){$db->rollBack();api_error('VALIDATION_ERROR','Confirm that you are here for this service.',422);}
    $s=$db->prepare('SELECT checked_in_at FROM teacher_service_attendance WHERE service_id=? AND staff_user_id=?');$s->execute([$id,$actor['id']]);if($existing=$s->fetch()){ $db->commit();api_ok(['teacherName'=>$actor['name'],'checkedInAt'=>$existing['checked_in_at'],'alreadySignedIn'=>true]); }
    $stamp=api_teacher_now()->format('Y-m-d H:i:s');
    $db->prepare('INSERT IGNORE INTO teacher_service_expected(service_id,staff_user_id) VALUES(?,?)')->execute([$id,$actor['id']]);$db->prepare('INSERT INTO teacher_service_attendance(service_id,staff_user_id,checked_in_at) VALUES(?,?,?)')->execute([$id,$actor['id'],$stamp]);api_audit($db,$actor,'TEACHER_SIGNED_IN','TeacherService',$id);$db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['teacherName'=>$actor['name'],'checkedInAt'=>$stamp]);
}
function api_teacher_welfare_lead(PDO $db,int $teacherId): never {
    api_actor($db,true);api_error('USE_SUB_UNIT','Welfare access comes from the Teachers Welfare subunit in Team.',409);
}
// Keep old URLs explicit for cached clients, but never write MDWK attendance.
function api_teacher_mdwk_removed(PDO $db): never {
    api_actor($db);api_error('MDWK_SIGNIN_REMOVED','Wednesday service has a reminder only. No sign-in is required.',410);
}
function api_teacher_my_mdwk(PDO $db): never { api_teacher_mdwk_removed($db); }
function api_teacher_confirm_mdwk(PDO $db,int $id,?DateTimeImmutable $now=null): never { api_teacher_mdwk_removed($db); }
function api_teacher_absence_reason(PDO $db,int $id): never { api_teacher_mdwk_removed($db); }

function api_teacher_my_sunday(PDO $db,?DateTimeImmutable $clock=null): never {
    $actor=api_actor($db);$now=($clock??api_teacher_now())->setTimezone(new DateTimeZone('Africa/Lagos'));$stamp=$now->format('Y-m-d H:i:s');
    if($now->format('w')!=='0'||$now->format('H:i:s')<'06:00:00')api_ok(['services'=>[],'serverTime'=>$stamp]);
    api_teacher_attendance_ready($db);
    $date=$now->format('Y-m-d');$end=$now->modify('+1 day')->format('Y-m-d');
    api_teacher_sync_services($db,$actor,$date,$end);
    $s=$db->prepare("SELECT service.id,service.kind,service.name,service.starts_at AS startsAt,service.ends_at AS endsAt,attendance.checked_in_at AS checkedInAt FROM teacher_services service LEFT JOIN teacher_service_attendance attendance ON attendance.service_id=service.id AND attendance.staff_user_id=? WHERE service.campus_id=? AND service.kind='SUNDAY' AND service.starts_at>=? AND service.starts_at<? AND service.ends_at>? ORDER BY service.starts_at");
    $s->execute([$actor['id'],$actor['campus_id'],$date,$end,$stamp]);
    api_ok(['services'=>$s->fetchAll(),'serverTime'=>$stamp]);
}

// Date-stable notification ID allows teachers to dismiss each week's reminder.
function api_teacher_wednesday_reminder(?DateTimeImmutable $clock=null): ?array {
    $now=($clock??api_teacher_now())->setTimezone(new DateTimeZone('Africa/Lagos'));
    if($now->format('w')!=='3'||$now->format('H:i:s')<'06:00:00'||$now->format('H:i:s')>='21:00:00')return null;
    return ['id'=>'mdwk-service-'.$now->format('Y-m-d'),'kind'=>'SERVICE','severity'=>'MEDIUM','title'=>'MDWK is today','detail'=>'Join Wednesday service in church or online. No sign-in is required.','href'=>'/account/overview'];
}

function api_teacher_welfare_case(PDO $db,int $id): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$manager=api_teacher_welfare_manager($db,$actor);$v=api_input();$db->beginTransaction();
    try{$s=$db->prepare('SELECT cases.* FROM teacher_welfare_cases cases JOIN teacher_services service ON service.id=cases.service_id WHERE cases.id=? AND service.campus_id=? FOR UPDATE');$s->execute([$id,$actor['campus_id']]);$case=$s->fetch();if(!$case){$db->rollBack();api_error('CASE_NOT_FOUND','This welfare task is not available.',404);}
    if(array_key_exists('assignedTo',$v)){
        if(!$manager){$db->rollBack();api_error('FORBIDDEN','Only Teacher Welfare Leads and Super Admins can assign teacher follow-up.',403);}
        $assigned=(int)$v['assignedTo'];$s=$db->prepare("SELECT id FROM staff_users WHERE id=? AND campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE'");$s->execute([$assigned,$actor['campus_id']]);if(!$s->fetch()||$assigned===(int)$case['staff_user_id']){$db->rollBack();api_error('VALIDATION_ERROR','Choose another active campus teacher to follow up.',422);}
        $db->prepare('UPDATE teacher_welfare_cases SET assigned_to=?,updated_by=? WHERE id=?')->execute([$assigned,$actor['id'],$id]);$action='ASSIGNED';$note='Assigned teacher #'.$assigned;
    }else{
        if(!$manager&&(int)$case['assigned_to']!==(int)$actor['id']){$db->rollBack();api_error('FORBIDDEN','Only the assigned teacher or welfare lead may update this task.',403);}
        $status=(string)($v['status']??'');$note=trim((string)($v['note']??''));if(!in_array($status,['ATTEMPTED','CONTACTED'],true)||$note===''||strlen($note)>4000){$db->rollBack();api_error('VALIDATION_ERROR','Choose an outcome and add a short follow-up note.',422);}
        $db->prepare('UPDATE teacher_welfare_cases SET status=?,note=?,updated_by=? WHERE id=?')->execute([$status,$note,$actor['id'],$id]);$action=$status;
    }
    $db->prepare('INSERT INTO teacher_welfare_events(case_id,actor_id,action,note) VALUES(?,?,?,?)')->execute([$id,$actor['id'],$action,$note]);api_audit($db,$actor,'TEACHER_WELFARE_'.$action,'TeacherWelfareCase',$id);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['saved'=>true]);
}
