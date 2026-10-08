<?php
declare(strict_types=1);
if(getenv('TPK_MYSQL_SMOKE')!=='1'){echo "Skipped: enable TPK_MYSQL_SMOKE for read-only MySQL checks.\n";exit;}
require (getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__)).'/config.php';
require __DIR__.'/../public/people-privacy.php';
require __DIR__.'/../public/people-access.php';
class ChildResponse extends RuntimeException {public function __construct(public mixed $data,public ?array $meta=null){parent::__construct('Captured response');}}
class ChildDenied extends RuntimeException {}
function api_ok(mixed $data,int $status=200,?array $meta=null):never{throw new ChildResponse($data,$meta);}
function api_error(string $code,string $message,int $status=400):never{throw new ChildDenied($code);}
function api_actor(PDO $db,bool $super=false):array{if($super&&$GLOBALS['actor']['access_level']!=='TPK_SUPER_ADMIN')throw new ChildDenied('FORBIDDEN');return $GLOBALS['actor'];}
function api_method():string{return $GLOBALS['method']??'GET';}
function api_page():array{return [1,12,0];}
function api_permitted_class_ids(PDO $db,array $actor):?array{return [];}
// Load the exact production handler bodies, without running the router,
// creating a login session, or mutating any child or family record.
$source=file_get_contents($argv[1]??__DIR__.'/../public/v1.php');
$tokens=token_get_all($source);$functions=['api_child_select','api_child_age','api_children_summary','api_directory_month','api_directory_attendance','api_latest_completed_sunday','api_sunday_presence','api_child_allowed','api_list_children','api_child','api_guardians_directory','api_guardian_directory_detail','api_families_directory','api_family_directory_detail'];
foreach($tokens as $i=>$token){if(!is_array($token)||$token[0]!==T_FUNCTION)continue;$j=$i+1;while(isset($tokens[$j])&&is_array($tokens[$j])&&$tokens[$j][0]===T_WHITESPACE)$j++;if(!isset($tokens[$j])||!is_array($tokens[$j])||!in_array($tokens[$j][1],$functions,true))continue;$code='';$depth=0;$opened=false;for($k=$i;$k<count($tokens);$k++){$part=$tokens[$k];$code.=is_array($part)?$part[1]:$part;if($part==='{'){$opened=true;$depth++;}if($part==='}'&&--$depth===0&&$opened)break;}eval($code);}
function capture(callable $fn):ChildResponse{try{$fn();}catch(ChildResponse $r){return $r;}throw new RuntimeException('Expected response');}
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);$GLOBALS['checks']++;}
$db=db();$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();$checks=0;
try{
 $actor=$db->query("SELECT id,campus_id,access_level FROM staff_users WHERE access_level='TPK_ADMIN' AND is_active=1 ORDER BY id LIMIT 1")->fetch();check((bool)$actor,'A regular teacher is needed for the read-only smoke test');$_GET=[];
 $count=$db->prepare('SELECT COUNT(*) FROM children c JOIN families f ON f.id=c.family_id WHERE f.campus_id=?');$count->execute([$actor['campus_id']]);$total=(int)$count->fetchColumn();
 $teacher=capture(fn()=>api_list_children($db));check($teacher->meta['total']===$total,'Teacher directory must include all regular campus children');check(count($teacher->data)===min(12,$total),'Teacher pagination mismatch');
 foreach($teacher->data as $row){check(isset($row['firstName'])&&array_key_exists('className',$row)&&array_key_exists('age',$row),'Regular child fields missing');check(!isset($row['homeCampus']),'VBS campus field leaked into regular directory');check($row===api_without_household_addresses($row),'Household address exposed');}
 $summary=capture(fn()=>api_children_summary($db));check($summary->data['registeredChildren']===$total,'Summary cards and full directory disagree');
 if($teacher->data){$id=(int)$teacher->data[0]['id'];$profile=capture(fn()=>api_child($db,$id));check(isset($profile->data['guardians'],$profile->data['attendanceHistory']),'Read-only profile details missing');check($profile->data===api_without_household_addresses($profile->data),'Profile address exposed');$method='PATCH';try{api_child($db,$id);throw new RuntimeException('Teacher edit unexpectedly permitted');}catch(ChildDenied $e){check($e->getMessage()==='FORBIDDEN','Teacher edit guard failed');}$method='GET';}
 $actor['access_level']='TPK_SUPER_ADMIN';$admin=capture(fn()=>api_list_children($db));check(array_column($admin->data,'id')===array_column($teacher->data,'id'),'Teacher and Super Admin regular directory rows differ');
 $peopleActors=$db->query("SELECT id,campus_id,access_level FROM staff_users WHERE access_level IN ('TPK_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_SUPER_ADMIN') AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE'")->fetchAll();
 foreach($peopleActors as $person){$actor=$person;$_GET=[];
  foreach(['api_guardians_directory','api_families_directory'] as $handler){$directory=capture(fn()=>$handler($db));check(is_array($directory->data)&&isset($directory->meta['total']),'Teacher denied guardian/family directory');
   if($directory->data){$id=(int)$directory->data[0]['id'];$detail=$handler==='api_guardians_directory'?'api_guardian_directory_detail':'api_family_directory_detail';$record=capture(fn()=>$detail($db,$id));check(isset($record->data['children']),'Teacher guardian/family profile missing');}
  }
 }
 echo "PASS: $checks read-only production SQL checks; shared child cards/profile fields, no VBS campus columns, no household addresses, teacher edits denied.\n";
}finally{$db->rollBack();}
