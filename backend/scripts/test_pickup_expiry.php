<?php
declare(strict_types=1);
require __DIR__.'/../public/pickup-validity.php';
$checks=0;
function verifyPickup(bool $value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
$sunday=['serviceType'=>'FIRST_SERVICE','serviceDate'=>'2026-10-11','timezone'=>'Africa/Lagos'];
foreach(['2026-10-11T00:00:00+01:00','2026-10-11T23:59:59+01:00'] as $instant)verifyPickup(tpk_sunday_pickup_state($sunday,new DateTimeImmutable($instant))['valid'],'Valid Sunday rejected');
foreach(['2026-10-10T23:59:59+01:00','2026-10-12T00:00:00+01:00','2026-10-18T10:00:00+01:00'] as $instant)verifyPickup(!tpk_sunday_pickup_state($sunday,new DateTimeImmutable($instant))['valid'],'Early/expired code accepted');
verifyPickup(tpk_sunday_pickup_state($sunday)['expiresAt']==='2026-10-12T00:00:00+01:00','Local midnight deadline wrong');
$ny=array_merge($sunday,['timezone'=>'America/New_York']);
verifyPickup(tpk_sunday_pickup_state($ny,new DateTimeImmutable('2026-10-12T03:59:59Z'))['valid'],'UTC used instead of campus time');
verifyPickup(!tpk_sunday_pickup_state($ny,new DateTimeImmutable('2026-10-12T04:00:00Z'))['valid'],'Campus midnight not enforced');
$dst=array_merge($ny,['serviceDate'=>'2026-11-01']);
verifyPickup(tpk_sunday_pickup_state($dst,new DateTimeImmutable('2026-11-02T04:59:59Z'))['valid'],'DST day truncated');
verifyPickup(!tpk_sunday_pickup_state($dst,new DateTimeImmutable('2026-11-02T05:00:00Z'))['valid'],'DST midnight wrong');
foreach(['','not-a-date','2026-02-30','2026-10-09'] as $day)verifyPickup(!tpk_sunday_pickup_state(array_merge($sunday,['serviceDate'=>$day]))['valid'],'Invalid Sunday accepted');
verifyPickup(tpk_sunday_pickup_state(['serviceType'=>null])['valid'],'Unrelated event policy changed');
class PickupReply extends RuntimeException{public function __construct(public mixed $data){parent::__construct('reply');}}
class PickupFailure extends RuntimeException{public function __construct(public string $apiCode,public int $status){parent::__construct($apiCode);}}
function api_error(string $code,string $message,int $status=400):never{throw new PickupFailure($code,$status);}
function public_error(string $code,string $message,int $status=400):never{throw new PickupFailure($code,$status);}
function api_ok(mixed $data):never{throw new PickupReply($data);}
function public_reply(mixed $data):never{throw new PickupReply($data);}
function api_actor(PDO $db):array{return ['id'=>9,'campus_id'=>1,'access_level'=>'TPK_SUPER_ADMIN'];}
function api_input():array{return ['firstName'=>'Fixture','lastName'=>'Child','dateOfBirth'=>'2020-01-01','serviceSessionId'=>1];}
function api_can_operate_sunday(PDO $db,array $actor,int $id):bool{return true;}
function api_audit(mixed ...$args):void{throw new RuntimeException('Expired code reached audit/write path');}
function tpk_pickup_ticket_url(string $token):string{return '/fixture-ticket';}
class PickupFixtureStatement extends PDOStatement{
 private array $row=[];
 public function __construct(private PickupFixtureDB $db,private string $sql){}
 public function execute(?array $params=null):bool{
  $this->db->queries[]=$this->sql;
  if(!str_starts_with($this->sql,'SELECT'))throw new RuntimeException('Unexpected data write');
  $this->row=str_contains($this->sql,'cp.timezone')?['serviceType'=>'FIRST_SERVICE','serviceDate'=>'2020-01-05','timezone'=>'Africa/Lagos']:['id'=>1,'pickupCodeId'=>1,'service_session_id'=>1,'family_id'=>1,'display_code'=>'TPK-A-001','pickupCode'=>'TPK-A-001','ticketToken'=>str_repeat('a',64),'qrToken'=>str_repeat('a',64),'collected_at'=>null,'status'=>'APPROVED','requestedAt'=>null,'approvedAt'=>null,'decisionNote'=>null,'child_ids_json'=>'[]'];return true;
 }
 public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0):mixed{return $this->row;}
}
class PickupFixtureDB extends PDO{public array $queries=[];public function __construct(){} public function prepare(string $sql,array $options=[]):PDOStatement|false{return new PickupFixtureStatement($this,$sql);}}
function loadPickupHandler(string $source,string $name):void{
 if(!preg_match('/^function '.preg_quote($name,'/').'\([^\n]*(?:\n(?!function )[\s\S]*?)?(?=\nfunction |\nif \(|\z)/m',$source,$m))throw new RuntimeException('Missing '.$name);eval($m[0]);
}
$v=file_get_contents(__DIR__.'/../public/v1.php');$p=file_get_contents(__DIR__.'/../public/public-registration.php');
foreach(['api_pickup_code_lookup','api_assisted_pickup_lookup','api_complete_pickup_code'] as $name)loadPickupHandler($v,$name);
foreach(['public_pickup_ticket','public_checkin_request_status'] as $name)loadPickupHandler($p,$name);
foreach(['TPK-A-001',str_repeat('a',64),'TPK-PICKUP:'.str_repeat('a',64)] as $value){
 $_GET=['code'=>$value];$db=new PickupFixtureDB();try{api_pickup_code_lookup($db);throw new RuntimeException('Expired code returned children');}catch(PickupFailure $e){verifyPickup($e->apiCode==='PICKUP_CODE_EXPIRED'&&$e->status===410,'Lookup expiry response');}verifyPickup(count($db->queries)===2,'Expired lookup read child records');
}
foreach([fn($db)=>api_assisted_pickup_lookup($db),fn($db)=>api_complete_pickup_code($db,1),fn($db)=>public_pickup_ticket($db,str_repeat('a',64))] as $handler){$db=new PickupFixtureDB();try{$handler($db);throw new RuntimeException('Expired code accepted');}catch(PickupFailure $e){verifyPickup($e->apiCode==='PICKUP_CODE_EXPIRED'&&$e->status===410,'Assisted/completion/ticket expiry response');}verifyPickup(count($db->queries)===2,'Expired code reached child/write query');}
$db=new PickupFixtureDB();try{public_checkin_request_status($db,str_repeat('a',64));}catch(PickupReply $r){verifyPickup($r->data['pickupCodeExpired']&&$r->data['pickupCode']===null&&$r->data['pickupTicketUrl']===null&&!isset($r->data['qrToken']),'Expired request republishes code');}
$config=file_get_contents(__DIR__.'/../config.php');verifyPickup(str_contains($config,'base_convert((string)$serviceSessionId,10,36)'),'Display codes can be reused across Sundays');
verifyPickup(strpos($config,"tpk_sunday_pickup_state($".'service)')<strpos($config,"$".'existing = $' ."db->prepare('SELECT id,display_code"),'Existing code returned before validity check');
echo "PASS: $checks Sunday pickup expiry checks: midnight, timezone, DST, typed/QR/assisted/completion/public ticket/request and no expired writes.\n";
