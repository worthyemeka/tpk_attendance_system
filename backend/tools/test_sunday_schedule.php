<?php
declare(strict_types=1);
// CLI integration test. Creates and removes an isolated, randomly named database.
// Run using a MySQL account with CREATE/DROP DATABASE privileges.
if (PHP_SAPI !== 'cli') exit(1);
require_once dirname(__DIR__).'/config.php';

function api_method(): string { return $GLOBALS['testMethod']; }
function api_input(): array { return $GLOBALS['testPayload']; }
function api_actor(PDO $db,bool $super=false): array {
    if($super && getenv('TPK_TEST_ROLE')==='teacher') api_error('FORBIDDEN','Super Admin required.',403);
    return ['id'=>1,'campus_id'=>(int)getenv('TPK_TEST_CAMPUS'),'access_level'=>'TPK_SUPER_ADMIN'];
}
function api_table_exists(PDO $db,string $table): bool {
    $s=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$s->execute([$table]);return (bool)$s->fetchColumn();
}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $metadata=[]): void {}
function api_error(string $code,string $message,int $status=400): never { echo json_encode(['success'=>false,'code'=>$code]);exit; }
function api_ok(array $data,int $status=200): never { echo json_encode(['success'=>true,'data'=>$data]);exit; }

if(($argv[1]??'')==='--request') {
    if(!preg_match('/^tpk_schedule_test_[a-f0-9]{12}$/',(string)getenv('DB_NAME')))throw new RuntimeException('Test database required.');
    $GLOBALS['testMethod']=$argv[2];$GLOBALS['testPayload']=json_decode($argv[3],true);$_GET=$GLOBALS['testPayload'];
    require dirname(__DIR__).'/public/sunday-schedule.php';api_sunday_schedule(db());
}

$db=db();$source=(string)$db->query('SELECT DATABASE()')->fetchColumn();$test='tpk_schedule_test_'.bin2hex(random_bytes(6));
$db->exec("CREATE DATABASE `{$test}`");
try {
    foreach(['campuses','service_sessions'] as $table)$db->exec("CREATE TABLE `{$test}`.`{$table}` LIKE `{$source}`.`{$table}`");
    $db->exec("INSERT INTO `{$test}`.campuses SELECT * FROM `{$source}`.campuses ORDER BY id LIMIT 1");
    $db->exec("USE `{$test}`");$campus=(int)$db->query('SELECT id FROM campuses LIMIT 1')->fetchColumn();
    putenv('DB_NAME='.$test);putenv('TPK_TEST_CAMPUS='.$campus);
    $env=getenv();
    $run=static function(array $args,array $env): string {
        $pipes=[];$p=proc_open(array_merge([PHP_BINARY],$args),[1=>['pipe','w'],2=>['pipe','w']],$pipes,null,$env);
        $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
        if(proc_close($p)!==0)throw new RuntimeException('Test subprocess failed: '.$err);return $out;
    };
    $run([__DIR__.'/reconcile_sunday_schedule.php'],$env);
    $request=static function(string $method,array $payload,string $role='super')use($run,$env): array {
        $e=$env;$e['TPK_TEST_ROLE']=$role;return json_decode($run([__FILE__,'--request',$method,json_encode($payload)],$e),true);
    };
    $check=static function(bool $ok,string $name): void {if(!$ok)throw new RuntimeException('FAILED: '.$name);echo 'PASS: '.$name."\n";};
    $plan=['serviceDate'=>'2026-10-11','theme'=>'Thanksgiving','sessions'=>[['startTime'=>'09:00','endTime'=>'12:00']]];
    $check($request('PUT',$plan)['success'],'save single themed service');
    $single=$request('GET',['serviceDate'=>$plan['serviceDate']])['data']['sessions'];$id=(int)$single[0]['id'];
    $check(count($single)===1 && $single[0]['name']==='Thanksgiving','single-service theme and real ID');
    $check(count(tpk_ensure_sunday_sessions($db,$campus,new DateTimeImmutable($plan['serviceDate'])))===1,'default preparer does not recreate Second Service');
    $plan['sessions'][0]['id']=$id;$plan['sessions'][0]['startTime']='09:30';
    $check($request('PUT',$plan)['success'],'edit existing service time');
    $check((int)$request('GET',['serviceDate'=>$plan['serviceDate']])['data']['sessions'][0]['id']===$id,'existing ID preserved');
    $plan['sessions'][]=['startTime'=>'13:00','endTime'=>'14:00'];$plan['sessions'][]=['startTime'=>'15:00','endTime'=>'16:00'];
    $check($request('PUT',$plan)['success'],'configure three services');
    $three=$request('GET',['serviceDate'=>$plan['serviceDate']])['data']['sessions'];
    $check(count($three)===3 && $three[2]['serviceType']==='SERVICE_3','third service has a stable configured type');
    $db->exec('CREATE TABLE test_attendance(service_session_id INT NOT NULL)');$db->prepare('INSERT INTO test_attendance VALUES(?)')->execute([$three[2]['id']]);
    $plan['sessions']=[$plan['sessions'][0]];
    $check(($request('PUT',$plan)['code']??'')==='SERVICE_HAS_RECORDS','cannot delete a service with operational records');
    $plan['sessions'][0]['endTime']='08:00';
    $check(($request('PUT',$plan)['code']??'')==='VALIDATION_ERROR','invalid time rejected');
    $check(($request('PUT',$plan,'teacher')['code']??'')==='FORBIDDEN','schedule requires Super Admin');
    $check(($request('GET',['serviceDate'=>'2026-10-12'])['code']??'')==='VALIDATION_ERROR','non-Sunday rejected');
    $run([__DIR__.'/reconcile_sunday_schedule.php'],$env);
    $check(count($request('GET',['serviceDate'=>'2026-10-11'])['data']['sessions'])===3,'reconciliation is idempotent');
} finally {
    $db->exec("USE `{$source}`");$db->exec("DROP DATABASE `{$test}`");
}
