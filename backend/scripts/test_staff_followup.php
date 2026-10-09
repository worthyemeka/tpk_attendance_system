<?php
declare(strict_types=1);
// Isolated fake PDO tests: no production records or sessions are modified.
final class StaffResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('Captured');}}
function api_actor(PDO $db):array{return $GLOBALS['actor'];}
function api_input():array{return ['staffUserId'=>42];}
function api_is_followup_lead(array $actor):bool{return in_array($actor['access_level'],['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN'],true);}
function api_followup_case_allowed(PDO $db,array $actor,int $id):array{return ['id'=>$id];}
function api_ok(array $data,int $status=200):never{throw new StaffResponse($data);}
function api_error(string $code,string $message,int $status=400):never{throw new RuntimeException($code);}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void{}
class StaffStatement extends PDOStatement {
 public function __construct(private array $rows){}
 public function execute(?array $params=null):bool{return true;}
 public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0):mixed{return $this->rows[0]??false;}
 public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return $this->rows;}
}
class StaffDatabase extends PDO {
 public function __construct(public string $targetRole='TPK_FOLLOW_UP_ADMIN',public bool $available=true){}
 public function beginTransaction():bool{return true;}
 public function commit():bool{return true;}
 public function inTransaction():bool{return true;}
 public function rollBack():bool{return true;}
 public function prepare(string $query,array $options=[]):PDOStatement|false {
  if(str_contains($query,'FROM staff_users s')){
   foreach(["s.campus_id=?","s.is_active=1","s.account_status='VERIFIED'","s.team_status<>'INACTIVE'"] as $guard)if(!str_contains($query,$guard))throw new RuntimeException('Missing eligibility guard');
   $included=str_contains($query,"s.access_level IN ('TPK_ADMIN','TPK_FOLLOW_UP_ADMIN')")&&in_array($this->targetRole,['TPK_ADMIN','TPK_FOLLOW_UP_ADMIN'],true);
   return new StaffStatement($included&&$this->available?[['id'=>42,'name'=>'Fixture Teacher']]:[]);
  }
  return new StaffStatement([]);
 }
}
$root=$argv[1]??dirname(__DIR__);$source=file_get_contents($root.'/public/v1.php');
foreach(['api_followup_assignees','api_assign_followup'] as $name){if(!preg_match('/function '.$name.'\([^\n]*\{.*?\n\}/s',$source,$match))throw new RuntimeException('Missing handler');eval($match[0]);}
$checks=0;$GLOBALS['actor']=['id'=>1,'name'=>'Fixture Admin','campus_id'=>1,'access_level'=>'TPK_SUPER_ADMIN'];
foreach(['TPK_ADMIN','TPK_FOLLOW_UP_ADMIN'] as $role){
 try{api_followup_assignees(new StaffDatabase($role));}catch(StaffResponse $r){if(($r->data[0]['id']??0)!==42)throw new RuntimeException('Eligible teacher missing');$checks++;}
 try{api_assign_followup(new StaffDatabase($role),7);}catch(StaffResponse $r){if($r->data['assignedToStaffUserId']!==42)throw new RuntimeException('Assignment failed');$checks++;}
}
foreach([new StaffDatabase('EVENT_VOLUNTEER'),new StaffDatabase('TPK_FOLLOW_UP_ADMIN',false)] as $db){try{api_assign_followup($db,7);throw new RuntimeException('Ineligible assignee accepted');}catch(RuntimeException $e){if($e->getMessage()!=='TEACHER_NOT_AVAILABLE')throw $e;$checks++;}}
$GLOBALS['actor']['access_level']='TPK_ADMIN';foreach(['api_followup_assignees','api_assign_followup'] as $handler){try{$handler(new StaffDatabase(),7);throw new RuntimeException('Regular teacher can manage assignments');}catch(RuntimeException $e){if($e->getMessage()!=='FORBIDDEN')throw $e;$checks++;}}
require $root.'/public/people-privacy.php';
$safe=api_without_household_addresses(['residentialAddress'=>'Fixture staff house','family'=>['homeAddress'=>'Private household']]);if(($safe['residentialAddress']??null)!=='Fixture staff house'||isset($safe['family']['homeAddress']))throw new RuntimeException('Staff address and household privacy confused');$checks++;
echo "PASS: $checks staff address and follow-up assignment checks.\n";
