<?php
declare(strict_types=1);
// Extract real handlers without loading the production bootstrap or credentials.
$source=file_get_contents(__DIR__.'/../public/v1.php');
foreach(['api_can_view_checkin','api_can_operate_checkin','api_can_assisted_checkin','api_checkins'] as $name){
    if(!preg_match('/^function '.preg_quote($name,'/').'\([^\n]*(?:\n(?!function )[\s\S]*?)?(?=\nfunction |\n\/\*\*|\z)/m',$source,$match))throw new RuntimeException('Missing '.$name);
    eval($match[0]);
}
class CheckinResult extends RuntimeException{public function __construct(public array $data){parent::__construct('API result');}}
class CheckinError extends RuntimeException{public function __construct(public string $apiCode){parent::__construct($apiCode);}}
$actor=['id'=>7,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];$head=false;
function api_actor(PDO $db):array{return $GLOBALS['actor'];}
function api_ok(array $data):never{throw new CheckinResult($data);}
function api_error(string $code,string $message,int $status=400):never{throw new CheckinError($code);}
function api_is_head_of_service(PDO $db,array $actor,int $service):bool{return $GLOBALS['head'];}
function tpk_pickup_ticket_url(string $token):string{return '/ticket/'.$token;}
class CheckinStatement extends PDOStatement{
    private array $rows=[];
    public function __construct(private CheckinDB $db,private string $sql){}
    public function execute(?array $params=null):bool{
        $this->db->queries[]=[$this->sql,$params];
        $this->rows=str_starts_with($this->sql,'SELECT 1 FROM service_sessions')?($params===[10,1]?[['found'=>1]]:[]):[
            ['id'=>1,'childId'=>11,'className'=>'Tribe A','ticketToken'=>'secret-one'],
            ['id'=>2,'childId'=>12,'className'=>'Tribe B','ticketToken'=>'secret-two'],
        ];return true;
    }
    public function fetchColumn(int $column=0):mixed{return $this->rows?1:false;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return $this->rows;}
}
class CheckinDB extends PDO{
    public array $queries=[];public function __construct(){}
    public function prepare(string $query,array $options=[]):PDOStatement|false{return new CheckinStatement($this,$query);}
}
$checks=0;
function checkVisibility(bool $condition,string $label):void{if(!$condition)throw new RuntimeException($label);$GLOBALS['checks']++;}
function checkinRead(CheckinDB $db):array{try{api_checkins($db);}catch(CheckinResult $r){return $r->data;}throw new RuntimeException('Missing API response');}
$_GET=['serviceSessionId'=>10];$db=new CheckinDB();$data=checkinRead($db);
checkVisibility($data['canViewCheckin']&&count($data['items'])===2,'All classroom arrivals readable');
checkVisibility(!$data['canOperate']&&!$data['canAssistedCheckin'],'Regular teacher cannot operate or use desk');
foreach($data['items'] as $row)checkVisibility(!isset($row['ticketToken'])&&$row['checkInFormUrl']===null,'No pickup bearer token or link disclosed');
checkVisibility(!str_contains($db->queries[1][0],'a.class_id IN'),'Visibility not limited to assigned classroom');
$head=true;$data=checkinRead($db);checkVisibility($data['canOperate']&&$data['canAssistedCheckin'],'Authorised service head retains tools');
checkVisibility($data['items'][0]['checkInFormUrl']==='/ticket/secret-one'&&!isset($data['items'][0]['ticketToken']),'Operator ticket link available without raw token');
$head=false;$actor['access_level']='TPK_SUPER_ADMIN';checkVisibility(checkinRead($db)['canOperate'],'Super Admin retains approval authority');
$_GET['serviceSessionId']=99;try{checkinRead($db);throw new RuntimeException('Foreign service accepted');}catch(CheckinError $e){checkVisibility($e->apiCode==='FORBIDDEN','Foreign campus service denied');}
echo 'PASS: '.$checks." check-in visibility and operator/pickup-privacy checks.\n";
