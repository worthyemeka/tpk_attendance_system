<?php
declare(strict_types=1);

// Run the real registration handlers against a transaction-aware PDO substitute.
// No credentials, network calls or live database writes are involved.
require __DIR__.'/../registration-eligibility.php';
require __DIR__.'/../public/admin-registration.php';
class RegistrationResult extends RuntimeException {public function __construct(public array $data,public int $status){parent::__construct('API result');}}
class RegistrationError extends RuntimeException {public function __construct(public string $errorCode){parent::__construct($errorCode);}}
function api_actor(PDO $db,bool $super=false): array {if($super&&$GLOBALS['registrationRole']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super admin required',403);return ['id'=>9,'campus_id'=>1];}
function api_input(): array {return $GLOBALS['registrationInput'];}
function api_error(string $code,string $message,int $status=400): never {throw new RegistrationError($code);}
function api_ok(array $data,int $status=200): never {throw new RegistrationResult($data,$status);}
function api_phone(?string $value): ?string {$v=preg_replace('/\D+/','',(string)$value);if(str_starts_with($v,'234')&&strlen($v)===13)$v='0'.substr($v,3);return strlen($v)===11&&str_starts_with($v,'0')?$v:null;}
function api_audit(PDO $db,array $actor,string $event,string $entity,int $id,array $data): void {$db->audit=$data;}
class RegistrationStatement extends PDOStatement {
    private array $rows=[];
    public function __construct(private RegistrationDatabase $db,private string $sql){}
    public function execute(?array $params=null): bool {
        $this->db->executed[]=[$this->sql,$params];
        if(str_starts_with($this->sql,'INSERT INTO')){$this->db->lastId++;$this->db->writes[]=[$this->sql,$params];}
        $this->rows=match(true){
            str_contains($this->sql,'FROM classes')=>$this->db->noClass?[]:[['id'=>2]],
            str_contains($this->sql,'g.first_name AS firstName')=>[['guardianId'=>8,'familyId'=>7,'firstName'=>'Sample','lastName'=>'Guardian','familyName'=>'Household','phone'=>'+2348000000001','secondary_phone'=>null]],
            str_contains($this->sql,'SELECT g.id FROM guardians')=>$params[0]===8&&$params[1]===7?[['id'=>8]]:[],
            str_contains($this->sql,'SELECT g.phone')=>$this->db->knownPhone?[['phone'=>'08000000001','secondary_phone'=>null]]:[],
            str_contains($this->sql,'SELECT relationship')=>[['relationship'=>'Mother']],
            str_contains($this->sql,'FROM children')=>$this->db->duplicateName===$params[1]?[['id'=>55]]:[],
            str_contains($this->sql,'FROM campuses')=>[['id'=>1]],
            default=>[],
        };return true;
    }
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return $this->rows;}
    public function fetchColumn(int $column=0): mixed {return $this->rows?array_values($this->rows[0])[$column]:false;}
}
class RegistrationDatabase extends PDO {
    public array $executed=[],$writes=[],$audit=[];public int $lastId=100;public bool $noClass=false,$knownPhone=false,$committed=false,$rolledBack=false;public string $duplicateName='';private bool $transaction=false;
    public function __construct(){}
    public function prepare(string $query,array $options=[]): PDOStatement|false {return new RegistrationStatement($this,$query);}
    public function lastInsertId(?string $name=null): string|false {return (string)$this->lastId;}
    public function beginTransaction(): bool {$this->transaction=true;return true;}
    public function commit(): bool {$this->transaction=false;$this->committed=true;return true;}
    public function rollBack(): bool {$this->transaction=false;$this->rolledBack=true;$this->writes=[];return true;}
    public function inTransaction(): bool {return $this->transaction;}
}
function verifyRegistration(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
function registerFixture(array $input,?RegistrationDatabase $db=null): array {$GLOBALS['registrationInput']=$input;$db??=new RegistrationDatabase();try{api_register_children($db);}catch(RegistrationResult $result){verifyRegistration($result->status===201,'Created response');return [$db,$result->data];}throw new RuntimeException('Missing API result');}
function rejectsRegistration(array $input,string $code,?RegistrationDatabase $db=null): RegistrationDatabase {$GLOBALS['registrationInput']=$input;$db??=new RegistrationDatabase();try{api_register_children($db);}catch(RegistrationError $error){verifyRegistration($error->errorCode===$code,'Expected '.$code.', got '.$error->errorCode);return $db;}throw new RuntimeException('Invalid registration accepted');}
$GLOBALS['registrationRole']='TPK_SUPER_ADMIN';
$guardian=['firstName'=>'Sample','lastName'=>'Guardian','phone'=>'08000000001','relationship'=>'Mother','address'=>'Fixture address'];
$child=['firstName'=>'Maya','lastName'=>'Sample','dateOfBirth'=>'2019-04-12','gender'=>'FEMALE','careInformation'=>'Fixture care note'];
$new=['guardian'=>$guardian,'children'=>[$child,array_replace($child,['firstName'=>'Leo','gender'=>'MALE','careInformation'=>''])]];
[$db,$data]=registerFixture($new);
verifyRegistration($db->committed&&count($data['children'])===2&&$data['registrationOnly'],'New household and two children committed');
verifyRegistration($data['children'][0]['id']!==$data['children'][1]['id'],'Unique child IDs');
verifyRegistration(count(array_filter($db->writes,fn($q)=>str_starts_with($q[0],'INSERT INTO child_guardians')))===2,'Both children linked to guardian');
verifyRegistration($db->audit['registrationOnly']===true,'Registration audited');
foreach($db->executed as [$sql,$params])verifyRegistration(!preg_match('/attendance|service_sessions|check_in_requests|pickup_codes/i',$sql),'No arrival, service, ticket or pickup writes');
$existing=['familyId'=>7,'guardianId'=>8,'children'=>[$child]];
[$db,$data]=registerFixture($existing);
verifyRegistration($data['familyId']===7&&$db->committed,'Saved household linked');
foreach($db->writes as [$sql])verifyRegistration(!preg_match('/^(INSERT INTO|UPDATE) (families|guardians)\b/',$sql),'Existing guardian and family stay unchanged');
rejectsRegistration(array_replace($existing,['guardianId'=>999]),'FAMILY_NOT_AVAILABLE');
rejectsRegistration(['guardian'=>$guardian,'children'=>[array_replace($child,['dateOfBirth'=>date('Y-m-d')])]],'CHILD_TOO_YOUNG');
rejectsRegistration(['guardian'=>$guardian,'children'=>[array_replace($child,['dateOfBirth'=>'2999-01-01'])]],'VALIDATION_ERROR');
rejectsRegistration(['guardian'=>$guardian,'children'=>[array_replace($child,['gender'=>'UNKNOWN'])]],'VALIDATION_ERROR');
[$automatic,$placed]=registerFixture(['guardian'=>$guardian,'children'=>[array_replace($child,['classId'=>999])]]);verifyRegistration($placed['children'][0]['classId']===2,'Manual class ignored; birth date determines class');
$unmatched=new RegistrationDatabase();$unmatched->noClass=true;rejectsRegistration($new,'CLASS_NOT_AVAILABLE',$unmatched);verifyRegistration(!$unmatched->writes,'No matching active class does not create profiles');
rejectsRegistration(['guardian'=>$guardian,'children'=>[$child,$child]],'DUPLICATE_CHILD');
$duplicate=new RegistrationDatabase();$duplicate->duplicateName='Leo';$input=$existing;$input['children']=$new['children'];rejectsRegistration($input,'DUPLICATE_CHILD',$duplicate);verifyRegistration($duplicate->rolledBack&&!$duplicate->writes,'Later duplicate rolls back entire batch');
$known=new RegistrationDatabase();$known->knownPhone=true;rejectsRegistration($new,'REGISTERED_FAMILY_FOUND',$known);verifyRegistration(!$known->writes,'Known phone does not create duplicate household');
$GLOBALS['registrationRole']='TPK_ADMIN';$denied=rejectsRegistration($new,'FORBIDDEN');verifyRegistration(!$denied->executed,'Regular teacher denied before any database query');
$GLOBALS['registrationRole']='TPK_SUPER_ADMIN';$_GET=['phone'=>'08000000001'];try{api_registration_family_lookup(new RegistrationDatabase());}catch(RegistrationResult $result){verifyRegistration(count($result->data)===1&&!isset($result->data[0]['phone']),'Normalized service-independent lookup returns only identities');}
echo "PASS: super-admin access, new/existing households, age/class validation, atomic duplicate protection, saved profiles unchanged, and no check-in or pickup records.\n";
