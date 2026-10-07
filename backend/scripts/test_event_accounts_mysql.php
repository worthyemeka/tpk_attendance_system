<?php
declare(strict_types=1);
if(getenv('TPK_MYSQL_SMOKE')!=='1'){echo "Skipped: opt-in isolated account tests.\n";exit;}
require (getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__)).'/config.php';
require dirname(__DIR__).'/public/events.php';
final class AccountResult extends RuntimeException {public function __construct(public array $data){parent::__construct('Result');}}
final class AccountError extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
function api_ok(array $data,int $status=200):void{throw new AccountResult($data);}
function api_error(string $code,string $message,int $status=400):void{throw new AccountError($code);}
function api_actor(PDO $db,bool $super=false):array{return $GLOBALS['actor'];}
function api_input():array{return $GLOBALS['input'];}
function api_audit(PDO $db,array $actor,string $a,string $e,int $id,array $m=[]):void{}
function answer(callable $fn):array{try{$fn();}catch(AccountResult $r){return $r->data;}throw new RuntimeException('Missing result');}
function expect(bool $value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
$db=db();$tables=[];$checks=0;$campus=(int)$db->query('SELECT id FROM campuses ORDER BY id LIMIT 1')->fetchColumn();
$actor=['id'=>1,'campus_id'=>$campus,'access_level'=>'TPK_SUPER_ADMIN'];
try{
 foreach(['staff_users','teacher_profiles','staff_sessions'] as $table){$ddl=$db->query('SHOW CREATE TABLE `'.$table.'`')->fetch(PDO::FETCH_NUM)[1];$ddl=str_replace('CREATE TABLE','CREATE TEMPORARY TABLE',$ddl);$ddl=preg_replace('/^\s*CONSTRAINT[^\n]*\n/m','',$ddl);$ddl=preg_replace('/,\s*\)/',')',$ddl);$db->exec($ddl);$tables[]=$table;}
 $db->exec("ALTER TABLE staff_users MODIFY access_level VARCHAR(40) NOT NULL");
 $db->exec("ALTER TABLE teacher_profiles MODIFY gender ENUM('FEMALE','MALE') NULL");
 $db->exec("ALTER TABLE teacher_profiles MODIFY birth_date DATE NULL");
 $db->prepare("INSERT INTO staff_users(id,campus_id,name,email,role,access_level,account_status,is_active) VALUES(1,?,'Diagnostic admin','admin@example.test','ADMIN','TPK_SUPER_ADMIN','VERIFIED',1)")->execute([$campus]);
 foreach(['2026_events.sql','2026_event_history.sql'] as $file){
  $sql=preg_replace('/^\s*--[^\n]*(?:\n|$)/m','',file_get_contents(dirname(__DIR__).'/database/'.$file));
  foreach(explode(';',$sql) as $s){$s=trim($s);if(!$s||preg_match('/^ALTER TABLE (staff_users|teacher_profiles) /',$s)||str_contains($s,'ADD CONSTRAINT'))continue;
   $s=preg_replace('/FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*\w+\s*\([^)]*\)/','',$s);
   $s=preg_replace('/,\s*(?=,|\))/', '',$s);
   if(str_starts_with($s,'CREATE TABLE')){$s=str_replace('CREATE TABLE IF NOT EXISTS','CREATE TEMPORARY TABLE',$s);preg_match('/CREATE TEMPORARY TABLE (\w+)/',$s,$m);$tables[]=$m[1];}
   $db->exec($s);
  }
 }
 $db->prepare("INSERT INTO ministry_events(campus_id,name,event_type,starts_on,ends_on,registration_opens,registration_closes,status,public_key,created_by) VALUES(?,'Account diagnostic','VBS','2026-08-24','2026-08-29','2026-08-24','2026-08-29','ARCHIVED',?,1)")->execute([$campus,bin2hex(random_bytes(24))]);$id=(int)$db->lastInsertId();
 $input=['name'=>'Diagnostic Volunteer','email'=>'volunteer@example.test','phone'=>'+2348000000000','homeCampusId'=>$campus,'responsibility'=>'Activities'];
 $first=answer(fn()=>api_event_volunteer_register($db,$id));$uid=$first['userId'];expect(strlen($first['setupToken'])===64,'Secure invitation issued');
 expect($db->query('SELECT access_level FROM staff_users WHERE id='.$uid)->fetchColumn()==='EVENT_VOLUNTEER','New account cannot become general admin');
 expect($db->query('SELECT gender FROM teacher_profiles WHERE staff_user_id='.$uid)->fetchColumn()===null,'Unspecified gender preserved');
 $second=answer(fn()=>api_event_volunteer_register($db,$id));expect($second['userId']===$uid,'Existing identity reused');
 expect((int)$db->query('SELECT COUNT(*) FROM event_volunteer_assignments')->fetchColumn()===1,'Repeated assignment idempotent');
 $input=['token'=>$first['setupToken'],'password'=>'A sufficiently long test password'];
 try{api_event_password_setup($db);throw new RuntimeException('Old invitation accepted');}catch(AccountError $e){expect($e->apiCode==='INVITATION_EXPIRED','Old invitation invalidated');if($db->inTransaction())$db->rollBack();}
 $input['token']=$second['setupToken'];expect(answer(fn()=>api_event_password_setup($db))['ready'],'Password setup succeeds');
 expect(password_verify($input['password'],$db->query('SELECT password_hash FROM teacher_profiles WHERE staff_user_id='.$uid)->fetchColumn()),'Hash, not plaintext, stored');
 expect($db->query('SELECT account_status FROM staff_users WHERE id='.$uid)->fetchColumn()==='VERIFIED','Account verified only after setup');
 try{api_event_password_setup($db);throw new RuntimeException('Invitation replay accepted');}catch(AccountError $e){expect($e->apiCode==='INVITATION_EXPIRED','Invitation consumed once');if($db->inTransaction())$db->rollBack();}
 $input=['name'=>'Ignored replacement name','email'=>'admin@example.test','responsibility'=>'Host lead'];$reuse=answer(fn()=>api_event_volunteer_register($db,$id));expect($reuse['userId']===1&&$reuse['setupToken']===null,'Existing administrator reused without password reset');
 expect($db->query('SELECT access_level FROM staff_users WHERE id=1')->fetchColumn()==='TPK_SUPER_ADMIN','Existing access unchanged');
 echo "PASS: $checks isolated volunteer account and invitation checks.\n";
}finally{if($db->inTransaction())$db->rollBack();foreach(array_reverse($tables) as $table)$db->exec("DROP TEMPORARY TABLE $table");}
echo "All diagnostic accounts were temporary; no persistent users or sessions created.\n";
