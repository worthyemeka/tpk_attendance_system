<?php
declare(strict_types=1);
// Read-only query regression checks. No follow-up synchronization or fixture writes.
if(PHP_SAPI!=='cli')exit;
require dirname(__DIR__).'/config.php';
final class FollowupResult extends RuntimeException { public function __construct(public mixed $data,public ?array $meta=null){parent::__construct('Captured response');} }
function api_actor(PDO $db):array{return $GLOBALS['testActor'];}
function api_is_followup_lead(array $actor):bool{return in_array($actor['access_level'],['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN'],true);}
function api_followup_sync_cases(PDO $db,int $campus):void{}
function api_page():array{$page=max(1,(int)($_GET['page']??1));$limit=min(100,max(1,(int)($_GET['limit']??25)));return [$page,$limit,($page-1)*$limit];}
function api_ok(mixed $data,int $status=200,?array $meta=null):never{throw new FollowupResult($data,$meta);}
function api_error(string $code,string $message,int $status=400):never{throw new RuntimeException($code.': '.$message);}
function response(callable $run):FollowupResult{try{$run();}catch(FollowupResult $r){return $r;}throw new RuntimeException('Missing response');}
function check(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);echo "PASS: $message\n";}
$source=file_get_contents(dirname(__DIR__).'/public/v1.php');$start=strpos($source,'function api_followup_visible_condition');$end=strpos($source,'function api_followup(PDO',$start);
if($start===false||$end===false)throw new RuntimeException('Follow-up implementation not found');eval(substr($source,$start,$end-$start));
$pdo=db();$campus=(int)$pdo->query('SELECT id FROM campuses ORDER BY id LIMIT 1')->fetchColumn();
$GLOBALS['testActor']=['id'=>99999999,'campus_id'=>$campus,'access_level'=>'TPK_SUPER_ADMIN'];
$_GET=['tab'=>'needs','page'=>1,'limit'=>10];$first=response(fn()=>api_followups($pdo));$summary=response(fn()=>api_followup_summary($pdo));
check((int)$summary->data['needFollowUp']===(int)$first->meta['total'],'Pending family count matches directory total');
check(count($first->data)<=10,'Page size enforced');
check((int)$summary->data['childrenAcrossNeedFollowUp']===(int)$first->meta['childrenTotal'],'Child count matches filtered family scope');
$allIds=[];$total=(int)$first->meta['total'];for($page=1;$page<=max(1,(int)ceil($total/10));$page++){$_GET=['tab'=>'needs','page'=>$page,'limit'=>10];$r=response(fn()=>api_followups($pdo));foreach($r->data as $row){check((int)$row['childrenCount']>0,'Returned family has linked children');$allIds[]=(int)$row['id'];}}
check(count(array_unique($allIds))===$total&&count($allIds)===$total,'Every family appears exactly once across pages');
foreach([['year'=>'2026'],['month'=>'10'],['year'=>'2026','month'=>'10'],['ownerId'=>'unassigned'],['status'=>'COULDNT_REACH']] as $filter){$_GET=array_merge(['tab'=>'needs','limit'=>100],$filter);$r=response(fn()=>api_followups($pdo));check(count($r->data)===(int)$r->meta['total'],'Independent filter count matches visible rows');}
$GLOBALS['testActor']['access_level']='TPK_TEACHER';$_GET=['tab'=>'needs','limit'=>100,'ownerId'=>'unassigned'];$r=response(fn()=>api_followups($pdo));check(count($r->data)===0,'Teacher cannot broaden access through assignment filter');
echo "Read-only follow-up checks complete.\n";
