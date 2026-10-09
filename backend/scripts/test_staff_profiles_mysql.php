<?php
declare(strict_types=1);
if(getenv('TPK_MYSQL_SMOKE')!=='1'){echo "Skipped: enable TPK_MYSQL_SMOKE.\n";exit;}
$root=getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__);require $root.'/config.php';require $root.'/public/people-privacy.php';
final class ProfileResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('Captured');}}
function api_actor(PDO $db):array{return $GLOBALS['actor'];}
function api_ok(array $data,int $status=200,?array $meta=null):never{throw new ProfileResponse(api_without_household_addresses($data));}
function api_error(string $code,string $message,int $status=400):never{throw new RuntimeException($code);}
function api_is_followup_lead(array $actor):bool{return in_array($actor['access_level'],['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN'],true);}
function captureProfile(callable $fn):array{try{$fn();}catch(ProfileResponse $r){return $r->data;}throw new RuntimeException('No response');}
$source=file_get_contents($argv[1]??$root.'/public/v1.php');
foreach(['api_team','api_followup_assignees'] as $name){if(!preg_match('/function '.$name.'\([^\n]*\{.*?\n\}/s',$source,$match))throw new RuntimeException('Missing handler');eval($match[0]);}
$db=db();$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();
try{
 $actor=$db->query("SELECT id,campus_id,access_level FROM staff_users WHERE access_level='TPK_SUPER_ADMIN' AND is_active=1 AND account_status='VERIFIED' LIMIT 1")->fetch();if(!$actor)throw new RuntimeException('No admin fixture');
 $expected=$db->prepare("SELECT id FROM staff_users WHERE campus_id=? AND access_level IN ('TPK_ADMIN','TPK_FOLLOW_UP_ADMIN') AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' ORDER BY id");$expected->execute([$actor['campus_id']]);$ids=array_map('intval',$expected->fetchAll(PDO::FETCH_COLUMN));$actual=array_map('intval',array_column(captureProfile(fn()=>api_followup_assignees($db)),'id'));sort($actual);if($actual!==$ids)throw new RuntimeException('Assignee list mismatch');
 $actor['access_level']='TPK_ADMIN';$_GET=[];$members=captureProfile(fn()=>api_team($db))['members'];$address=$db->prepare('SELECT residential_address FROM teacher_profiles WHERE staff_user_id=?');
 foreach($members as $member){$address->execute([$member['id']]);if(!array_key_exists('residentialAddress',$member)||$member['residentialAddress']!==$address->fetchColumn())throw new RuntimeException('Saved staff address missing or substituted');if(isset($member['birthDate'],$member['inactiveReason']))throw new RuntimeException('Unrelated private fields exposed');}
 echo 'PASS: read-only Oracle assignee eligibility and saved addresses for '.count($members)." teacher cards; no database writes.\n";
}finally{$db->rollBack();}
