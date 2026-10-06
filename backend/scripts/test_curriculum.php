<?php
declare(strict_types=1);
// Isolated substitutes only: no database credentials, network calls or real uploads.
require __DIR__.'/../public/curriculum.php';
class CurriculumResult extends RuntimeException {public function __construct(public array $data,public int $status){parent::__construct('Response');}}
class CurriculumError extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
$actor=['id'=>7,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];$ready=true;$input=[];
function api_actor(PDO $db,bool $super=false):array {if($super&&$GLOBALS['actor']['access_level']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super required');return $GLOBALS['actor'];}
function api_table_exists(PDO $db,string $name):bool{return $GLOBALS['ready'];}
function api_input():array{return $GLOBALS['input'];}
function api_error(string $code,string $message,int $status=400):never{throw new CurriculumError($code);}
function api_ok(array $data,int $status=200):never{throw new CurriculumResult($data,$status);}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void{}
class CurriculumStatement extends PDOStatement {
 private array $rows=[];
 public function __construct(private CurriculumDB $db,private string $sql){}
 public function execute(?array $params=null):bool{$p=$params??[];$this->db->queries[]=[$this->sql,$p];$this->rows=[];
  if(str_contains($this->sql,'COUNT(ch.id)'))$this->rows=[['id'=>2,'name'=>'Sample Class','active'=>1,'minAge'=>5,'maxAge'=>8,'children'=>2]];
  elseif(str_contains($this->sql,'p.class_id,p.description'))$this->rows=[['class_id'=>2,'description'=>'Learn and grow']];
  elseif(str_contains($this->sql,'FROM curriculum_resources r'))$this->rows=[['id'=>1,'fileName'=>'Lesson.pdf']];
  elseif(str_contains($this->sql,'min_age<=?'))$this->rows=$this->db->overlap?[['id'=>3]]:[];
  elseif(str_contains($this->sql,'FROM classes WHERE id=?'))$this->rows=$p[0]===2&&$p[1]===1?[['id'=>2]]:[];
  elseif(str_starts_with($this->sql,'INSERT INTO curriculum_resources'))$this->db->saved=$p;
  return true;
 }
 public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0):mixed{return $this->rows[0]??false;}
 public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return $this->rows;}
}
class CurriculumDB extends PDO {public array $queries=[],$saved=[];public bool $committed=false,$overlap=false;private bool $transaction=false;public function __construct(){}public function prepare(string $sql,array $options=[]):PDOStatement|false{return new CurriculumStatement($this,$sql);}public function beginTransaction():bool{$this->transaction=true;return true;}public function commit():bool{$this->committed=true;$this->transaction=false;return true;}public function rollBack():bool{$this->transaction=false;return true;}public function inTransaction():bool{return $this->transaction;}public function lastInsertId(?string $name=null):string|false{return '100';}}
function verifyCurriculum(bool $test,string $message):void{if(!$test)throw new RuntimeException($message);}
function rejectedCurriculum(callable $fn,string $code):void{try{$fn();}catch(CurriculumError $e){verifyCurriculum($e->apiCode===$code,'Expected '.$code.' got '.$e->apiCode);return;}throw new RuntimeException('Expected '.$code);}
function resultCurriculum(callable $fn):array{try{$fn();}catch(CurriculumResult $r){return $r->data;}throw new RuntimeException('Expected response');}
verifyCurriculum(api_curriculum_date('2026-10-04')==='2026-10-04','Sunday accepted');
verifyCurriculum(api_curriculum_date('')===null,'Unscheduled game accepted');
foreach(['2026-10-05','2026-02-30','tomorrow'] as $date)rejectedCurriculum(fn()=>api_curriculum_date($date),'VALIDATION_ERROR');
verifyCurriculum(api_curriculum_url('https://www.youtube.com/watch?v=example')!==null,'HTTPS video accepted');
foreach(['javascript:alert(1)','http://example.com','https://user:secret@example.com','https://']as $url)rejectedCurriculum(fn()=>api_curriculum_url($url),'VALIDATION_ERROR');
$db=new CurriculumDB();$_GET=['month'=>'2026-10','week'=>'2026-10-04','classId'=>2];$data=resultCurriculum(fn()=>api_curriculum($db));verifyCurriculum(!$data['canManage']&&$data['classes'][0]['description']==='Learn and grow','Off-duty teacher reads all campus class materials but cannot manage');verifyCurriculum($data['items'][0]['downloadUrl']==='/api/v1/curriculum/resources/1/file','Private download endpoint');$query=$db->queries[2];verifyCurriculum($query[1]===[1,'2026-10-01','2026-11-01',2,'2026-10-04'],'Campus, month, class and Sunday filters use bound parameters');verifyCurriculum(str_contains($query[0],'r.week_date IS NULL'),'Reusable games stay available');
rejectedCurriculum(fn()=>api_curriculum_save($db),'FORBIDDEN');rejectedCurriculum(fn()=>api_curriculum_class_save($db,2),'FORBIDDEN');
$ready=false;$data=resultCurriculum(fn()=>api_curriculum(new CurriculumDB()));verifyCurriculum(!$data['available']&&count($data['classes'])===1,'Missing migration leaves class directory readable');$actor['access_level']='TPK_SUPER_ADMIN';rejectedCurriculum(fn()=>api_curriculum_save($db),'FEATURE_NOT_READY');$ready=true;
$_FILES=[];$_POST=['type'=>'VIDEO','title'=>'Sample video','classId'=>2,'weekDate'=>'2026-10-04','videoUrl'=>'https://example.com/video'];$saved=new CurriculumDB();resultCurriculum(fn()=>api_curriculum_save($saved));verifyCurriculum($saved->committed&&$saved->saved[0]===1&&$saved->saved[2]==='2026-10-04','Video is saved for exact campus and week');
$_POST=['type'=>'GAME','title'=>'Kindness Circle','classId'=>2,'durationMinutes'=>'10','materials'=>'Paper','instructions'=>'Take turns.'];$saved=new CurriculumDB();resultCurriculum(fn()=>api_curriculum_save($saved));verifyCurriculum($saved->saved[2]===null&&$saved->saved[3]==='GAME','Reusable game has no Sunday');
$_POST['durationMinutes']='-1';rejectedCurriculum(fn()=>api_curriculum_save(new CurriculumDB()),'VALIDATION_ERROR');$_POST['durationMinutes']='10';$_POST['classId']=999;rejectedCurriculum(fn()=>api_curriculum_save(new CurriculumDB()),'CLASS_NOT_FOUND');
$_POST=['type'=>'LESSON','title'=>'Sample lesson','classId'=>2,'weekDate'=>'2026-10-04'];rejectedCurriculum(fn()=>api_curriculum_save(new CurriculumDB()),'VALIDATION_ERROR');
$input=['name'=>'Sample Class','description'=>'Learn together','minAge'=>5,'maxAge'=>8,'displayOrder'=>2,'active'=>true];$db=new CurriculumDB();$db->overlap=true;rejectedCurriculum(fn()=>api_curriculum_class_save($db,2),'OVERLAPPING_AGES');rejectedCurriculum(fn()=>api_curriculum_class_save(new CurriculumDB(),999),'CLASS_NOT_FOUND');$saved=new CurriculumDB();resultCurriculum(fn()=>api_curriculum_class_save($saved,2));verifyCurriculum($saved->committed,'Valid class edit commits');foreach($saved->queries as [$sql])verifyCurriculum(!str_starts_with($sql,'UPDATE children'),'Age edits never silently move existing children');
echo "PASS: curriculum filters, private downloads, off-duty reading, Super-only writes, validation, reusable games and class editing.\n";
