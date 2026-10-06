<?php
declare(strict_types=1);
// Isolated fixtures only. This test never connects to a real database.
require __DIR__.'/../public/classroom-interactions.php';
require __DIR__.'/../public/assembly-context.php';
class AssemblyResult extends RuntimeException {public function __construct(public array $data){parent::__construct('Response');}}
class AssemblyError extends RuntimeException {public function __construct(public string $apiCode,public int $status){parent::__construct($apiCode);}}
$actor=['id'=>7,'campus_id'=>1,'access_level'=>'TPK_TEACHER'];$input=[];$ready=true;
function api_actor(PDO $db): array {return $GLOBALS['actor'];}
function api_input(): array {return $GLOBALS['input'];}
function api_ok(array $data,int $status=200): never {throw new AssemblyResult($data);}
function api_error(string $code,string $message,int $status=400): never {throw new AssemblyError($code,$status);}
function api_audit(PDO $db,array $actor,string $event,string $entity,int $id,array $meta=[]): void {}
function api_table_exists(PDO $db,string $table): bool {return $GLOBALS['ready'];}
function api_classroom_context_sessions(PDO $db,array $actor): array {return [['id'=>99]];}
class AssemblyFixtureStatement extends PDOStatement {
    private array $rows=[];
    public function __construct(private AssemblyFixtureDatabase $db,private string $sql){}
    public function execute(?array $params=null): bool {$this->rows=$this->db->run($this->sql,$params??[]);return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0): mixed {return $this->rows[0]??false;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return $this->rows;}
    public function fetchColumn(int $column=0): mixed {return isset($this->rows[0])?array_values($this->rows[0])[$column]:false;}
}
class AssemblyFixtureDatabase extends PDO {
    public array $reactions=[],$activityReactions=[];
    public array $queries=[];
    public array $sessions=[
        1=>['id'=>1,'campus_id'=>1,'service_date'=>'2026-10-04','service_type'=>'FIRST_SERVICE'],
        2=>['id'=>2,'campus_id'=>1,'service_date'=>'2026-10-11','service_type'=>'SECOND_SERVICE'],
        3=>['id'=>3,'campus_id'=>2,'service_date'=>'2026-10-04','service_type'=>'FIRST_SERVICE'],
        4=>['id'=>4,'campus_id'=>1,'service_date'=>'2026-11-01','service_type'=>'FIRST_SERVICE'],
    ];
    public function __construct(){}
    public function lastInsertId(?string $name=null): string|false {return '100';}
    public function prepare(string $query,array $options=[]): PDOStatement|false {return new AssemblyFixtureStatement($this,$query);}
    public function run(string $sql,array $p): array {
        $this->queries[]=[$sql,$p];
        if(str_contains($sql,'service_date AS serviceDate'))return array_map(fn($s)=>['id'=>$s['id'],'serviceDate'=>$s['service_date']],array_values(array_filter($this->sessions,fn($s)=>$s['campus_id']===$p[0]&&$s['service_date']>=$p[1]&&$s['service_date']<$p[2])));
        if(str_contains($sql,'FROM service_sessions')){$s=$this->sessions[$p[0]]??null;return $s&&$s['campus_id']===$p[1]?[$s]:[];}
        if(str_contains($sql,'FROM roster_assignments'))return ($p[0]===7&&$p[2]===1)?[[1]]:[];
        if(str_contains($sql,'FROM assembly_activities'))return $p[0]===20&&$p[1]===1?[['id'=>20]]:[];
        if(str_starts_with($sql,'INSERT INTO assembly_activity_reactions')){$this->activityReactions[$p[0]][$p[1]]=$p[2];return [];}
        if(str_starts_with($sql,'DELETE FROM assembly_activity_reactions')){unset($this->activityReactions[$p[0]][$p[1]]);return [];}
        if(str_contains($sql,'GROUP BY reaction')&&str_contains($sql,'assembly_activity_reactions'))return array_map(fn($reaction,$total)=>compact('reaction','total'),array_keys(array_count_values($this->activityReactions[$p[0]]??[])),array_values(array_count_values($this->activityReactions[$p[0]]??[])));
        if(str_contains($sql,'FROM assembly_activity_reactions'))return isset($this->activityReactions[$p[0]][$p[1]])?[['reaction'=>$this->activityReactions[$p[0]][$p[1]]]]:[];
        if(str_contains($sql,'FROM assembly_notes'))return $p[0]===10&&$p[1]===1?[['id'=>10,'service_session_id'=>1]]:[];
        if(str_starts_with($sql,'INSERT INTO assembly_notes'))return [];
        if(str_starts_with($sql,'INSERT INTO assembly_note_reactions')){$this->reactions[$p[0]][$p[1]]=$p[2];return [];}
        if(str_starts_with($sql,'DELETE FROM assembly_note_reactions')){unset($this->reactions[$p[0]][$p[1]]);return [];}
        if(str_contains($sql,'GROUP BY reaction'))return array_map(fn($reaction,$total)=>compact('reaction','total'),array_keys(array_count_values($this->reactions[$p[0]]??[])),array_values(array_count_values($this->reactions[$p[0]]??[])));
        if(str_contains($sql,'FROM assembly_note_reactions'))return isset($this->reactions[$p[0]][$p[1]])?[['reaction'=>$this->reactions[$p[0]][$p[1]]]]:[];
        throw new RuntimeException('Unexpected query: '.$sql);
    }
}
$checks=0;
function checkAssembly(bool $test,string $message): void {if(!$test)throw new RuntimeException($message);$GLOBALS['checks']++;}
function expectAssemblyError(callable $call,int $status): void {try{$call();throw new RuntimeException('Expected rejection');}catch(AssemblyError $e){checkAssembly($e->status===$status,'Wrong rejection status');}}
function reactAssembly(AssemblyFixtureDatabase $db,?string $reaction): array {$GLOBALS['input']=['reaction'=>$reaction];try{api_assembly_note_reaction($db,10,true);}catch(AssemblyResult $result){return $result->data;}}
$db=new AssemblyFixtureDatabase();
checkAssembly(api_assembly_reaction_payload($db,$actor,10)['reactions']['LIKE']===0,'A new note has no reactions.');
checkAssembly(reactAssembly($db,'APPLAUSE')['myReaction']==='APPLAUSE','Well done saves the actor reaction.');
checkAssembly(reactAssembly($db,'APPLAUSE')['reactions']['APPLAUSE']===1,'Retries do not duplicate a reaction.');
$switched=reactAssembly($db,'HEART');
checkAssembly($switched['reactions']['APPLAUSE']===0&&$switched['reactions']['HEART']===1,'Changing reactions replaces the previous choice.');
checkAssembly(reactAssembly($db,null)['myReaction']===null,'Clicking the chosen reaction removes it.');
$db->reactions[10][8]='LIKE';reactAssembly($db,'LIKE');
checkAssembly(reactAssembly($db,null)['reactions']['LIKE']===1,'Removing one reaction preserves another teacher reaction.');
expectAssemblyError(fn()=>reactAssembly($db,'UNSUPPORTED'),422);
expectAssemblyError(fn()=>api_assembly_reaction_payload($db,$actor,999),404);
expectAssemblyError(fn()=>api_assembly_reaction_payload($db,['id'=>7,'campus_id'=>2,'access_level'=>'TPK_SUPER_ADMIN'],10),404);
checkAssembly(api_assembly_reaction_payload($db,['id'=>8,'campus_id'=>1,'access_level'=>'TPK_ADMIN'],10)['canInteract'],'Off-duty campus teacher can react.');
$ready=false;
checkAssembly(!api_assembly_reaction_payload($db,$actor,10)['canInteract'],'Missing migration disables reactions safely.');
expectAssemblyError(fn()=>reactAssembly($db,'LIKE'),503);$ready=true;
$_GET=['month'=>'2026-10'];
checkAssembly(array_column(api_assembly_sessions($db,$actor),'id')===[1,2],'Teachers see all campus services in the selected month.');
$super=['id'=>9,'campus_id'=>1,'access_level'=>'TPK_SUPER_ADMIN'];
checkAssembly(array_column(api_assembly_sessions($db,$super),'id')===[1,2],'Super admins see the selected month and campus only.');
$_GET=['month'=>'2026-09'];checkAssembly(api_assembly_sessions($db,$super)===[],'Empty months remain empty.');
foreach(['2026-13','2026-00','2026-10 OR 1=1'] as $month){$_GET=['month'=>$month];expectAssemblyError(fn()=>api_assembly_sessions($db,$super),422);}
$_GET=[];checkAssembly(api_assembly_sessions($db,$actor)===[['id'=>99]],'Existing selected-service requests are unchanged.');
function reactVideo(AssemblyFixtureDatabase $db,?string $reaction): array {$GLOBALS['input']=['reaction'=>$reaction];try{api_assembly_activity_reaction($db,20,true);}catch(AssemblyResult $r){return $r->data;}}
$actor=['id'=>8,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];
checkAssembly(reactVideo($db,'APPLAUSE')['myReaction']==='APPLAUSE','Off-duty staff reacts to assembly video');
checkAssembly(reactVideo($db,'APPLAUSE')['reactions']['APPLAUSE']===1,'Video reaction retries remain idempotent');
checkAssembly(reactVideo($db,null)['reactions']['APPLAUSE']===0,'Video reaction removal');
expectAssemblyError(fn()=>reactVideo($db,'UNSUPPORTED'),422);
expectAssemblyError(fn()=>api_assembly_activity_reaction($db,999),404);
$actor['campus_id']=2;expectAssemblyError(fn()=>api_assembly_activity_reaction($db,20),404);
$actor=['id'=>7,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];$input=['serviceSessionId'=>1,'note'=>'A sample reflection.'];try{api_assembly_note($db);}catch(AssemblyResult $r){checkAssembly($r->data['id']===100,'Authorised service leader can still add notes');}
$actor['id']=8;expectAssemblyError(fn()=>api_assembly_note($db),403);
$actor['access_level']='TPK_SUPER_ADMIN';try{api_assembly_note($db);}catch(AssemblyResult $r){checkAssembly($r->data['id']===100,'Super Admin can add notes');}
$input['serviceSessionId']=3;expectAssemblyError(fn()=>api_assembly_note($db),404);
$actor['campus_id']=1;$ready=false;expectAssemblyError(fn()=>reactVideo($db,'LIKE'),503);
echo "Assembly history and reaction checks passed ($checks cases).\n";
