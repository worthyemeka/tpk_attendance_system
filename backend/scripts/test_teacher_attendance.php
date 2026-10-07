<?php
declare(strict_types=1);
// Fixture PDO only: no credentials, network calls or production writes.
require __DIR__.'/../public/teacher-attendance.php';
class TeacherResult extends RuntimeException { public function __construct(public array $data){parent::__construct('Result');} }
class TeacherError extends RuntimeException { public function __construct(public string $apiCode){parent::__construct($apiCode);} }
$actor=['id'=>7,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];$input=[];$ready=true;
function api_actor(PDO $db,bool $super=false):array{if($super&&$GLOBALS['actor']['access_level']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super required');return $GLOBALS['actor']+['name'=>'Sample Teacher'];}
function api_table_exists(PDO $db,string $table):bool{return $GLOBALS['ready'];}
function api_input():array{return $GLOBALS['input'];}
function api_ok(array $data,int $status=200):never{throw new TeacherResult($data);}
function api_error(string $code,string $message,int $status=400):never{throw new TeacherError($code);}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void{$db->audits[]=$action;}
function tpk_ensure_sunday_sessions(PDO $db,int $campus,?DateTimeImmutable $day=null):array{return [];}
class TeacherStatement extends PDOStatement {
 private array $rows=[];
 public function __construct(private TeacherDB $db,private string $sql){}
 public function execute(?array $params=null):bool{
  $p=$params??[];$sql=$this->sql;$db=$this->db;$db->queries[]=[$sql,$p];$this->rows=[];
  if(str_contains($sql,'SELECT * FROM teacher_services'))$this->rows=$p[0]===11&&$p[1]===1?[$db->service]:[];
  elseif(str_contains($sql,'FROM staff_sub_unit_assignments assignment'))$this->rows=$db->manager?[['allowed'=>1]]:[];
  elseif(str_contains($sql,'SELECT checked_in_at'))$this->rows=isset($db->attendance[$p[1]])?[['checked_in_at'=>$db->attendance[$p[1]]]]:[];
  elseif(str_contains($sql,'SELECT attempts,window_started_at'))$this->rows=$db->attempt?[ $db->attempt ]:[];
  elseif(str_starts_with($sql,'INSERT INTO teacher_signin_attempts'))$db->attempt=['attempts'=>$p[2],'window_started_at'=>$p[3]];
  elseif(str_starts_with($sql,'INSERT INTO teacher_service_attendance'))$db->attendance[$p[1]]=$p[2];
  elseif(str_starts_with($sql,'UPDATE teacher_services SET qr_hash')){$db->service['qr_hash']=$p[0];$db->service['qr_expires_at']=$p[1];}
  elseif(str_contains($sql,'SET question=')){$db->service['question']=$p[0];$db->service['answer_hashes_json']=$p[1];$db->service['qr_hash']=null;}
  elseif(str_contains($sql,'SELECT cases.*'))$this->rows=$p[0]===21&&$p[1]===1?[['id'=>21,'assigned_to'=>7,'staff_user_id'=>8]]:[];
  elseif(str_contains($sql,'SELECT id FROM staff_users'))$this->rows=$p[0]===7&&$p[1]===1?[['id'=>7]]:[];
  elseif(str_contains($sql,'SELECT id,kind,name'))$this->rows=[['id'=>11,'kind'=>'SUNDAY','name'=>'Service','startsAt'=>$db->service['starts_at'],'endsAt'=>$db->service['ends_at'],'hasQuestion'=>'1']];
  elseif(str_contains($sql,'attendance.checked_in_at AS checkedInAt'))$this->rows=[['id'=>7,'name'=>'Sample Teacher','checkedInAt'=>$db->attendance[7]??null,'status'=>isset($db->attendance[7])?'PRESENT':($db->service['ends_at']<=api_teacher_now()->format('Y-m-d H:i:s')?'ABSENT':'AWAITING')]];
  elseif(str_contains($sql,'SELECT cases.id'))$this->rows=[['id'=>21,'serviceId'=>11,'teacherId'=>8,'assignedTo'=>7]];
  elseif(str_starts_with($sql,'SELECT reason FROM teacher_service_absence_reasons'))$this->rows=[['reason'=>'Private absence explanation']];
  elseif(str_contains($sql,'SELECT 1 FROM teacher_service_expected expected LEFT'))$this->rows=$db->expected&&!isset($db->attendance[7])?[['allowed'=>1]]:[];
  elseif(str_contains($sql,'SELECT 1 FROM teacher_service_expected'))$this->rows=$db->expected?[['allowed'=>1]]:[];
  elseif(str_starts_with($sql,'INSERT IGNORE INTO teacher_service_attendance'))$db->attendance[$p[1]]=$p[2];
  elseif(str_starts_with($sql,'INSERT INTO teacher_service_absence_reasons'))$db->reasonWrites[]=$p;
  if(str_starts_with($sql,'INSERT IGNORE INTO teacher_welfare_cases'))$db->queuedParams=$p;
  if(str_starts_with($sql,'UPDATE teacher_welfare_cases')||str_starts_with($sql,'INSERT INTO teacher_welfare_events'))$db->caseWrites[]=[$sql,$p];
  return true;
 }
 public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0):mixed{return $this->rows[0]??false;}
 public function fetchColumn(int $column=0):mixed{return $this->rows?array_values($this->rows[0])[$column]:false;}
 public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return $this->rows;}
}
class TeacherDB extends PDO {
 public array $service,$queries=[],$audits=[],$attendance=[],$caseWrites=[],$queuedParams=[],$reasonWrites=[];public ?array $attempt=null;public bool $manager=false,$transaction=false,$expected=true;public int $commits=0;
 public function __construct(){ $now=api_teacher_now();$this->service=['id'=>11,'campus_id'=>1,'kind'=>'SUNDAY','name'=>'Sample Sunday','starts_at'=>$now->modify('-5 minutes')->format('Y-m-d H:i:s'),'ends_at'=>$now->modify('+1 hour')->format('Y-m-d H:i:s'),'question'=>'Dress colour?','answer_hashes_json'=>json_encode([password_hash('blue',PASSWORD_DEFAULT)]),'qr_hash'=>hash('sha256',str_repeat('a',64)),'qr_expires_at'=>$now->modify('+5 minutes')->format('Y-m-d H:i:s')]; }
 public function prepare(string $query,array $options=[]):PDOStatement|false{return new TeacherStatement($this,$query);}
 public function beginTransaction():bool{$this->transaction=true;return true;}public function commit():bool{$this->transaction=false;$this->commits++;return true;}public function rollBack():bool{$this->transaction=false;return true;}public function inTransaction():bool{return $this->transaction;}public function lastInsertId(?string $name=null):string|false{return '11';}
}
$tests=0;function checkTeacher(bool $v,string $label):void{if(!$v)throw new RuntimeException($label);$GLOBALS['tests']++;}
function teacherResult(callable $fn):array{try{$fn();}catch(TeacherResult $r){return $r->data;}throw new RuntimeException('Missing result');}
function teacherRejected(callable $fn,string $code):void{try{$fn();}catch(TeacherError $e){checkTeacher($e->apiCode===$code,'Expected '.$code.' got '.$e->apiCode);return;}throw new RuntimeException('Expected '.$code);}
$valid=['kind'=>'SUNDAY','date'=>'2026-10-11','startTime'=>'08:00','endTime'=>'13:30','name'=>'Sunday','question'=>'Dress colour?','answers'=>['  Blue  ','NAVY']];$values=api_teacher_service_values($valid);checkTeacher(password_verify('blue',json_decode($values[5],true)[0]),'Answers hashed and normalised');checkTeacher(!str_contains($values[5],'Blue'),'Answer not stored in plain text');
teacherRejected(fn()=>api_teacher_service_values(array_replace($valid,['date'=>'2026-10-06'])),'VALIDATION_ERROR');teacherRejected(fn()=>api_teacher_service_values(array_replace($valid,['endTime'=>'07:00'])),'VALIDATION_ERROR');teacherRejected(fn()=>api_teacher_service_values(array_replace($valid,['answers'=>['']])),'VALIDATION_ERROR');checkTeacher(api_teacher_service_values(array_replace($valid,['kind'=>'MDWK','date'=>'2026-10-07']))[0]==='MDWK','Wednesday supported');
$db=new TeacherDB();checkTeacher(!api_teacher_welfare_manager($db,$actor),'Ordinary teacher not a welfare manager');teacherRejected(fn()=>api_teacher_create_service($db),'FORBIDDEN');teacherRejected(fn()=>api_teacher_welfare_lead($db,7),'FORBIDDEN');teacherRejected(fn()=>api_teacher_qr($db,11),'QR_NOT_REQUIRED');
$_GET=[];$challenge=teacherResult(fn()=>api_teacher_challenge($db,11));checkTeacher($challenge['question']==='Dress colour?'&&!isset($challenge['answer_hashes_json']),'Challenge reveals question only');teacherRejected(fn()=>api_teacher_challenge($db,99),'SERVICE_NOT_FOUND');teacherRejected(fn()=>api_teacher_valid_qr($db->service,str_repeat('b',64)),'QR_EXPIRED');$old=$db->service;$old['qr_expires_at']=api_teacher_now()->modify('-1 minute')->format('Y-m-d H:i:s');teacherRejected(fn()=>api_teacher_valid_qr($old,str_repeat('a',64)),'QR_EXPIRED');$old['ends_at']=$old['qr_expires_at'];teacherRejected(fn()=>api_teacher_valid_qr($old,str_repeat('a',64)),'SIGNIN_CLOSED');
$db->service['question']='';$db->service['answer_hashes_json']='[]';$db->attempt=['attempts'=>99,'window_started_at'=>api_teacher_now()->format('Y-m-d H:i:s')];
foreach([[],['attended'=>false],['attended'=>'true']] as $input)teacherRejected(fn()=>api_teacher_signin($db,11),'VALIDATION_ERROR');
checkTeacher(!$db->attendance&&!$db->inTransaction(),'Missing confirmation never records attendance');
$input=['attended'=>true,'teacherId'=>99];$result=teacherResult(fn()=>api_teacher_signin($db,11));checkTeacher(isset($db->attendance[7])&&!isset($db->attendance[99])&&$result['teacherName']==='Sample Teacher','Simple confirmation only records authenticated teacher without a question');
$before=count($db->attendance);$result=teacherResult(fn()=>api_teacher_signin($db,11));checkTeacher($result['alreadySignedIn']&&count($db->attendance)===$before,'Repeated sign-in idempotent');
$input=['assignedTo'=>7];teacherRejected(fn()=>api_teacher_welfare_case($db,21),'FORBIDDEN');$input=['status'=>'CONTACTED','note'=>'Spoke with teacher.'];teacherResult(fn()=>api_teacher_welfare_case($db,21));checkTeacher(count($db->caseWrites)===2,'Assigned teacher records outcome and history');$actor['id']=6;teacherRejected(fn()=>api_teacher_welfare_case($db,21),'FORBIDDEN');$actor['id']=7;$db->manager=true;$input=['assignedTo'=>7];teacherResult(fn()=>api_teacher_welfare_case($db,21));checkTeacher(count($db->caseWrites)===4,'Appointed welfare lead assigns without Super role');$input=['assignedTo'=>99];teacherRejected(fn()=>api_teacher_welfare_case($db,21),'VALIDATION_ERROR');teacherRejected(fn()=>api_teacher_welfare_case($db,99),'CASE_NOT_FOUND');
$actor['access_level']='TPK_SUPER_ADMIN';$db->manager=false;checkTeacher(api_teacher_welfare_manager($db,$actor),'Super Admin fallback authority');teacherRejected(fn()=>api_teacher_qr($db,11),'QR_NOT_REQUIRED');
$actor['access_level']='TPK_ADMIN';$_GET=['month'=>'2026-10','serviceId'=>11];$data=teacherResult(fn()=>api_teacher_attendance($db));checkTeacher(!$data['canManage']&&count($data['items'])===1,'Regular teacher reads register');$caseQuery=array_values(array_filter($db->queries,fn($r)=>str_contains($r[0],'SELECT cases.id')));checkTeacher(str_contains(end($caseQuery)[0],'cases.assigned_to=?')&&end($caseQuery)[1][3]===7,'Regular teacher sees own tasks only');checkTeacher($db->queuedParams[0]===1,'Absence queue campus scoped');$queueQuery=array_values(array_filter($db->queries,fn($r)=>str_starts_with($r[0],'INSERT IGNORE INTO teacher_welfare_cases')))[0][0];checkTeacher(str_contains($queueQuery,'service.ends_at<=?')&&str_contains($queueQuery,'attendance.staff_user_id IS NULL'),'Only unsigned teachers after close queued');
$actor['access_level']='TPK_SUPER_ADMIN';$db->service['starts_at']='2026-10-11 08:00:00';$db->service['ends_at']='2026-10-11 13:30:00';$before=$db->attendance;$input=['question'=>'What is the banner colour?','answers'=>['Green']];teacherResult(fn()=>api_teacher_security($db,11));checkTeacher($db->service['qr_hash']===null&&$db->attendance===$before,'Changing question invalidates QR and preserves arrivals');checkTeacher(password_verify('green',json_decode($db->service['answer_hashes_json'],true)[0]),'Updated answer hashed');$actor['access_level']='TPK_ADMIN';teacherRejected(fn()=>api_teacher_security($db,11),'FORBIDDEN');
$ready=false;teacherRejected(fn()=>api_teacher_attendance($db),'TEACHER_ATTENDANCE_NOT_READY');
$ready=true;$actor['access_level']='TPK_ADMIN';$db->manager=false;
$zone=new DateTimeZone('Africa/Lagos');
$before=$db->attendance;$beforeQueries=count($db->queries);
foreach([fn()=>api_teacher_my_mdwk($db),fn()=>api_teacher_confirm_mdwk($db,11),fn()=>api_teacher_absence_reason($db,11)] as $fn)teacherRejected($fn,'MDWK_SIGNIN_REMOVED');
checkTeacher($db->attendance===$before&&count($db->queries)===$beforeQueries&&!$db->reasonWrites,'Removed MDWK endpoints perform no attendance/reason writes');
checkTeacher(str_contains($queueQuery,"service.kind='SUNDAY'"),'MDWK never queues new welfare tasks');
$syncQueries=array_filter($db->queries,fn($r)=>str_contains($r[0],'INSERT IGNORE INTO teacher_services'));
foreach($syncQueries as $q)checkTeacher(!str_contains($q[0],"'MDWK'"),'Sync never creates MDWK services');
$sunday=['kind'=>'SUNDAY','starts_at'=>'2026-10-11 10:30:00','ends_at'=>'2026-10-11 12:30:00'];
foreach(['2026-10-10 23:59:59','2026-10-11 05:59:59','2026-10-11 12:30:00','2026-10-12 06:00:00'] as $stamp)teacherRejected(fn()=>api_teacher_signin_window($sunday,new DateTimeImmutable($stamp,$zone)),'SIGNIN_CLOSED');
foreach(['2026-10-11 06:00:00','2026-10-11 10:29:59','2026-10-11 12:29:59'] as $stamp){api_teacher_signin_window($sunday,new DateTimeImmutable($stamp,$zone));checkTeacher(true,'Sunday available at '.$stamp);}
teacherRejected(fn()=>api_teacher_signin_window(array_replace($sunday,['kind'=>'MDWK'])),'MDWK_SIGNIN_REMOVED');
foreach(['2026-10-07 06:00:00','2026-10-07 20:59:59'] as $stamp){$notice=api_teacher_wednesday_reminder(new DateTimeImmutable($stamp,$zone));checkTeacher($notice['kind']==='SERVICE'&&$notice['id']==='mdwk-service-2026-10-07','Wednesday reminder has stable date and category');checkTeacher(str_contains($notice['detail'],'No sign-in is required.'),'Reminder not a sign-in notification');}
foreach(['2026-10-07 05:59:59','2026-10-07 21:00:00','2026-10-11 06:00:00','2026-10-08 06:00:00'] as $stamp)checkTeacher(api_teacher_wednesday_reminder(new DateTimeImmutable($stamp,$zone))===null,'No reminder outside Wednesday daytime');
checkTeacher(api_teacher_wednesday_reminder(new DateTimeImmutable('2026-10-07 05:00:00',new DateTimeZone('UTC')))!==null,'Reminder uses Lagos rather than browser timezone');
$_GET=[];if(api_teacher_now()->format('w')!=='0')checkTeacher(teacherResult(fn()=>api_teacher_my_sunday($db))['services']===[],'Sunday overview is hidden on weekdays irrespective of selected week');
echo 'PASS: '.$tests." Sunday 6am opening, Wednesday reminder-only, welfare permissions and repeat-sign-in checks.\n";
