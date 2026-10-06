<?php
declare(strict_types=1);

// Exercise the real endpoint functions with an in-memory PDO substitute only.
// No database connection, credentials, or production records are used.
require __DIR__.'/../registration-eligibility.php';
$source=file_get_contents(__DIR__.'/../public/v1.php');
foreach(['api_assisted_family_lookup','api_assisted_checkin'] as $name){
    if(!preg_match('/function '.preg_quote($name,'/').'\(PDO \$db\): never \{.*?\n\}(?=\nfunction)/s',$source,$match))throw new RuntimeException('Endpoint not found: '.$name);
    eval($match[0]);
}
class CheckinResult extends RuntimeException {public function __construct(public array $data,public int $status){parent::__construct('API result');}}
class CheckinError extends RuntimeException {public function __construct(public string $errorCode){parent::__construct($errorCode);}}
function api_actor(PDO $db): array {return ['id'=>9,'campus_id'=>1];}
function api_input(): array {return $GLOBALS['checkinInput'];}
function api_can_assisted_checkin(PDO $db,array $actor,int $sessionId): bool {return $sessionId===2;}
function api_error(string $code,string $message,int $status=400): never {throw new CheckinError($code);}
function api_ok(array $data,int $status=200): never {throw new CheckinResult($data,$status);}
function api_phone(?string $value): ?string {$v=preg_replace('/\D+/','',(string)$value);if(str_starts_with($v,'234')&&strlen($v)===13)$v='0'.substr($v,3);return strlen($v)===11&&str_starts_with($v,'0')?$v:null;}
function api_audit(PDO $db,array $actor,string $event,string $entity,int $id,array $data): void {}
function tpk_issue_pickup_code(PDO $db,int $sessionId,int $familyId,int $guardianId): array {return ['id'=>1,'code'=>'TPK-SAMPLE','ticketUrl'=>'/sample-ticket'];}
class SavedProfileStatement extends PDOStatement {
    private array $rows=[];
    public function __construct(private SavedProfileDatabase $db,private string $sql){}
    public function execute(?array $params=null): bool {
        $this->db->executed[]=[$this->sql,$params];
        $this->rows=match(true){
            str_contains($this->sql,'FROM service_sessions')=>[['id'=>2,'campus_id'=>1]],
            str_contains($this->sql,'g.first_name AS firstName')=>[['id'=>1,'guardianId'=>1,'family_id'=>1,'familyId'=>1,'firstName'=>'Grace','lastName'=>'Bennett','phone'=>'08000000001','secondaryPhone'=>null,'email'=>'','relationship'=>'Mother','address'=>'','familyName'=>'Bennett']],
            str_contains($this->sql,'first_name AS firstName')=>($params[0]===1?[['id'=>1,'firstName'=>'Maya','lastName'=>'Bennett','dateOfBirth'=>'2020-04-12','gender'=>'FEMALE','classId'=>2]]:[]),
            str_contains($this->sql,'FOR UPDATE')=>[['id'=>1,'class_id'=>3,'is_first_visit'=>0]],
            str_contains($this->sql,'FROM classes')=>[['id'=>2]],
            str_contains($this->sql,'FROM guardians')=>[['id'=>1,'family_id'=>1,'phone'=>'08000000001','secondary_phone'=>null]],
            default=>[],
        };return true;
    }
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0): mixed {return $this->rows[0]??false;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return $this->rows;}
    public function fetchColumn(int $column=0): mixed {return $this->rows?array_values($this->rows[0])[$column]:false;}
}
class SavedProfileDatabase extends PDO {
    public array $executed=[];private bool $transaction=false;
    public function __construct(){}
    public function prepare(string $query,array $options=[]): PDOStatement|false {return new SavedProfileStatement($this,$query);}
    public function beginTransaction(): bool {$this->transaction=true;return true;}
    public function commit(): bool {$this->transaction=false;return true;}
    public function rollBack(): bool {$this->transaction=false;return true;}
    public function inTransaction(): bool {return $this->transaction;}
}
function checkSaved(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$GLOBALS['checkinInput']=['serviceSessionId'=>2,'registeredFamilyId'=>1,'registeredGuardianId'=>1,'guardian'=>['firstName'=>'Do not overwrite'],'children'=>[['id'=>1,'gender'=>'MALE','classId'=>999]],'pickup'=>['mode'=>'SELF']];
$db=new SavedProfileDatabase();
try{api_assisted_checkin($db);}catch(CheckinResult $result){checkSaved($result->status===201,'Arrival saved');checkSaved($result->data['children'][0]['firstName']==='Maya','Use saved name, not supplied edits');}
$arrival=null;foreach($db->executed as [$query,$params]){checkSaved(!preg_match('/^(UPDATE|INSERT INTO) (guardians|families|children|child_care_profiles)\b/',$query),'Returning arrivals must not write profiles');if(str_starts_with($query,'INSERT INTO attendance'))$arrival=$params;}
checkSaved($arrival!==null&&$arrival[1]===1&&$arrival[2]===3,'Use selected child and its current saved class under lock');
foreach([[['id'=>1],['id'=>1]],[['id'=>99]]] as $children){$GLOBALS['checkinInput']['children']=$children;try{api_assisted_checkin(new SavedProfileDatabase());throw new RuntimeException('Invalid selection accepted');}catch(CheckinError $error){checkSaved(in_array($error->errorCode,['VALIDATION_ERROR','CHILD_NOT_AVAILABLE'],true),'Reject duplicate or unrelated children');}}
$_GET=['phone'=>'+2348000000001','serviceSessionId'=>2];try{api_assisted_family_lookup(new SavedProfileDatabase());}catch(CheckinResult $result){checkSaved(count($result->data)===1,'International phone resolves saved household');checkSaved(!isset($result->data[0]['phone']),'Lookup returns identities, not unnecessary contact data');}
$GLOBALS['checkinInput']=['serviceSessionId'=>2,'guardian'=>['firstName'=>'Grace','lastName'=>'Bennett','phone'=>'08000000001','relationship'=>'Mother','address'=>'Sample address'],'children'=>[['firstName'=>'Maya','lastName'=>'Bennett','dateOfBirth'=>'2020-04-12','gender'=>'FEMALE','classId'=>2]]];
try{api_assisted_checkin(new SavedProfileDatabase());throw new RuntimeException('Known family silently edited');}catch(CheckinError $error){checkSaved($error->errorCode==='REGISTERED_FAMILY_FOUND','Existing phone must use saved-record check-in, even if the browser lookup was bypassed');}
$_GET['serviceSessionId']=99;try{api_assisted_family_lookup(new SavedProfileDatabase());throw new RuntimeException('Unauthorised lookup accepted');}catch(CheckinError $error){checkSaved($error->errorCode==='FORBIDDEN','Phone lookup requires desk permission');}
echo "PASS: returning-family identity, unchanged profiles, locked saved class, child selection, phone normalization and lookup privacy.\n";
