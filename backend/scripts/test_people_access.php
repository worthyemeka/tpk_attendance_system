<?php
declare(strict_types=1);
require __DIR__.'/../public/people-access.php';
class AccessDenied extends RuntimeException {}
function api_error(string $code,string $message,int $status=400):never{throw new AccessDenied($code);}
class AccessStatement extends PDOStatement {
    private mixed $result=false;
    public function __construct(private AccessDB $db,private string $sql){}
    public function execute(?array $params=null):bool{
        if(str_contains($this->sql,'SELECT timezone')){$this->result=$this->db->zone;return true;}
        [$campus,$user,$start,$end]=$params;
        $this->result=false;
        foreach($this->db->assignments as $a){
            if($a['campus']===$campus&&$a['user']===$user&&$a['date']>=$start&&$a['date']<$end&&date('N',strtotime($a['date']))==='7'&&in_array($a['duty'],['HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2'],true)&&!in_array($a['status'],['CANCELLED','REPLACED','ABSENT'],true)&&($a['sessionValid']??true))$this->result=1;
        }
        $this->db->lastParams=$params;
        return true;
    }
    public function fetchColumn(int $column=0):mixed{return $this->result;}
}
class AccessDB extends PDO {
    public array $assignments=[];public array $lastParams=[];public string $zone='Africa/Lagos';
    public function __construct(){}
    public function prepare(string $query,array $options=[]):PDOStatement|false{return new AccessStatement($this,$query);}
}
$checks=0;function checkAccess(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);$GLOBALS['checks']++;}
$db=new AccessDB();$actor=['id'=>7,'campus_id'=>2,'access_level'=>'TPK_ADMIN'];$now=new DateTimeImmutable('2026-10-07T12:00:00+01:00');
checkAccess(api_people_week($now)===['2026-10-05','2026-10-12'],'Week must run Monday–Sunday');
checkAccess(api_people_week(new DateTimeImmutable('2026-10-11T23:59:59+01:00'))===['2026-10-05','2026-10-12'],'Sunday must remain in its week');
checkAccess(api_people_week(new DateTimeImmutable('2026-10-12T00:00:00+01:00'))===['2026-10-12','2026-10-19'],'Monday must revoke previous-week access');
foreach(['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN'] as $role)checkAccess(api_can_view_people_directory($db,array_merge($actor,['access_level'=>$role]),$now),'Leadership role denied');
checkAccess(!api_can_view_people_directory($db,$actor,$now),'Off-duty teacher permitted');
$base=['user'=>7,'campus'=>2,'date'=>'2026-10-11','duty'=>'HEAD_OF_SERVICE','status'=>'ASSIGNED'];
foreach(['HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2'] as $duty){$db->assignments=[array_merge($base,['duty'=>$duty])];checkAccess(api_can_view_people_directory($db,$actor,$now),'Weekly leadership denied');}
foreach(['ATTENDANCE','ASSEMBLY','TRIBE_A','FIRST_SERVICE_TEAM'] as $duty){$db->assignments=[array_merge($base,['duty'=>$duty])];checkAccess(!api_can_view_people_directory($db,$actor,$now),'Non-lead duty granted private access');}
foreach(['CANCELLED','REPLACED','ABSENT'] as $status){$db->assignments=[array_merge($base,['status'=>$status])];checkAccess(!api_can_view_people_directory($db,$actor,$now),'Inactive assignment granted access');}
foreach([['date'=>'2026-10-04'],['date'=>'2026-10-18'],['campus'=>3],['user'=>8],['sessionValid'=>false],['date'=>'2026-10-07']] as $override){$db->assignments=[array_merge($base,$override)];checkAccess(!api_can_view_people_directory($db,$actor,$now),'Invalid scope granted access');}
$db->assignments=[array_merge($base,['date'=>'2026-10-04'])];$_GET=['serviceSessionId'=>101,'date'=>'2026-10-04'];checkAccess(!api_can_view_people_directory($db,$actor,$now),'Historic selection granted access');$_GET=[];
checkAccess(!api_can_view_people_directory($db,array_merge($actor,['access_level'=>'EVENT_VOLUNTEER']),$now),'Event account granted regular records');
$db->assignments=[$base];$db->zone='America/New_York';checkAccess(api_can_view_people_directory($db,$actor,new DateTimeImmutable('2026-10-12T02:00:00Z')),'Campus timezone not respected');
foreach(['/api/v1/children','/api/v1/children/9/attendance','/api/v1/children/attendance-report','/api/v1/guardians/1','/api/v1/families/summary','/api/v1/check-ins','/api/v1/pickup-dashboard','/api/v1/pickup-codes/assisted-lookup','/api/v1/assisted-check-ins/family','/api/v1/classes/2/children','/api/v1/classrooms/2','/api/v1/follow-ups/1'] as $path)checkAccess(api_people_record_route($path),'Record route unprotected: '.$path);
foreach(['/api/v1/me/people-access','/api/v1/dashboard/overview','/api/v1/curriculum','/api/v1/roster/management','/api/v1/public/registrations'] as $path)checkAccess(!api_people_record_route($path),'Unrelated route blocked: '.$path);
$source=file_get_contents(__DIR__.'/../public/v1.php');checkAccess(str_contains($source,'if(api_people_record_route(api_path()))api_require_people_access($db,$user);'),'Authentication does not enforce route policy');
echo "PASS: $checks people-access checks: exact duties, dates, status, campus, timezone and alternate record routes.\n";
