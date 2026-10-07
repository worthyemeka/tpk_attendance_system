<?php
declare(strict_types=1);
// Explicit opt-in: real MySQL syntax/schema, connection-local temporary attendance
// tables, no staff sessions, persistent attendance, welfare records or audit writes.
if (getenv('TPK_MYSQL_SMOKE') !== '1') { echo "Skipped: set TPK_MYSQL_SMOKE=1 for isolated MySQL checks.\n"; exit; }
require __DIR__.'/../config.php';
require __DIR__.'/../public/teacher-attendance.php';
require __DIR__.'/../public/curriculum.php';
class MysqlSmokeResult extends RuntimeException { public function __construct(public array $data){parent::__construct('Result');} }
class MysqlSmokeError extends RuntimeException { public function __construct(public string $apiCode){parent::__construct($apiCode);} }
function api_ok(array $data,int $status=200):void {throw new MysqlSmokeResult($data);}
function api_error(string $code,string $message,int $status=400):void {throw new MysqlSmokeError($code);}
function api_actor(PDO $db,bool $super=false):array {if($super&&$GLOBALS['smokeActor']['access_level']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super required',403);return $GLOBALS['smokeActor'];}
function api_input():array {return $GLOBALS['smokeInput'];}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void {/* isolated diagnostic, not a real user action */}
function api_table_exists(PDO $db,string $table):bool {$q=$db->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$q->execute([$table]);return (bool)$q->fetchColumn();}
function smokeResult(callable $fn):array {try{$fn();}catch(MysqlSmokeResult $result){return $result->data;}throw new RuntimeException('Missing result.');}
function smokeCheck(bool $ok,string $label):void {if(!$ok)throw new RuntimeException($label);}
function smokeReject(callable $fn,string $code):void {try{$fn();}catch(MysqlSmokeError $error){smokeCheck($error->apiCode===$code,'Wrong rejection');return;}throw new RuntimeException('Expected rejection');}
$db=db();$temporary=[];$smokeInput=[];
$smokeActor=$db->query("SELECT id,campus_id,name,access_level FROM staff_users WHERE access_level='TPK_SUPER_ADMIN' AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' ORDER BY id LIMIT 1")->fetch();
if(!$smokeActor)throw new RuntimeException('An active campus is needed for this diagnostic.');
$owner=$smokeActor;
try {
    $curriculum=smokeResult(fn()=>api_curriculum($db));
    smokeCheck($curriculum['available']&&count($curriculum['classes'])>0,'Live curriculum storage/classes unavailable');
    echo "PASS: curriculum reads the installed MySQL schema and existing classes.\n";
    foreach(['ministry_sub_units','staff_sub_unit_assignments','service_sessions','sunday_service_plans','teacher_services','teacher_service_expected','teacher_service_attendance','teacher_service_absence_reasons','teacher_welfare_leads','teacher_signin_attempts','teacher_welfare_cases','teacher_welfare_events'] as $table){
        $copy=in_array($table,['ministry_sub_units','staff_sub_unit_assignments'],true)?$db->query('SELECT * FROM `'.$table.'`')->fetchAll():[];
        $definition=$db->query('SHOW CREATE TABLE `'.$table.'`')->fetch(PDO::FETCH_NUM)[1];
        // MySQL rejects self-named LIKE aliases and foreign keys on temporary tables.
        $definition=preg_replace('/^CREATE TABLE /','CREATE TEMPORARY TABLE ',$definition);
        $definition=preg_replace('/^\s*CONSTRAINT[^\n]*\n/m','',$definition);
        $definition=preg_replace('/,\s*\)/',')',$definition);
        $db->exec($definition);$temporary[]=$table;
        foreach($copy as $row){$columns=implode(',',array_map(fn($c)=>'`'.$c.'`',array_keys($row)));$marks=implode(',',array_fill(0,count($row),'?'));$db->prepare('INSERT INTO `'.$table.'`('.$columns.') VALUES('.$marks.')')->execute(array_values($row));}
    }
    $nextSunday=api_teacher_now()->modify('next sunday')->format('Y-m-d');
    $smokeInput=['kind'=>'SUNDAY','date'=>$nextSunday,'name'=>'Temporary diagnostic','startTime'=>'08:00','endTime'=>'13:00','question'=>'Diagnostic colour?','answers'=>['Blue']];
    // Fixture creation bypasses the removed manual creation API, not permissions.
    $values=api_teacher_service_values($smokeInput);$db->prepare('INSERT INTO teacher_services(campus_id,kind,name,starts_at,ends_at,question,answer_hashes_json,created_by) VALUES(?,?,?,?,?,?,?,?)')->execute(array_merge([$owner['campus_id']],$values,[$owner['id']]));$id=(int)$db->lastInsertId();api_teacher_expected($db,$id,(int)$owner['campus_id']);
    $q=$db->prepare("SELECT COUNT(*) FROM staff_users WHERE campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE'");$q->execute([$owner['campus_id']]);$expected=(int)$q->fetchColumn();
    smokeCheck((int)$db->query('SELECT COUNT(*) FROM teacher_service_expected')->fetchColumn()===$expected,'Not every active teacher was expected');
    $q=$db->prepare('UPDATE teacher_services SET starts_at=?,ends_at=? WHERE id=?');$q->execute([api_teacher_now()->modify('-5 minutes')->format('Y-m-d H:i:s'),api_teacher_now()->modify('+1 hour')->format('Y-m-d H:i:s'),$id]);
    smokeReject(fn()=>api_teacher_qr($db,$id),'QR_NOT_REQUIRED');$_GET=[];
    smokeCheck(smokeResult(fn()=>api_teacher_challenge($db,$id))['question']==='Diagnostic colour?','Button challenge failed');
    $db->prepare("UPDATE teacher_services SET question='',answer_hashes_json='[]' WHERE id=?")->execute([$id]);
    $smokeInput=['attended'=>false];smokeReject(fn()=>api_teacher_signin($db,$id),'VALIDATION_ERROR');
    smokeCheck((int)$db->query('SELECT COUNT(*) FROM teacher_service_attendance')->fetchColumn()===0,'Missing confirmation recorded attendance');
    $smokeInput=['attended'=>true,'teacherId'=>999999];smokeResult(fn()=>api_teacher_signin($db,$id));
    smokeCheck(smokeResult(fn()=>api_teacher_signin($db,$id))['alreadySignedIn']===true,'Repeat sign-in was not idempotent');
    $db->exec("UPDATE teacher_services SET ends_at='2000-01-01 00:00:00'");
    $_GET=['month'=>api_teacher_now()->format('Y-m'),'serviceId'=>$id];$register=smokeResult(fn()=>api_teacher_attendance($db));
    smokeCheck(count($register['items'])===$expected,'Attendance register missing teachers');
    smokeCheck(count(array_filter($register['items'],fn($r)=>$r['status']==='PRESENT'))===1,'Verified teacher not present');
    smokeCheck(count($register['cases'])===max(0,$expected-1),'Unsigned teachers not queued');
    smokeResult(fn()=>api_teacher_attendance($db));
    smokeCheck((int)$db->query('SELECT COUNT(*) FROM teacher_welfare_cases')->fetchColumn()===max(0,$expected-1),'Welfare queue duplicated');
    if($register['cases']){
        $caseId=(int)$register['cases'][0]['id'];
        $smokeInput=['assignedTo'=>(int)$owner['id']];smokeResult(fn()=>api_teacher_welfare_case($db,$caseId));
        $db->prepare('DELETE FROM staff_sub_unit_assignments WHERE staff_user_id=?')->execute([$owner['id']]);
        $db->prepare('INSERT INTO teacher_welfare_leads(staff_user_id,campus_id,appointed_by) VALUES(?,?,?)')->execute([$owner['id'],$owner['campus_id'],$owner['id']]);
        $smokeActor['access_level']='TPK_ADMIN';
        smokeCheck(!api_teacher_welfare_manager($db,$smokeActor),'Manual lead still grants welfare access');
        $unit=$db->prepare("SELECT id FROM ministry_sub_units WHERE campus_id=? AND name='Teachers Welfare'");$unit->execute([$owner['campus_id']]);$unitId=$unit->fetchColumn();
        $db->prepare('INSERT INTO staff_sub_unit_assignments(staff_user_id,sub_unit_id,assigned_by_staff_user_id) VALUES(?,?,?)')->execute([$owner['id'],$unitId,$owner['id']]);
        smokeCheck(api_teacher_welfare_manager($db,$smokeActor),'Existing welfare subunit lacks permission');
        $smokeInput=['status'=>'CONTACTED','note'=>'Temporary diagnostic outcome'];smokeResult(fn()=>api_teacher_welfare_case($db,$caseId));
        smokeCheck($db->query('SELECT status FROM teacher_welfare_cases WHERE id='.$caseId)->fetchColumn()==='CONTACTED','Welfare outcome not saved');
        $smokeActor=$owner;
    }
    // Historical MDWK data is retained, but no new attendance or welfare is generated.
    $db->prepare("INSERT INTO teacher_services(campus_id,kind,name,starts_at,ends_at,question,answer_hashes_json,created_by) VALUES(?,'MDWK','Historical MDWK','2000-01-05 00:00:00','2000-01-05 21:00:00','','[]',?)")->execute([$owner['campus_id'],$owner['id']]);$wid=(int)$db->lastInsertId();
    api_teacher_expected($db,$wid,(int)$owner['campus_id']);
    $db->prepare("INSERT INTO teacher_service_attendance(service_id,staff_user_id,checked_in_at,attendance_mode) VALUES(?,?,'2000-01-05 20:00:00','ONLINE')")->execute([$wid,$owner['id']]);
    $db->prepare("INSERT INTO teacher_service_absence_reasons(service_id,staff_user_id,reason) VALUES(?,?,'Historical private reason')")->execute([$wid,$owner['id']]);
    $smokeInput=['attended'=>true,'attendanceMode'=>'ONLINE','reason'=>'New reason'];
    smokeReject(fn()=>api_teacher_confirm_mdwk($db,$wid),'MDWK_SIGNIN_REMOVED');
    smokeReject(fn()=>api_teacher_absence_reason($db,$wid),'MDWK_SIGNIN_REMOVED');
    smokeReject(fn()=>api_teacher_my_mdwk($db),'MDWK_SIGNIN_REMOVED');
    api_teacher_queue_welfare($db,$owner);
    smokeCheck((int)$db->query('SELECT COUNT(*) FROM teacher_welfare_cases WHERE service_id='.$wid)->fetchColumn()===0,'MDWK still queues absences');
    smokeCheck($db->query('SELECT attendance_mode FROM teacher_service_attendance WHERE service_id='.$wid)->fetchColumn()==='ONLINE','Historical MDWK attendance changed');
    smokeCheck($db->query('SELECT reason FROM teacher_service_absence_reasons WHERE service_id='.$wid)->fetchColumn()==='Historical private reason','Historical private reason changed');
    $_GET=['month'=>api_teacher_now()->format('Y-m')];$scheduled=smokeResult(fn()=>api_teacher_attendance($db));
    foreach($scheduled['services'] as $service)smokeCheck($service['kind']==='SUNDAY','MDWK exposed in current register');
    $linked=(int)$db->query('SELECT COUNT(*) FROM teacher_services WHERE service_session_id IS NOT NULL')->fetchColumn();smokeCheck($linked>0,'Sunday services not linked to configured sessions');
    $clock=new DateTimeImmutable($nextSunday.' 06:00:00',new DateTimeZone('Africa/Lagos'));
    $mySunday=smokeResult(fn()=>api_teacher_my_sunday($db,$clock));
    smokeCheck(count($mySunday['services'])===2,'Both configured Sunday services should appear at 6am');
    foreach($mySunday['services'] as $service)smokeCheck(array_key_exists('checkedInAt',$service)&&!isset($service['teacherName']),'Overview response contains only own attendance');
    smokeCheck(smokeResult(fn()=>api_teacher_my_sunday($db,$clock->modify('-1 second')))['services']===[],'Overview visible before 6am');
    smokeCheck((int)$db->query("SELECT COUNT(*) FROM teacher_services WHERE kind='MDWK'")->fetchColumn()===1,'Sync created new MDWK services');
    if(api_teacher_now()->format('w')!=='0')smokeCheck(smokeResult(fn()=>api_teacher_my_sunday($db))['services']===[],'Overview shows sign-in on a weekday');
    echo "PASS: MySQL Sunday linking, all-active expectation, question-free confirmation, repeat sign-in and subunit-based welfare.\n";
    echo "PASS: MDWK writes disabled, historical records retained and no new Wednesday welfare tasks.\n";
} finally {
    if($db->inTransaction())$db->rollBack();
    foreach(array_reverse($temporary) as $table)$db->exec('DROP TEMPORARY TABLE `'.$table.'`');
}
echo "Temporary tables removed; no persistent sign-ins, services, welfare assignments or staff sessions created.\n";
