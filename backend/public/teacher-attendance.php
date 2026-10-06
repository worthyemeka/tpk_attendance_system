<?php
declare(strict_types=1);

function api_teacher_attendance_ready(PDO $db): void {
    foreach (['teacher_services','teacher_service_expected','teacher_service_attendance','teacher_welfare_leads','teacher_signin_attempts','teacher_welfare_cases','teacher_welfare_events'] as $table)
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
    if($name===''||strlen($name)>150||$question===''||strlen($question)>250||!is_array($answers)||count($answers)<1||count($answers)>5)api_error('VALIDATION_ERROR','Provide a name, today’s question and 1–5 accepted answers.',422);
    $hashes=[];foreach($answers as $answer){if(!is_string($answer)||api_teacher_answer($answer)===''||strlen($answer)>100)api_error('VALIDATION_ERROR','Accepted answers must be 1–100 characters.',422);$hashes[]=password_hash(api_teacher_answer($answer),PASSWORD_DEFAULT);}
    return [$kind,$name,$date.' '.$start.':00',$date.' '.$end.':00',$question,json_encode($hashes)];
}
function api_teacher_welfare_manager(PDO $db,array $actor): bool {
    if($actor['access_level']==='TPK_SUPER_ADMIN')return true;
    $s=$db->prepare('SELECT 1 FROM teacher_welfare_leads WHERE staff_user_id=? AND campus_id=?');$s->execute([$actor['id'],$actor['campus_id']]);return(bool)$s->fetchColumn();
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
    $db->prepare("INSERT IGNORE INTO teacher_welfare_cases(service_id,staff_user_id) SELECT expected.service_id,expected.staff_user_id FROM teacher_service_expected expected JOIN teacher_services service ON service.id=expected.service_id LEFT JOIN teacher_service_attendance attendance ON attendance.service_id=expected.service_id AND attendance.staff_user_id=expected.staff_user_id WHERE service.campus_id=? AND service.ends_at<=? AND attendance.staff_user_id IS NULL")->execute([$actor['campus_id'],api_teacher_now()->format('Y-m-d H:i:s')]);
}
function api_teacher_attendance(PDO $db): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$manager=api_teacher_welfare_manager($db,$actor);$super=$actor['access_level']==='TPK_SUPER_ADMIN';
    $month=(string)($_GET['month']??api_teacher_now()->format('Y-m'));
    if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$month))api_error('VALIDATION_ERROR','Choose a valid month.',422);
    $start=$month.'-01';$end=(new DateTimeImmutable($start))->modify('+1 month')->format('Y-m-d');
    $s=$db->prepare('SELECT id,kind,name,starts_at AS startsAt,ends_at AS endsAt FROM teacher_services WHERE campus_id=? AND starts_at>=? AND starts_at<? ORDER BY starts_at DESC');$s->execute([$actor['campus_id'],$start,$end]);$services=$s->fetchAll();
    $now=api_teacher_now()->format('Y-m-d H:i:s');foreach($services as $row)if($now<$row['endsAt'])api_teacher_expected($db,(int)$row['id'],(int)$actor['campus_id']);
    api_teacher_queue_welfare($db,$actor);
    $id=(int)($_GET['serviceId']??0);$rows=[];
    if($id){$service=api_teacher_service($db,$actor,$id);$s=$db->prepare("SELECT staff.id,staff.name,attendance.checked_in_at AS checkedInAt,CASE WHEN attendance.staff_user_id IS NOT NULL THEN 'PRESENT' WHEN ? >= service.ends_at THEN 'ABSENT' ELSE 'AWAITING' END AS status FROM teacher_service_expected expected JOIN teacher_services service ON service.id=expected.service_id JOIN staff_users staff ON staff.id=expected.staff_user_id LEFT JOIN teacher_service_attendance attendance ON attendance.service_id=expected.service_id AND attendance.staff_user_id=expected.staff_user_id WHERE expected.service_id=? AND service.campus_id=? ORDER BY staff.name");$s->execute([$now,$id,$actor['campus_id']]);$rows=$s->fetchAll();}
    $s=$db->prepare("SELECT cases.id,cases.service_id AS serviceId,cases.staff_user_id AS teacherId,teacher.name AS teacherName,cases.assigned_to AS assignedTo,assignee.name AS assignedName,cases.status,cases.note,service.name AS serviceName,DATE(service.starts_at) AS serviceDate,profile.whatsapp_number AS phone FROM teacher_welfare_cases cases JOIN teacher_services service ON service.id=cases.service_id JOIN staff_users teacher ON teacher.id=cases.staff_user_id LEFT JOIN staff_users assignee ON assignee.id=cases.assigned_to LEFT JOIN teacher_profiles profile ON profile.staff_user_id=teacher.id WHERE service.campus_id=? AND service.starts_at>=? AND service.starts_at<?".($manager?'':' AND cases.assigned_to=?').' ORDER BY service.starts_at DESC,teacher.name');$params=[$actor['campus_id'],$start,$end];if(!$manager)$params[]=$actor['id'];$s->execute($params);$cases=$s->fetchAll();
    $teachers=[];$leads=[];if($manager){$s=$db->prepare("SELECT id,name FROM staff_users WHERE campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' ORDER BY name");$s->execute([$actor['campus_id']]);$teachers=$s->fetchAll();}
    if($super){$s=$db->prepare('SELECT staff_user_id AS id FROM teacher_welfare_leads WHERE campus_id=?');$s->execute([$actor['campus_id']]);$leads=$s->fetchAll();}
    api_ok(['services'=>$services,'items'=>$rows,'cases'=>$cases,'teachers'=>$teachers,'leads'=>$leads,'canManage'=>$manager,'canConfigure'=>$super,'serverTime'=>$now]);
}
function api_teacher_create_service(PDO $db): never {
    $actor=api_actor($db,true);api_teacher_attendance_ready($db);[$kind,$name,$start,$end,$question,$hashes]=api_teacher_service_values(api_input());
    if($end<=api_teacher_now()->format('Y-m-d H:i:s'))api_error('VALIDATION_ERROR','Do not create an already-finished attendance service.',422);
    $db->beginTransaction();try{$db->prepare('INSERT INTO teacher_services(campus_id,kind,name,starts_at,ends_at,question,answer_hashes_json,created_by) VALUES(?,?,?,?,?,?,?,?)')->execute([$actor['campus_id'],$kind,$name,$start,$end,$question,$hashes,$actor['id']]);$id=(int)$db->lastInsertId();api_teacher_expected($db,$id,(int)$actor['campus_id']);api_audit($db,$actor,'TEACHER_SERVICE_CREATED','TeacherService',$id);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['id'=>$id],201);
}
function api_teacher_qr(PDO $db,int $id): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);if(!api_teacher_welfare_manager($db,$actor))api_error('FORBIDDEN','Only a Teacher Welfare Lead or Super Admin may display the service QR.',403);
    $db->beginTransaction();try{$service=api_teacher_service($db,$actor,$id,true);$now=api_teacher_now();if($now->format('Y-m-d H:i:s')<$service['starts_at']||$now->format('Y-m-d H:i:s')>=$service['ends_at']){ $db->rollBack();api_error('SIGNIN_CLOSED','The QR is available only while this service’s sign-in window is open.',409); }
    $token=bin2hex(random_bytes(32));$expires=min($now->modify('+5 minutes')->format('Y-m-d H:i:s'),$service['ends_at']);$db->prepare('UPDATE teacher_services SET qr_hash=?,qr_expires_at=? WHERE id=?')->execute([hash('sha256',$token),$expires,$id]);api_audit($db,$actor,'TEACHER_QR_ROTATED','TeacherService',$id);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['token'=>$token,'serviceId'=>$id,'expiresAt'=>$expires]);
}
function api_teacher_security(PDO $db,int $id): never {
    $actor=api_actor($db,true);api_teacher_attendance_ready($db);$v=api_input();
    $service=api_teacher_service($db,$actor,$id);
    // Reuse strict question/answer validation without exposing saved answer hashes.
    $date=substr($service['starts_at'],0,10);
    $values=api_teacher_service_values(['kind'=>$service['kind'],'date'=>$date,'startTime'=>substr($service['starts_at'],11,5),'endTime'=>substr($service['ends_at'],11,5),'name'=>$service['name'],'question'=>$v['question']??'','answers'=>$v['answers']??[]]);
    $db->beginTransaction();try{$service=api_teacher_service($db,$actor,$id,true);if($service['ends_at']<=api_teacher_now()->format('Y-m-d H:i:s')){$db->rollBack();api_error('SIGNIN_CLOSED','A finished service is read-only.',409);}
    $db->prepare('UPDATE teacher_services SET question=?,answer_hashes_json=?,qr_hash=NULL,qr_expires_at=NULL WHERE id=?')->execute([$values[4],$values[5],$id]);
    api_audit($db,$actor,'TEACHER_SECURITY_QUESTION_UPDATED','TeacherService',$id);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['saved'=>true]);
}
function api_teacher_valid_qr(array $service,string $token): void {
    $now=api_teacher_now()->format('Y-m-d H:i:s');
    if($now<$service['starts_at']||$now>=$service['ends_at'])api_error('SIGNIN_CLOSED','Teacher sign-in is closed for this service.',409);
    if(!preg_match('/^[a-f0-9]{64}$/',$token)||empty($service['qr_hash'])||empty($service['qr_expires_at'])||$now>=$service['qr_expires_at']||!hash_equals($service['qr_hash'],hash('sha256',$token)))api_error('QR_EXPIRED','Scan the current church QR. This code is expired or has been replaced.',422);
}
function api_teacher_challenge(PDO $db,int $id): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$service=api_teacher_service($db,$actor,$id);api_teacher_valid_qr($service,(string)($_GET['token']??''));
    api_ok(['question'=>$service['question'],'serviceName'=>$service['name'],'serviceDate'=>substr($service['starts_at'],0,10),'teacherName'=>$actor['name']]);
}
function api_teacher_signin(PDO $db,int $id): never {
    $actor=api_actor($db);api_teacher_attendance_ready($db);$v=api_input();$db->beginTransaction();
    try{$service=api_teacher_service($db,$actor,$id,true);api_teacher_valid_qr($service,(string)($v['token']??''));
    $s=$db->prepare('SELECT checked_in_at FROM teacher_service_attendance WHERE service_id=? AND staff_user_id=?');$s->execute([$id,$actor['id']]);if($existing=$s->fetch()){ $db->commit();api_ok(['teacherName'=>$actor['name'],'checkedInAt'=>$existing['checked_in_at'],'alreadySignedIn'=>true]); }
    $now=api_teacher_now();$stamp=$now->format('Y-m-d H:i:s');$s=$db->prepare('SELECT attempts,window_started_at FROM teacher_signin_attempts WHERE service_id=? AND staff_user_id=? FOR UPDATE');$s->execute([$id,$actor['id']]);$attempt=$s->fetch();$recent=$attempt&&$attempt['window_started_at']>$now->modify('-15 minutes')->format('Y-m-d H:i:s');
    if($recent&&(int)$attempt['attempts']>=5){$db->rollBack();api_error('RATE_LIMITED','Too many answers. Wait 15 minutes, or speak to a service lead.',429);}
    $count=$recent?(int)$attempt['attempts']+1:1;$window=$recent?$attempt['window_started_at']:$stamp;
    $db->prepare('INSERT INTO teacher_signin_attempts(service_id,staff_user_id,attempts,window_started_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE attempts=VALUES(attempts),window_started_at=VALUES(window_started_at)')->execute([$id,$actor['id'],$count,$window]);
    $answer=is_string($v['answer']??null)?api_teacher_answer($v['answer']):'';$valid=false;if(strlen($answer)<=100&&$answer!=='')foreach(json_decode($service['answer_hashes_json'],true)?:[] as $hash)if(password_verify($answer,$hash)){$valid=true;break;}
    if(!$valid){$db->commit();api_error('ANSWER_INCORRECT','That answer does not match today’s question. Please check with the service lead.',422);}
    $db->prepare('INSERT IGNORE INTO teacher_service_expected(service_id,staff_user_id) VALUES(?,?)')->execute([$id,$actor['id']]);$db->prepare('INSERT INTO teacher_service_attendance(service_id,staff_user_id,checked_in_at) VALUES(?,?,?)')->execute([$id,$actor['id'],$stamp]);api_audit($db,$actor,'TEACHER_SIGNED_IN','TeacherService',$id);$db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['teacherName'=>$actor['name'],'checkedInAt'=>$stamp]);
}
function api_teacher_welfare_lead(PDO $db,int $teacherId): never {
    $actor=api_actor($db,true);api_teacher_attendance_ready($db);$v=api_input();if(!is_bool($v['enabled']??null))api_error('VALIDATION_ERROR','Choose whether to appoint this lead.',422);
    $s=$db->prepare("SELECT id FROM staff_users WHERE id=? AND campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE'");$s->execute([$teacherId,$actor['campus_id']]);if(!$s->fetch())api_error('TEACHER_NOT_FOUND','Choose an active teacher from this campus.',404);
    if($v['enabled'])$db->prepare('INSERT INTO teacher_welfare_leads(staff_user_id,campus_id,appointed_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE appointed_by=VALUES(appointed_by)')->execute([$teacherId,$actor['campus_id'],$actor['id']]);else $db->prepare('DELETE FROM teacher_welfare_leads WHERE staff_user_id=? AND campus_id=?')->execute([$teacherId,$actor['campus_id']]);api_audit($db,$actor,$v['enabled']?'WELFARE_LEAD_APPOINTED':'WELFARE_LEAD_REMOVED','StaffUser',$teacherId);api_ok(['saved'=>true]);
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
