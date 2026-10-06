<?php
declare(strict_types=1);
require dirname(__DIR__).'/config.php';
require dirname(__DIR__).'/roster-class-slots.php';
$pdo=db();$tokens=[];$base=getenv('TPK_TEST_BASE_URL')?:'https://tpk-checkin.vercel.app';
function visibility_request(string $base,string $route,string $token): array {
    $context=stream_context_create(['http'=>['header'=>"Authorization: Bearer $token\r\n",'ignore_errors'=>true,'timeout'=>20]]);
    $raw=file_get_contents($base.$route,false,$context);$body=json_decode($raw?:'',true);
    if(!is_array($body)||!($body['success']??false))throw new RuntimeException('Read failed for '.$route);
    return $body['data'];
}
function visibility_contains(array $classes,int $id,string $context): void {
    if(!in_array($id,array_map('intval',array_column($classes,'id')),true))throw new RuntimeException('Configured Teens class missing from '.$context);
}
try {
    $rows=$pdo->query("SELECT id,access_level,campus_id FROM staff_users WHERE is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' AND access_level IN ('TPK_SUPER_ADMIN','TPK_ADMIN') ORDER BY id")->fetchAll();
    $users=[];foreach($rows as $row)if(!isset($users[$row['access_level']]))$users[$row['access_level']]=$row;
    if(count($users)!==2)throw new RuntimeException('Both teacher and Super Admin roles are needed for this smoke test.');
    foreach($users as $role=>$user){
        $q=$pdo->prepare("SELECT id FROM classes WHERE campus_id=? AND name='TribePetra Teens' AND is_active=1");$q->execute([$user['campus_id']]);$teens=(int)$q->fetchColumn();
        if(!$teens)throw new RuntimeException('No active Teens class for test campus.');
        $token=bin2hex(random_bytes(32));$tokens[]=$token;
        $pdo->prepare('INSERT INTO staff_sessions(staff_user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))')->execute([$user['id'],hash('sha256',$token)]);
        $classes=visibility_request($base,'/api/v1/classes',$token);visibility_contains($classes,$teens,'class choices');
        $sessions=$pdo->prepare("SELECT id,service_date,service_type FROM service_sessions WHERE campus_id=? AND service_type IS NOT NULL AND service_date IN ('2026-10-04','2026-10-11') ORDER BY service_date,starts_at");$sessions->execute([$user['campus_id']]);$services=$sessions->fetchAll();
        if(!$services)throw new RuntimeException('Expected October services for this smoke test.');
        foreach($services as $service){
            $data=visibility_request($base,'/api/v1/classrooms?serviceSessionId='.$service['id'],$token);visibility_contains($data['items'],$teens,'classrooms '.$service['service_date'].' '.$service['service_type']);
            $filtered=visibility_request($base,'/api/v1/classrooms?serviceSessionId='.$service['id'].'&classId='.$teens,$token);visibility_contains($filtered['items'],$teens,'filtered classroom');
            if(count($filtered['items'])!==1)throw new RuntimeException('Class filter mixed classrooms.');
            $detail=visibility_request($base,'/api/v1/classrooms/'.$teens.'?serviceSessionId='.$service['id'],$token);
            if((int)$detail['class']['id']!==$teens)throw new RuntimeException('Teens details could not be opened.');
        }
        $roster=visibility_request($base,'/api/v1/roster/management?month=10&year=2026',$token);visibility_contains($roster['classes'],$teens,'roster class choices');
        $teensClass=array_values(array_filter($roster['classes'],fn($row)=>(int)$row['id']===$teens))[0];
        if(empty($teensClass['ageLabel']))throw new RuntimeException('Roster class age label missing.');
        if((int)$roster['summary']['unfilled']!==tpk_roster_unfilled_slots($roster['classes'],$roster['sundays'],$roster['assignments']))throw new RuntimeException('Roster unfilled summary excludes configured classes.');
        $curriculum=visibility_request($base,'/api/v1/curriculum?month=2026-10',$token);visibility_contains($curriculum['classes'],$teens,'curriculum');
        echo "PASS: $role sees Teens in class choices, classroom overview/filter/details, roster configuration/totals and curriculum.\n";
    }
}finally{
    foreach($tokens as $token)$pdo->prepare('DELETE FROM staff_sessions WHERE token_hash=?')->execute([hash('sha256',$token)]);
    echo "Temporary test sessions removed. No class, child or roster records changed.\n";
}
