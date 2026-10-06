<?php
declare(strict_types=1);
// Fake PDO only: never connects to or modifies a real database.
final class FollowupCapture extends RuntimeException { public function __construct(public array $data){parent::__construct('Response captured');} }
function api_actor(PDO $db): array {return $GLOBALS['actor'];}
function api_is_followup_lead(array $actor): bool {return in_array($actor['access_level'],['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN'],true);}
function api_method(): string {return 'GET';}
function api_ok(array $data,int $status=200): never {throw new FollowupCapture($data);}
function api_error(string $code,string $message,int $status=400): never {throw new RuntimeException($code);}
class CompletionStatement extends PDOStatement {
    public function __construct(private array $rows){}
    public function execute(?array $params=null): bool {return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0): mixed {return $this->rows[0]??false;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return $this->rows;}
}
class CompletionDatabase extends PDO {
    public array $queries=[];
    public function __construct(){}
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $this->queries[]=$query;
        $rows=match(true){
            str_contains($query,'FROM follow_up_cases')=>[['id'=>1,'campusId'=>1,'familyId'=>2,'ownerId'=>42,'ownerName'=>'Daniel James','familyName'=>'Bennett','status'=>'CONTACTED','lastContactedAt'=>'2026-10-05 14:30:00']],
            str_contains($query,'FROM follow_up_case_children')=>[['id'=>3,'firstName'=>'Maya','lastName'=>'Bennett','missedServiceDate'=>'2026-10-04']],
            str_contains($query,'FROM follow_up_case_events')=>[['id'=>4,'eventType'=>'CONTACTED','staffName'=>'Daniel James','createdAt'=>'2026-10-05 14:30:00']],
            default=>[],
        };
        return new CompletionStatement($rows);
    }
}
$source=file_get_contents(__DIR__.'/../public/v1.php');
foreach(['api_followup_case_allowed','api_followup'] as $name){
    if(!preg_match('/function '.preg_quote($name,'/').'\([^\n]*\{.*?\n\}/s',$source,$match))throw new RuntimeException('Missing function '.$name);
    eval($match[0]);
}
foreach(['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_ADMIN'] as $role){
    $GLOBALS['actor']=['id'=>42,'campus_id'=>1,'access_level'=>$role];$db=new CompletionDatabase();
    try{api_followup($db,1);}catch(FollowupCapture $result){
        if($result->data['ownerId']!==42||$result->data['ownerName']!=='Daniel James'||$result->data['childrenCount']!==1||$result->data['status']!=='CONTACTED')throw new RuntimeException('Lost completion or assigned teacher for '.$role);
        echo "PASS: $role receives the saved assignment and contact history.\n";
    }
}
$GLOBALS['actor']=['id'=>99,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];
try{api_followup(new CompletionDatabase(),1);throw new RuntimeException('Unexpected access');}catch(RuntimeException $e){if($e->getMessage()!=='FORBIDDEN')throw $e;}
if(!str_contains($source,"(status='CONTACTED' AND DATE(last_contacted_at)>=?))"))throw new RuntimeException('A completed earlier week must not absorb a new absence.');
echo "Follow-up completion API checks passed (5 cases).\n";
