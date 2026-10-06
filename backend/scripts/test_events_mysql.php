<?php
declare(strict_types=1);
// Opt-in diagnostic: all event writes are connection-local temporary tables.
if(getenv('TPK_MYSQL_SMOKE')!=='1'){echo "Skipped: enable TPK_MYSQL_SMOKE for isolated MySQL checks.\n";exit;}
$configRoot=getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__);
require $configRoot.'/config.php';
require __DIR__.'/../registration-eligibility.php';
require __DIR__.'/../public/events.php';
require __DIR__.'/../public/assembly-context.php';
class EventResult extends RuntimeException {public function __construct(public array $data){parent::__construct('Result');}}
class EventError extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
function api_ok(array $data,int $status=200):void {throw new EventResult($data);}
function api_error(string $code,string $message,int $status=400):void {throw new EventError($code);}
function api_actor(PDO $db,bool $super=false):array {if($super&&$GLOBALS['actor']['access_level']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super required',403);return $GLOBALS['actor'];}
function api_input():array{return $GLOBALS['input'];}
function api_audit(PDO $db,array $actor,string $event,string $entity,int $id,array $meta=[]):void{}
function api_phone(?string $value):?string{$v=preg_replace('/\D+/','',(string)$value);if(str_starts_with($v,'234')&&strlen($v)===13)$v='0'.substr($v,3);return strlen($v)===11&&str_starts_with($v,'0')?$v:null;}
function result(callable $fn):array{try{$fn();}catch(EventResult $r){return $r->data;}throw new RuntimeException('Missing response');}
function check(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);$GLOBALS['checks']++;}
function reject(callable $fn,string $code):void{try{$fn();}catch(EventError $e){check($e->apiCode===$code,'Incorrect rejection: '.$e->apiCode);return;}throw new RuntimeException('Expected '.$code);}
$db=db();$input=[];$checks=0;$temporary=[];
$actor=$db->query("SELECT id,campus_id,name,access_level FROM staff_users WHERE access_level='TPK_SUPER_ADMIN' AND is_active=1 AND account_status='VERIFIED' ORDER BY id LIMIT 1")->fetch();
if(!$actor)throw new RuntimeException('Active campus required');$owner=$actor;
$peopleBefore=$db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM families)+(SELECT COUNT(*) FROM attendance)')->fetchColumn();
try{
 $_GET=['month'=>(new DateTimeImmutable('now',new DateTimeZone('Africa/Lagos')))->format('Y-m')];
 check(is_array(api_assembly_sessions($db,$actor)),'Assembly month query fails against actual service schema');
 $sql=preg_replace('/^\s*--[^\n]*(?:\n|$)/m','',file_get_contents(__DIR__.'/../database/2026_events.sql'));
 foreach(explode(';',$sql) as $statement){if(!trim($statement))continue;$statement=preg_replace('/CREATE TABLE IF NOT EXISTS/','CREATE TEMPORARY TABLE',$statement);$statement=preg_replace('/^\s*FOREIGN KEY[^\n]*(?:\n|$)/m','',$statement);$statement=preg_replace('/,\s*\)/',')',$statement);preg_match('/CREATE TEMPORARY TABLE (\w+)/',$statement,$m);$db->exec($statement);$temporary[]=$m[1];}
 $today=(new DateTimeImmutable('now',new DateTimeZone('Africa/Lagos')))->format('Y-m-d');
 $input=['name'=>'Temporary VBS diagnostic','type'=>'VBS','startDate'=>$today,'endDate'=>$today,'registrationOpens'=>$today,'registrationCloses'=>$today,'publicRegistration'=>true,'countdown'=>true,'status'=>'PUBLISHED'];
 $id=result(fn()=>api_event_save($db))['id'];check(count(result(fn()=>api_events($db))['items'])===1,'Event listing');
 $input=['name'=>'Today','startsAt'=>$today.'T00:00','endsAt'=>$today.'T23:59'];result(fn()=>api_event_setup($db,$id,'sessions'));
 $sid=(int)$db->query('SELECT id FROM event_sessions')->fetchColumn();
 $input=['name'=>'Explorers','minAge'=>3,'maxAge'=>5];result(fn()=>api_event_setup($db,$id,'groups'));
 $input=['name'=>'Overlap','minAge'=>5,'maxAge'=>8];reject(fn()=>api_event_setup($db,$id,'groups'),'VALIDATION_ERROR');
 $key=$db->query('SELECT public_key FROM ministry_events')->fetchColumn();
 check(result(fn()=>api_public_event($db,$key))['open'],'Public registration window');
 $input=['guardianName'=>'Diagnostic Guardian','guardianPhone'=>'08000000000','emergencyPhone'=>'08000000001','homeCampus'=>'Visitor campus','sessionIds'=>[$sid],'children'=>[['name'=>'Temporary child','dateOfBirth'=>(new DateTimeImmutable($today))->modify('-4 years')->format('Y-m-d'),'careNotes'=>'Diagnostic care note']]];
 result(fn()=>api_public_event($db,$key,true));
 $cid=(int)$db->query('SELECT id FROM event_children')->fetchColumn();
 check((int)$db->query('SELECT group_id FROM event_children')->fetchColumn()>0,'Age-based temporary group');
 check($db->query('SELECT child_id FROM event_children')->fetchColumn()===null,'Visitor not linked to permanent host child');
 reject(fn()=>api_public_event($db,$key,true),'ALREADY_REGISTERED');
 check((int)$db->query('SELECT COUNT(*) FROM event_registrations')->fetchColumn()===1,'Duplicate rollback');
 $original=$input;$input['children'][0]['name']='Young diagnostic';$input['children'][0]['dateOfBirth']=$today;reject(fn()=>api_public_event($db,$key,true),'CHILD_TOO_YOUNG');$input=$original;
 $public=result(fn()=>api_public_event($db,$key));check(!isset($public['children'])&&!isset($public['attendance']),'Public metadata excludes personal records');
 $actor['access_level']='TPK_TEACHER';$view=result(fn()=>api_events($db,$id));check(!$view['canOperate']&&$view['children']===[]&&$view['attendance']===[],'Ordinary staff personal-data restrictions');
 reject(fn()=>api_event_save($db),'FORBIDDEN');$input=['childId'=>$cid,'sessionId'=>$sid];reject(fn()=>api_event_arrival($db,$id),'FORBIDDEN');
 $actor=$owner;$input=['userId'=>$actor['id'],'duty'=>'TEACHER'];result(fn()=>api_event_setup($db,$id,'volunteers'));$actor['access_level']='TPK_TEACHER';check(!event_operator($db,$actor,$id),'Teaching duty cannot release children');$actor=$owner;
 $input=['userId'=>$actor['id'],'duty'=>'CHECK_IN'];result(fn()=>api_event_setup($db,$id,'volunteers'));$actor['access_level']='TPK_TEACHER';check(event_operator($db,$actor,$id,'CHECK_IN')&&!event_operator($db,$actor,$id,'PICKUP'),'Duty-specific operator restrictions');$actor=$owner;
 $input=['childId'=>$cid,'sessionId'=>$sid];$arrival=result(fn()=>api_event_arrival($db,$id));$again=result(fn()=>api_event_arrival($db,$id));check($arrival['pickupCode']===$again['pickupCode'],'Idempotent arrival retains code');
 check((int)$db->query('SELECT COUNT(*) FROM event_attendance')->fetchColumn()===1,'No duplicate arrival');
 $input=['pickupCode'=>$arrival['pickupCode'],'collectorName'=>'Diagnostic Guardian','guardianVerified'=>false];reject(fn()=>api_event_arrival($db,$id,true),'VERIFICATION_REQUIRED');
 $input['guardianVerified']=true;$input['collectorName']='Someone else';reject(fn()=>api_event_arrival($db,$id,true),'COLLECTOR_NOT_AUTHORISED');
 $input['collectorName']='Diagnostic Guardian';$input['pickupCode']='WRONG';reject(fn()=>api_event_arrival($db,$id,true),'PICKUP_NOT_FOUND');
 $input['pickupCode']=$arrival['pickupCode'];check(result(fn()=>api_event_arrival($db,$id,true))['pickedUp'],'Verified pickup saved');reject(fn()=>api_event_arrival($db,$id,true),'ALREADY_PICKED_UP');
 $input=['name'=>'Next diagnostic','startDate'=>(new DateTimeImmutable($today))->modify('+1 year')->format('Y-m-d')];$copy=result(fn()=>api_event_duplicate($db,$id))['id'];
 $view=result(fn()=>api_events($db,$copy));check($view['event']['status']==='DRAFT'&&!$view['event']['publicRegistration'],'Duplicate remains private draft');check(count($view['sessions'])===1&&count($view['groups'])===1&&$view['children']===[]&&$view['volunteers']===[],'Copy structure without people or attendance');
 $actor['campus_id']=(int)$owner['campus_id']+999;reject(fn()=>api_events($db,$id),'EVENT_NOT_FOUND');$actor=$owner;
 $db->exec("UPDATE ministry_events SET registration_closes='2000-01-01' WHERE id=".$id);$input=$original;reject(fn()=>api_public_event($db,$key,true),'REGISTRATION_CLOSED');
 check($db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM families)+(SELECT COUNT(*) FROM attendance)')->fetchColumn()===$peopleBefore,'Permanent ministry records changed');
 echo "PASS: $checks MySQL event, privacy, registration, group, pickup, duplication and assembly-history checks.\n";
}finally{if($db->inTransaction())$db->rollBack();foreach(array_reverse($temporary)as$table)$db->exec('DROP TEMPORARY TABLE `'.$table.'`');}
echo "Temporary event records removed; persistent people and attendance untouched.\n";
