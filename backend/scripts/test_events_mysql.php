<?php
declare(strict_types=1);
// Opt-in diagnostic: all event writes are connection-local temporary tables.
if(getenv('TPK_MYSQL_SMOKE')!=='1'){echo "Skipped: enable TPK_MYSQL_SMOKE for isolated MySQL checks.\n";exit;}
$configRoot=getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__);
require $configRoot.'/config.php';
require __DIR__.'/../registration-eligibility.php';
require __DIR__.'/../public/events.php';
require __DIR__.'/../public/assembly-context.php';
require __DIR__.'/import_vbs_roster.php';
class EventResult extends RuntimeException {public function __construct(public array $data){parent::__construct('Result');}}
class EventError extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
function api_ok(array $data,int $status=200):void {throw new EventResult($data);}
function api_error(string $code,string $message,int $status=400):void {throw new EventError($code);}
function api_actor(PDO $db,bool $super=false):array {if($super&&$GLOBALS['actor']['access_level']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super required',403);return $GLOBALS['actor'];}
function api_input():array{return $GLOBALS['input'];}
function api_method():string{return $GLOBALS['method']??'POST';}
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
 // Extend only the connection-local event tables. Never ALTER real staff tables.
 $sql=preg_replace('/^\s*--[^\n]*(?:\n|$)/m','',file_get_contents(__DIR__.'/../database/2026_event_history.sql'));
 foreach(explode(';',$sql) as $statement){$statement=trim($statement);if(!$statement)continue;
  if(preg_match('/^ALTER TABLE (staff_users|teacher_profiles) /',$statement)||str_contains($statement,'ADD CONSTRAINT'))continue;
  $statement=preg_replace('/FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*\w+\s*\([^)]*\)/','',$statement);
  $statement=preg_replace('/,\s*(?=,|\))/', '',$statement);
  if(str_starts_with($statement,'CREATE TABLE')){$statement=str_replace('CREATE TABLE IF NOT EXISTS','CREATE TEMPORARY TABLE',$statement);preg_match('/CREATE TEMPORARY TABLE (\w+)/',$statement,$m);$temporary[]=$m[1];}
  $db->exec($statement);
 }
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
 $actor['access_level']='TPK_TEACHER';$view=result(fn()=>api_events($db,$id));check(!$view['canOperate']&&count($view['children'])===1&&array_keys($view['children'][0])===['id','name','groupId','groupName','homeCampusId','homeCampus','sessionIds']&&$view['attendance']===[],'Ordinary staff receive group and campus fields without private details');
 reject(fn()=>api_event_save($db),'FORBIDDEN');$input=['childId'=>$cid,'sessionId'=>$sid];reject(fn()=>api_event_arrival($db,$id),'FORBIDDEN');
 $actor=$owner;$input=['userId'=>$actor['id'],'duty'=>'TEACHER'];result(fn()=>api_event_setup($db,$id,'volunteers'));$actor['access_level']='TPK_TEACHER';check(!event_operator($db,$actor,$id),'Teaching duty cannot release children');$actor=$owner;
 $input=['userId'=>$actor['id'],'duty'=>'CHECK_IN'];result(fn()=>api_event_setup($db,$id,'volunteers'));$actor['access_level']='TPK_TEACHER';check(event_operator($db,$actor,$id,'CHECK_IN')&&!event_operator($db,$actor,$id,'PICKUP'),'Duty-specific operator restrictions');$actor=$owner;
 $input=['childId'=>$cid,'sessionId'=>$sid];$arrival=result(fn()=>api_event_arrival($db,$id));$again=result(fn()=>api_event_arrival($db,$id));check($arrival['pickupCode']===$again['pickupCode'],'Idempotent arrival retains code');
 check((int)$db->query('SELECT COUNT(*) FROM event_attendance')->fetchColumn()===1,'No duplicate arrival');
 // An ordinary reader must not reuse the owner's CHECK_IN assignment above.
 $actor['access_level']='TPK_TEACHER';$actor['id']=0;$safeArrival=result(fn()=>api_events($db,$id));check(count($safeArrival['attendance'])===1&&array_keys($safeArrival['attendance'][0])===['childId','sessionId','checkedInAt'],'Teachers see check-in state without pickup credentials');$actor=$owner;
 $input=['pickupCode'=>$arrival['pickupCode'],'collectorName'=>'Diagnostic Guardian','guardianVerified'=>false];reject(fn()=>api_event_arrival($db,$id,true),'VERIFICATION_REQUIRED');
 $input['guardianVerified']=true;$input['collectorName']='Someone else';reject(fn()=>api_event_arrival($db,$id,true),'COLLECTOR_NOT_AUTHORISED');
 $input['collectorName']='Diagnostic Guardian';$input['pickupCode']='WRONG';reject(fn()=>api_event_arrival($db,$id,true),'PICKUP_NOT_FOUND');
 $input['pickupCode']=$arrival['pickupCode'];check(result(fn()=>api_event_arrival($db,$id,true))['pickedUp'],'Verified pickup saved');reject(fn()=>api_event_arrival($db,$id,true),'ALREADY_PICKED_UP');
 $input=['name'=>'Next diagnostic','startDate'=>(new DateTimeImmutable($today))->modify('+1 year')->format('Y-m-d')];$copy=result(fn()=>api_event_duplicate($db,$id))['id'];
 $view=result(fn()=>api_events($db,$copy));check($view['event']['status']==='DRAFT'&&!$view['event']['publicRegistration'],'Duplicate remains private draft');check(count($view['sessions'])===1&&count($view['groups'])===1&&$view['children']===[]&&$view['volunteers']===[],'Copy structure without people or attendance');
 $actor['access_level']='TPK_TEACHER';check(count(result(fn()=>api_events($db))['items'])===1,'Draft excluded from staff listing');reject(fn()=>api_events($db,$copy),'EVENT_NOT_FOUND');
 $db->prepare("INSERT INTO event_volunteers(event_id,staff_user_id,duty) VALUES(?,?,'LEAD')")->execute([$copy,$owner['id']]);reject(fn()=>api_events($db,$copy),'EVENT_NOT_FOUND');reject(fn()=>api_event_arrival($db,$copy),'EVENT_NOT_FOUND');
 $draftKey=$db->query('SELECT public_key FROM ministry_events WHERE id='.$copy)->fetchColumn();reject(fn()=>api_public_event($db,$draftKey),'EVENT_NOT_FOUND');
 $actor=$owner;$input=['userId'=>$owner['id'],'duty'=>'LEAD','sessionId'=>$sid,'responsibility'=>'Prayers'];result(fn()=>api_event_setup($db,$id,'volunteers'));$input['responsibility']='Assembly';result(fn()=>api_event_setup($db,$id,'volunteers'));$input['responsibility']='Assembly';result(fn()=>api_event_setup($db,$id,'volunteers'));$view=result(fn()=>api_events($db,$id));check(count(array_filter($view['volunteerAssignments'],fn($a)=>$a['sessionId']==$sid))===2,'Multiple responsibilities, duplicate saves are idempotent');$input['sessionId']=99999;reject(fn()=>api_event_setup($db,$id,'volunteers'),'VALIDATION_ERROR');
 $actor['campus_id']=(int)$owner['campus_id']+999;reject(fn()=>api_events($db,$id),'EVENT_NOT_FOUND');$actor=$owner;
 $db->exec("UPDATE ministry_events SET registration_closes='2000-01-01' WHERE id=".$id);$input=$original;reject(fn()=>api_public_event($db,$key,true),'REGISTRATION_CLOSED');
 check(event_lifecycle(['status'=>'PUBLISHED','starts_on'=>'2026-08-24','ends_on'=>'2026-08-29'],'2026-08-23')==='UPCOMING','Upcoming boundary');
 check(event_lifecycle(['status'=>'PUBLISHED','starts_on'=>'2026-08-24','ends_on'=>'2026-08-29'],'2026-08-29')==='LIVE','Inclusive final day');
 check(event_lifecycle(['status'=>'PUBLISHED','starts_on'=>'2026-08-24','ends_on'=>'2026-08-29'],'2026-08-30')==='COMPLETED','Completed boundary');
 $input=['name'=>'Historical diagnostic','type'=>'VBS','startDate'=>'2026-08-24','endDate'=>'2026-08-29','registrationOpens'=>'2026-08-24','registrationCloses'=>'2026-08-29','status'=>'ARCHIVED','themeName'=>'The Great Jungle Journey','timezone'=>'Africa/Lagos'];
 $history=result(fn()=>api_event_save($db))['id'];check(result(fn()=>api_events($db,$history))['event']['lifecycle']==='ARCHIVED','Past events publish and remain readable');
 $input=['dayNumber'=>1,'label'=>'Monday','date'=>'2026-08-24'];$day=result(fn()=>api_event_day($db,$history))['id'];
 $input['date']='2026-08-30';reject(fn()=>api_event_day($db,$history),'VALIDATION_ERROR');
 $row=['sourceKey'=>'diagnostic-source-1','name'=>'Diagnostic historical child','age'=>4,'gender'=>'FEMALE','homeCampusId'=>$owner['campus_id'],'guardianPhone'=>null,'contacts'=>[['type'=>'DOCTOR','name'=>'Historical doctor','phone'=>null,'sourceText'=>'Unseparated source clinic entry']], 'food'=>true,'days'=>[['dayNumber'=>1,'present'=>true,'pickedUp'=>null,'cardNumber'=>'48']]];
 $input=['kind'=>'CHILDREN','sourceName'=>'Private diagnostic','rows'=>[$row]];$batch=result(fn()=>api_event_import($db,$history))['id'];
 check((int)$db->query('SELECT COUNT(*) FROM event_children WHERE event_id='.$history)->fetchColumn()===0,'Preview makes no registrations');
 check(result(fn()=>api_event_import($db,$history))['duplicate'],'Repeated preview idempotent');
 $input=['confirm'=>false];reject(fn()=>api_event_import($db,$history,$batch,'commit'),'CONFIRMATION_REQUIRED');
 $input=['confirm'=>true];check(result(fn()=>api_event_import($db,$history,$batch,'commit'))['imported']===1,'Reviewed source commits');
 check(result(fn()=>api_event_import($db,$history,$batch,'commit'))['alreadyCommitted'],'Commit idempotent');
 $view=result(fn()=>api_events($db,$history));check($view['children'][0]['dateOfBirth']===null,'Missing DOB is not fabricated');check((int)$view['children'][0]['reportedAge']===4,'Reported age preserved');check(count($view['contacts'])===1&&count($view['cards'])===1,'Doctor and daily card relational records');check($view['contacts'][0]['sourceText']==='Unseparated source clinic entry'&&$view['contacts'][0]['phone']===null,'Merged source contact text preserved without inventing a phone');check($view['historicalAttendance'][0]['pickedUp']===null,'Unknown pickup remains null');check($view['historicalAttendance'][0]['food']===null,'Whole-event food is not copied onto every day');
 $bad=$row;$bad['sourceKey']='needs-review';$bad['requiresReview']=true;$input=['rows'=>[$bad]];$review=result(fn()=>api_event_import($db,$history))['id'];$input=['confirm'=>true];reject(fn()=>api_event_import($db,$history,$review,'commit'),'IMPORT_REVIEW_REQUIRED');
 $method='GET';$preview=result(fn()=>api_event_import($db,$history,$review));$method='PATCH';$input=['rowId'=>$preview['rows'][0]['id'],'payload'=>$bad,'skip'=>true];result(fn()=>api_event_import($db,$history,$review,'row'));$method='POST';$input=['confirm'=>true];check(result(fn()=>api_event_import($db,$history,$review,'commit'))['imported']===0,'Explicit skip does not fabricate facts');
 $clear=$row;$clear['sourceKey']='partial-clear';$pending=$row;$pending['sourceKey']='partial-pending';$pending['requiresReview']=true;
 $input=['rows'=>[$clear,$pending]];$partial=result(fn()=>api_event_import($db,$history))['id'];$input=['confirm'=>true,'readyOnly'=>true];$partialResult=result(fn()=>api_event_import($db,$history,$partial,'commit'));
 check($partialResult['imported']===1&&$partialResult['state']==='PARTIAL','Clear rows import while ambiguous rows stay pending');
 check(result(fn()=>api_event_import($db,$history,$partial,'commit'))['imported']===0,'Repeated partial import is idempotent');
 $method='GET';$partialRows=result(fn()=>api_event_import($db,$history,$partial))['rows'];$method='PATCH';$input=['rowId'=>$partialRows[0]['id'],'payload'=>$clear,'skip'=>true];reject(fn()=>api_event_import($db,$history,$partial,'row'),'IMPORT_ROW_COMMITTED');if($db->inTransaction())$db->rollBack();$method='POST';
 check(event_volunteer_api_allowed('/api/v1/events','GET'),'Volunteer event list allowed');check(!event_volunteer_api_allowed('/api/v1/children','GET'),'Volunteer directory blocked');check(!event_volunteer_api_allowed('/api/v1/events/1','PATCH'),'Volunteer administration blocked');check(!event_volunteer_api_allowed('/api/v1/events/1/imports','POST'),'Volunteer import blocked');
 $actor=$owner;$actor['access_level']='EVENT_VOLUNTEER';$view=result(fn()=>api_events($db,$id));check(!$view['canOperate']&&!$view['canPickUp']&&count($view['children'])===1&&array_keys($view['children'][0])===['id','name','groupId','groupName','homeCampusId','homeCampus','sessionIds']&&count($view['attendance'])===1&&$view['staff']===[],'Event-only response includes safe attendance without private fields or operations');reject(fn()=>api_events($db,$history),'EVENT_NOT_FOUND');$actor=$owner;
 $input=['preset'=>'JUNGLE','enabled'=>true,'applyDashboard'=>true];result(fn()=>api_event_appearance($db,$id));$method='GET';check(result(fn()=>api_staff_appearance($db))['active']===null,'Default appearance fallback');
 $method='PATCH';$input=['preference'=>'EVENT'];check(result(fn()=>api_staff_appearance($db))['active']['preset']==='JUNGLE','Live event appearance preference');$method='POST';
 $input=['childId'=>$view['children'][0]['id']??0,'sessionId'=>$sid];reject(fn()=>api_event_arrival($db,$history),'EVENT_CLOSED');
 $roster=['classes'=>['Archive class'],'rotations'=>['Rotation'=>['Archive class']],'sourceName'=>'Diagnostic.pdf','warning'=>'Planned, not delivered','leads'=>[['dayNumber'=>1,'name'=>'Source Lead','sourcePage'=>1]],'activities'=>[['sourceKey'=>'roster-a1','dayNumber'=>1,'sourcePage'=>1,'title'=>'Diagnostic lesson','startsAt'=>'09:20','endsAt'=>'09:50','group'=>'Archive class','rawPeople'=>'Source Teacher / Ambiguous Block','people'=>[['name'=>'Source Teacher','role'=>'Lesson'],['name'=>'Ambiguous Block','role'=>'Lesson','requiresReview'=>true]]]]];
 $dayId=(int)$db->query('SELECT id FROM event_days WHERE event_id='.$history)->fetchColumn();$fileId=(int)$db->query('SELECT id FROM event_source_files WHERE event_id='.$history)->fetchColumn();
 if(!$fileId){$db->prepare("INSERT INTO event_source_files(event_id,original_name,stored_name,mime_type,byte_size,sha256,uploaded_by) VALUES(?,'Diagnostic.pdf','diagnostic.pdf','application/pdf',1,?,?)")->execute([$history,str_repeat('a',64),$owner['id']]);$fileId=(int)$db->lastInsertId();}
 $first=import_vbs_roster($db,$history,$roster,[1=>$dayId],$fileId);check($first['activitiesAdded']===1&&$first['sourceIdentities']===3,'Name-only historical roster is relational');
 check(import_vbs_roster($db,$history,$roster,[1=>$dayId],$fileId)['activitiesAdded']===0,'Roster retry is idempotent');
 $rosterView=result(fn()=>api_events($db,$history));check(count($rosterView['historicalRoster'])===3&&count($rosterView['rosterGroups'])===2,'Roster archive retains lead, class and rotation');
 check(count(array_filter($rosterView['rosterPeople'],fn($p)=>$p['staffId']!==null))===0,'First names do not auto-link staff or grant access');
 $sourcePerson=array_values(array_filter($rosterView['rosterPeople'],fn($p)=>$p['name']==='Source Teacher'))[0];$input=['staffId'=>$owner['id']];result(fn()=>api_event_roster_identity($db,$history,(int)$sourcePerson['id']));
 check(!event_member($db,$owner,$history),'Archive identity linking does not grant membership');
 $ambiguous=array_values(array_filter($rosterView['rosterPeople'],fn($p)=>$p['reviewRequired']))[0];reject(fn()=>api_event_roster_identity($db,$history,(int)$ambiguous['id']),'IDENTITY_REVIEW_REQUIRED');
 $input=['staffId'=>99999999];reject(fn()=>api_event_roster_identity($db,$history,(int)$sourcePerson['id']),'VALIDATION_ERROR');
 $actor['access_level']='TPK_TEACHER';reject(fn()=>api_event_roster_identity($db,$history,(int)$sourcePerson['id']),'FORBIDDEN');$actor=$owner;

 check(event_summary($db,$history)['volunteers']===3,'Source roster names included without inventing accounts');
 $db->prepare("INSERT INTO event_volunteers(event_id,staff_user_id,duty) VALUES(?,?,'TEACHER')")->execute([$history,$owner['id']]);
 check(event_summary($db,$history)['volunteers']===3,'Linked volunteer account not double counted');
 check(event_summary($db,$history)['registeredCampuses']===1,'Campuses calculated from child registration campus IDs');
 $input=['preset'=>'CUSTOM','enabled'=>true,'applyDashboard'=>true,'preserveAfter'=>true,'palette'=>event_default_palette()];result(fn()=>api_event_appearance($db,$history));
 $method='GET';$themes=result(fn()=>api_staff_appearance($db));check(count($themes['available'])===2,'Preserved archive offered as optional appearance');check($themes['active']['eventId']===$id,'Archived event never automatically replaces live dashboard');
 $method='PATCH';$input=['preference'=>'EVENT','selectedEventId'=>$history];check(result(fn()=>api_staff_appearance($db))['active']['eventId']===$history,'Explicit preserved archive preference applies');
 $input=['preference'=>'DEFAULT'];check(result(fn()=>api_staff_appearance($db))['active']===null,'Default restores normal appearance');
 $input=['preference'=>'EVENT','selectedEventId'=>999999];reject(fn()=>api_staff_appearance($db),'FORBIDDEN');$method='POST';
 $input=['preset'=>'CUSTOM','enabled'=>true,'palette'=>array_merge(event_default_palette(),['primary'=>'url(javascript:test)'])];reject(fn()=>api_event_appearance($db,$history),'VALIDATION_ERROR');
 $input['palette']=array_merge(event_default_palette(),['primary'=>'#ffffff']);reject(fn()=>api_event_appearance($db,$history),'VALIDATION_ERROR');
 $input=['preset'=>'JUNGLE','enabled'=>true,'artworkFileId'=>$fileId];reject(fn()=>api_event_appearance($db,$history),'VALIDATION_ERROR');
 $actor=$owner;$actor['access_level']='EVENT_VOLUNTEER';$method='PATCH';$input=['preference'=>'EVENT','selectedEventId'=>$history];check(result(fn()=>api_staff_appearance($db))['active']['eventId']===$history,'Assigned volunteer can choose only assigned event appearance');
 $input=['preference'=>'EVENT','selectedEventId'=>$copy];reject(fn()=>api_staff_appearance($db),'FORBIDDEN');$actor=$owner;$method='POST';
 $actor['access_level']='TPK_TEACHER';$safe=result(fn()=>api_events($db,$history));check(count($safe['children'])===2&&$safe['contacts']===[]&&$safe['cards']===[],'Teachers can see archived child names without private source data');foreach($safe['children'] as $child)check(array_keys($child)===['id','name','groupId','groupName','homeCampusId','homeCampus','sessionIds'],'Only allowlisted child directory fields');check(count($safe['historicalAttendance'])>0&&array_keys($safe['historicalAttendance'][0])===['childId','dayId','present'],'Archive marks exclude pickup and food data');$actor=$owner;
 check($db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM families)+(SELECT COUNT(*) FROM attendance)')->fetchColumn()===$peopleBefore,'Permanent ministry records changed');
 echo "PASS: $checks MySQL event, privacy, registration, group, pickup, duplication and assembly-history checks.\n";
}finally{if($db->inTransaction())$db->rollBack();foreach(array_reverse($temporary)as$table)$db->exec('DROP TEMPORARY TABLE `'.$table.'`');}
echo "Temporary event records removed; persistent people and attendance untouched.\n";
