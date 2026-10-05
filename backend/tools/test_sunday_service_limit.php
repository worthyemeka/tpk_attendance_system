<?php
declare(strict_types=1);
// Native validation regression, using an in-memory PDO double. No database connection or writes.
class ScheduleResult extends RuntimeException { public function __construct(public array $result) {parent::__construct('API result');} }
class ScheduleStatement extends PDOStatement {
    public function __construct() {}
    public function execute(?array $params=null): bool { return true; }
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0): mixed {return false;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return [];}
}
class ScheduleDatabase extends PDO {
    public bool $started=false;
    public function __construct() {}
    public function prepare(string $query,array $options=[]): PDOStatement|false {return new ScheduleStatement();}
    public function query(string $query,?int $fetchMode=null,mixed ...$args): PDOStatement|false {return new ScheduleStatement();}
    public function beginTransaction(): bool {$this->started=true;return true;}
    public function commit(): bool {return true;}
}
function api_actor(PDO $db,bool $super=false): array {return ['id'=>1,'campus_id'=>1];}
function api_table_exists(PDO $db,string $table): bool {return true;}
function api_method(): string {return 'PUT';}
function api_input(): array {return $GLOBALS['payload'];}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]): void {}
function api_error(string $code,string $message,int $status=400): never {throw new ScheduleResult(['success'=>false,'code'=>$code,'status'=>$status]);}
function api_ok(array $data,int $status=200): never {throw new ScheduleResult(['success'=>true]);}
require dirname(__DIR__).'/public/sunday-schedule.php';
foreach([0,1,2,3,4,12] as $count){
    $GLOBALS['payload']=['serviceDate'=>'2026-10-11','theme'=>'Thanksgiving','sessions'=>array_map(fn($i)=>['startTime'=>sprintf('%02d:00',6+$i*2),'endTime'=>sprintf('%02d:00',7+$i*2)],range(0,max(0,$count-1)))];
    if(!$count)$GLOBALS['payload']['sessions']=[];
    $db=new ScheduleDatabase();
    try{api_sunday_schedule($db);}catch(ScheduleResult $result){$allowed=$count>=1&&$count<=3;if($result->result['success']!==$allowed||$db->started!==$allowed)throw new RuntimeException("Failed service-count test: {$count}");echo "PASS: {$count} services ".($allowed?'accepted':'rejected before writes')."\n";}
}
