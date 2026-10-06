<?php
declare(strict_types=1);
// Campus-scoped, off-duty permissions against fixture PDO only.
require __DIR__.'/../public/classroom-interactions.php';
require __DIR__.'/../public/classrooms-context.php';
class SharedResult extends RuntimeException {public function __construct(public array $data){parent::__construct('Response');}}
class SharedError extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
$actor=['id'=>7,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];$input=[];
function api_actor(PDO $db):array{return $GLOBALS['actor'];}
function api_input():array{return $GLOBALS['input'];}
function api_ok(array $data,int $status=200):never{throw new SharedResult($data);}
function api_error(string $code,string $message,int $status=400):never{throw new SharedError($code);}
function api_table_exists(PDO $db,string $table):bool{return true;}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void{}
function api_classroom_teachers(PDO $db,int $id,?array $service):array{return [];}
class SharedStatement extends PDOStatement {
 private array $rows=[];
 public function __construct(private SharedDB $db,private string $sql){}
 public function execute(?array $params=null):bool{$p=$params??[];$this->db->queries[]=[$this->sql,$p];
  $this->rows=match(true){
   str_contains($this->sql,'FROM service_sessions')=>$p[0]===11&&$p[1]===1?[['id'=>11,'name'=>'Sunday','serviceDate'=>'2026-10-04','service_date'=>'2026-10-04','service_type'=>'SECOND_SERVICE']]:[],
   str_contains($this->sql,'FROM classes c')=>[['id'=>1,'name'=>'Tribe A','registered'=>2],['id'=>2,'name'=>'Tribe B','registered'=>3]],
   str_contains($this->sql,'FROM classroom_weekly_reviews')=>$p[0]===10&&$p[1]===1?[['id'=>10,'class_id'=>2,'service_session_id'=>11]]:[],
   str_contains($this->sql,'FROM attendance')=>[['total'=>0]],
   default=>[],
  };
  if(str_starts_with($this->sql,'INSERT INTO classroom_review_replies'))$this->db->replies[]=$p;
  return true;
 }
 public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0):mixed{return $this->rows[0]??false;}
 public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return $this->rows;}
 public function fetchColumn(int $column=0):mixed{return $this->rows?array_values($this->rows[0])[$column]:false;}
}
class SharedDB extends PDO {public array $queries=[],$replies=[];public function __construct(){}public function prepare(string $query,array $options=[]):PDOStatement|false{return new SharedStatement($this,$query);}}
function verifyShared(bool $v,string $message):void{if(!$v)throw new RuntimeException($message);}
$db=new SharedDB();$_GET=['serviceSessionId'=>11];$sessions=api_classroom_context_sessions($db,$actor);verifyShared(count($sessions)===1,'Off-duty teacher can browse selected campus service');$snapshot=api_classroom_context_snapshot($db,$actor,$sessions[0]);verifyShared(array_column($snapshot['items'],'id')===[1,2],'All campus classes are visible');verifyShared(api_discussion_payload($db,$actor,10)['canInteract'],'Off-duty teacher can react and reply');$input=['body'=>'Well done, team!'];try{api_discussion($db,10,'reply');}catch(SharedResult $e){}verifyShared($db->replies===[[10,'Well done, team!',7]],'Reply records the signed-in teacher');verifyShared(!api_review_allowed($db,$actor,2,11),'Off-duty teacher cannot overwrite the class team review');
try{api_discussion_payload($db,['id'=>7,'campus_id'=>2,'access_level'=>'TPK_ADMIN'],10);throw new RuntimeException('Cross-campus discussion leaked');}catch(SharedError $e){verifyShared($e->apiCode==='REVIEW_NOT_FOUND','Cross-campus discussion stays private');}
foreach($db->queries as [$sql])verifyShared(!str_contains($sql,'staff_class_assignments'),'Shared viewing never depends on assignment membership');
echo "PASS: all-class browsing, off-duty reactions/replies, protected review publishing and campus isolation.\n";
