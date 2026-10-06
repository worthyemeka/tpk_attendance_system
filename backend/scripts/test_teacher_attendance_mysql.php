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
    foreach(['teacher_services','teacher_service_expected','teacher_service_attendance','teacher_welfare_leads','teacher_signin_attempts','teacher_welfare_cases','teacher_welfare_events'] as $table){
        $definition=$db->query('SHOW CREATE TABLE `'.$table.'`')->fetch(PDO::FETCH_NUM)[1];
        // MySQL rejects self-named LIKE aliases and foreign keys on temporary tables.
        $definition=preg_replace('/^CREATE TABLE /','CREATE TEMPORARY TABLE ',$definition);
        $definition=preg_replace('/^\s*CONSTRAINT[^\n]*\n/m','',$definition);
        $definition=preg_replace('/,\s*\)/',')',$definition);
        $db->exec($definition);$temporary[]=$table;
    }
    $nextSunday=api_teacher_now()->modify('next sunday')->format('Y-m-d');
    $smokeInput=['kind'=>'SUNDAY','date'=>$nextSunday,'name'=>'Temporary diagnostic','startTime'=>'08:00','endTime'=>'13:00','question'=>'Diagnostic colour?','answers'=>['Blue']];
    $service=smokeResult(fn()=>api_teacher_create_service($db));$id=(int)$service['id'];
    $q=$db->prepare("SELECT COUNT(*) FROM staff_users WHERE campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE'");$q->execute([$owner['campus_id']]);$expected=(int)$q->fetchColumn();
    smokeCheck((int)$db->query('SELECT COUNT(*) FROM teacher_service_expected')->fetchColumn()===$expected,'Not every active teacher was expected');
    $q=$db->prepare('UPDATE teacher_services SET starts_at=?,ends_at=? WHERE id=?');$q->execute([api_teacher_now()->modify('-5 minutes')->format('Y-m-d H:i:s'),api_teacher_now()->modify('+1 hour')->format('Y-m-d H:i:s'),$id]);
    $qr=smokeResult(fn()=>api_teacher_qr($db,$id));$_GET=['token'=>$qr['token']];
    smokeCheck(smokeResult(fn()=>api_teacher_challenge($db,$id))['question']==='Diagnostic colour?','QR challenge failed');
    $smokeInput=['token'=>$qr['token'],'answer'=>'wrong'];smokeReject(fn()=>api_teacher_signin($db,$id),'ANSWER_INCORRECT');
    smokeCheck((int)$db->query('SELECT COUNT(*) FROM teacher_service_attendance')->fetchColumn()===0,'Wrong answer recorded attendance');
    $smokeInput['answer']=' BLUE ';smokeResult(fn()=>api_teacher_signin($db,$id));
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
        $smokeInput=['enabled'=>true];smokeResult(fn()=>api_teacher_welfare_lead($db,(int)$owner['id']));
        $smokeActor['access_level']='TPK_ADMIN';
        smokeCheck(api_teacher_welfare_manager($db,$smokeActor),'Appointed welfare lead lacks manager permission');
        $smokeInput=['status'=>'CONTACTED','note'=>'Temporary diagnostic outcome'];smokeResult(fn()=>api_teacher_welfare_case($db,$caseId));
        smokeCheck($db->query('SELECT status FROM teacher_welfare_cases WHERE id='.$caseId)->fetchColumn()==='CONTACTED','Welfare outcome not saved');
        $smokeActor=$owner;
    }
    $smokeInput=['kind'=>'MDWK','date'=>api_teacher_now()->modify('next wednesday')->format('Y-m-d'),'name'=>'Temporary MDWK diagnostic','startTime'=>'18:00','endTime'=>'20:00','question'=>'Diagnostic colour?','answers'=>['Blue']];
    $mdwk=smokeResult(fn()=>api_teacher_create_service($db));
    $q=$db->prepare('SELECT COUNT(*) FROM teacher_service_expected WHERE service_id=?');$q->execute([(int)$mdwk['id']]);
    smokeCheck((int)$q->fetchColumn()===$expected,'MDWK does not expect every active teacher');
    echo "PASS: MySQL service creation, all-active expectation, QR challenge, answer verification, repeat sign-in, absence and idempotent welfare queue.\n";
    echo "PASS: MDWK expectation, Super Admin welfare assignment and appointed-lead outcome updates.\n";
} finally {
    if($db->inTransaction())$db->rollBack();
    foreach(array_reverse($temporary) as $table)$db->exec('DROP TEMPORARY TABLE `'.$table.'`');
}
echo "Temporary tables removed; no persistent sign-ins, services, welfare assignments or staff sessions created.\n";
