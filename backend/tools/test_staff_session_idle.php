<?php
declare(strict_types=1);
require dirname(__DIR__) . '/config.php';
require dirname(__DIR__) . '/public/staff-session.php';
$pdo=db();
$staffId=(int)$pdo->query("SELECT s.id FROM staff_users s JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.is_active=1 AND s.account_status='VERIFIED' AND s.team_status<>'INACTIVE' ORDER BY s.id LIMIT 1")->fetchColumn();
if(!$staffId)throw new RuntimeException('No active staff fixture available.');
$pdo->beginTransaction();
try {
    $token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);
    $pdo->prepare('INSERT INTO staff_sessions(staff_user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))')->execute([$staffId,$hash]);
    $read=tpk_staff_session($pdo,$token);if(!$read)throw new RuntimeException('Valid session was rejected.');
    $readAgain=tpk_staff_session($pdo,$token);if($read['expiresAtMs']!==$readAgain['expiresAtMs'])throw new RuntimeException('Read renewed the idle deadline.');
    $active=tpk_staff_session($pdo,$token,true);$duration=(int)$active['expiresAtMs']-(int)$active['serverTimeMs'];
    if($duration!==48*60*60*1000)throw new RuntimeException('Activity did not set a 48-hour deadline.');
    $pdo->prepare('UPDATE staff_sessions SET expires_at=NOW() WHERE token_hash=?')->execute([$hash]);
    if(tpk_staff_session($pdo,$token)!==null||tpk_staff_session($pdo,$token,true)!==null)throw new RuntimeException('Expired token was revived.');
    $pdo->prepare('UPDATE staff_sessions SET expires_at=DATE_ADD(NOW(),INTERVAL 48 HOUR),revoked_at=NOW() WHERE token_hash=?')->execute([$hash]);
    if(tpk_staff_session($pdo,$token)!==null||tpk_staff_session($pdo,$token,true)!==null)throw new RuntimeException('Revoked token was revived.');
    if(tpk_staff_session($pdo,'not-a-token',true)!==null)throw new RuntimeException('Invalid token was accepted.');
    echo "PASS: valid read, no polling renewal, 48-hour activity, exact expiry, revoked token, malformed token. Fixture rolled back.\n";
}finally{if($pdo->inTransaction())$pdo->rollBack();}
