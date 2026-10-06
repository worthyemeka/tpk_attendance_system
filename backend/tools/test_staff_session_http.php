<?php
declare(strict_types=1);
require dirname(__DIR__) . '/config.php';
$pdo=db();$options=getopt('',['base:']);$base=rtrim($options['base']??'https://tpk-checkin.vercel.app','/');
if(!filter_var($base,FILTER_VALIDATE_URL))throw new RuntimeException('Valid API base required.');
$staffId=(int)$pdo->query("SELECT s.id FROM staff_users s JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.is_active=1 AND s.account_status='VERIFIED' AND s.team_status<>'INACTIVE' ORDER BY s.id LIMIT 1")->fetchColumn();
if(!$staffId)throw new RuntimeException('No active fixture staff available.');
$token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);
$pdo->prepare('INSERT INTO staff_sessions(staff_user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))')->execute([$staffId,$hash]);
function request_session(string $base,string $path,string $method,string $token,int $expected):array {
    $context=stream_context_create(['http'=>['method'=>$method,'header'=>"Authorization: Bearer $token\r\nContent-Length: 0\r\n",'ignore_errors'=>true,'timeout'=>20]]);
    $raw=file_get_contents($base.$path,false,$context);$status=0;
    foreach($http_response_header??[] as $header)if(preg_match('/^HTTP\/\S+ (\d+)/',$header,$match))$status=(int)$match[1];
    if($status!==$expected)throw new RuntimeException("$method $path expected $expected, received $status.");
    $data=json_decode($raw?:'',true);if(!is_array($data))throw new RuntimeException('Non-JSON session response.');
    return $data;
}
try {
    $read=request_session($base,'/api/teachers/session','GET',$token,200);
    if((int)($read['teacher']['staffUserId']??0)!==$staffId)throw new RuntimeException('Session identity mismatch.');
    $again=request_session($base,'/api/teachers/session','GET',$token,200);
    if($read['expiresAtMs']!==$again['expiresAtMs'])throw new RuntimeException('Validation renewed the session.');
    $active=request_session($base,'/api/teachers/session','POST',$token,200);
    if($active['expiresAtMs']-$active['serverTimeMs']!==48*60*60*1000)throw new RuntimeException('Incorrect idle duration.');
    $pdo->prepare('UPDATE staff_sessions SET expires_at=NOW() WHERE token_hash=?')->execute([$hash]);
    request_session($base,'/api/teachers/session','GET',$token,401);
    request_session($base,'/api/teachers/session','POST',$token,401);
    request_session($base,'/api/v1/me/profile','GET',$token,401);
    $pdo->prepare('UPDATE staff_sessions SET expires_at=DATE_ADD(NOW(),INTERVAL 48 HOUR),revoked_at=NOW() WHERE token_hash=?')->execute([$hash]);
    request_session($base,'/api/teachers/session','POST',$token,401);
    $pdo->prepare('UPDATE staff_sessions SET revoked_at=NULL WHERE token_hash=?')->execute([$hash]);
    request_session($base,'/api/teachers/logout','POST',$token,200);
    request_session($base,'/api/teachers/session','GET',$token,401);
    echo "PASS: live proxy session validation, 48-hour renewal, expired API access, no revival and logout.\n";
} finally {
    $pdo->prepare('DELETE FROM staff_sessions WHERE token_hash=?')->execute([$hash]);
    echo "Temporary verification session removed; staff account unchanged.\n";
}
