<?php
declare(strict_types=1);
require dirname(__DIR__) . '/config.php';
// Existing valid twelve-hour sessions get the new policy, without reviving
// expired/revoked sessions or extending sessions already issued for 48 hours.
$pdo=db();$pdo->beginTransaction();
try {
    $rows=$pdo->query('SELECT * FROM staff_sessions WHERE revoked_at IS NULL AND expires_at>NOW() AND TIMESTAMPDIFF(SECOND,created_at,expires_at) BETWEEN 43190 AND 43210 FOR UPDATE')->fetchAll();
    echo count($rows)." valid legacy session(s) eligible.\n";
    if(!in_array('--confirm',$argv,true)||!$rows){$pdo->rollBack();exit;}
    $directory='/home/opc/tpk-maintenance-backups';if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('Backup directory unavailable.');
    chmod($directory,0700);$path=$directory.'/staff-session-idle-'.date('Y-m-d').'-'.bin2hex(random_bytes(6)).'.json';
    $payload=json_encode(['createdAt'=>date(DATE_ATOM),'staff_sessions'=>$rows],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
    $file=fopen($path,'xb');if(!$file)throw new RuntimeException('Backup unavailable.');chmod($path,0600);
    if(fwrite($file,$payload)!==strlen($payload))throw new RuntimeException('Backup incomplete.');fflush($file);if(function_exists('fsync'))fsync($file);fclose($file);
    $update=$pdo->prepare('UPDATE staff_sessions SET expires_at=DATE_ADD(expires_at,INTERVAL 36 HOUR) WHERE id=? AND revoked_at IS NULL AND expires_at>NOW()');
    $count=0;foreach($rows as $row){$update->execute([$row['id']]);$count+=$update->rowCount();}
    $pdo->commit();echo "$count session(s) upgraded; expired sessions unchanged. Protected backup: $path\n";
}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
