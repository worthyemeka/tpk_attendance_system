<?php
declare(strict_types=1);
// Explicit, backed-up maintenance only. Never run this from an HTTP request.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/config.php';
$options=getopt('', ['campus:', 'ids:', 'as-of:', 'confirm']);
$campus=(int)($options['campus']??0);
$ids=array_values(array_unique(array_filter(array_map('intval',explode(',',(string)($options['ids']??''))))));sort($ids);
$asOf=(string)($options['as-of']??'');
$date=DateTimeImmutable::createFromFormat('!Y-m-d',$asOf,new DateTimeZone('Africa/Lagos'));
if(!$campus||!$ids||!$date||$date->format('Y-m-d')!==$asOf)throw new RuntimeException('Supply the inspected campus, exact child IDs and as-of date.');
$cutoff=$date->modify('-3 years')->format('Y-m-d');$pdo=db();
$marks=implode(',',array_fill(0,count($ids),'?'));
$pdo->beginTransaction();
try {
    $s=$pdo->prepare("SELECT c.* FROM children c JOIN families f ON f.id=c.family_id WHERE c.id IN ($marks) AND f.campus_id=? AND c.date_of_birth>? AND c.date_of_birth<=? ORDER BY c.id FOR UPDATE");$s->execute(array_merge($ids,[$campus,$cutoff,$asOf]));$children=$s->fetchAll();
    if(array_map(fn($row)=>(int)$row['id'],$children)!==$ids)throw new RuntimeException('IDs or ages have changed; inspect again before removing anything.');
    $foreignKeys=$pdo->query("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL")->fetchAll();
    $quote=fn(string $name):string=>'`'.str_replace('`','``',$name).'`';
    $backup=['asOf'=>$asOf,'campusId'=>$campus,'childIds'=>$ids,'createdAt'=>date(DATE_ATOM),'tables'=>['children'=>$children],'schema'=>[]];
    $seen=[];$deletions=[];
    $visit=function(string $table,array $rows)use(&$visit,&$backup,&$seen,&$deletions,$foreignKeys,$pdo,$quote):void {
        if(!$rows)return;
        foreach($foreignKeys as $fk){
            if($fk['REFERENCED_TABLE_NAME']!==$table)continue;
            $values=array_values(array_unique(array_filter(array_column($rows,$fk['REFERENCED_COLUMN_NAME']),fn($v)=>$v!==null)));
            if(!$values)continue;
            $key=$fk['TABLE_NAME'].':'.$fk['COLUMN_NAME'].':'.implode(',',$values);if(isset($seen[$key]))continue;$seen[$key]=true;
            $placeholders=implode(',',array_fill(0,count($values),'?'));
            $s=$pdo->prepare('SELECT * FROM '.$quote($fk['TABLE_NAME']).' WHERE '.$quote($fk['COLUMN_NAME'])." IN ($placeholders)");$s->execute($values);$dependent=$s->fetchAll();
            foreach($dependent as $row)$backup['tables'][$fk['TABLE_NAME']][hash('sha256',serialize($row))]=$row;
            $visit($fk['TABLE_NAME'],$dependent);
            $deletions[]=['table'=>$fk['TABLE_NAME'],'column'=>$fk['COLUMN_NAME'],'values'=>$values];
        }
    };
    $visit('children',$children);
    foreach($backup['tables'] as $table=>&$rows){$rows=array_values($rows);$schema=$pdo->query('SHOW CREATE TABLE '.$quote($table))->fetch(PDO::FETCH_NUM);$backup['schema'][$table]=$schema[1];}unset($rows);
    echo json_encode(['childIds'=>$ids,'linkedRows'=>array_map('count',$backup['tables']),'mode'=>isset($options['confirm'])?'CONFIRM':'DRY_RUN'],JSON_PRETTY_PRINT)."\n";
    if(!isset($options['confirm'])){$pdo->rollBack();exit;}
    $directory='/home/opc/tpk-maintenance-backups';
    if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('Protected backup directory unavailable.');
    chmod($directory,0700);
    $path=$directory.'/under-three-'.$asOf.'-'.bin2hex(random_bytes(6)).'.json';
    $payload=json_encode($backup,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT);
    $file=fopen($path,'xb');if(!$file)throw new RuntimeException('Could not create backup.');chmod($path,0600);
    if(fwrite($file,$payload)!==strlen($payload))throw new RuntimeException('Backup incomplete; nothing was removed.');fflush($file);if(function_exists('fsync'))fsync($file);fclose($file);
    foreach($deletions as $delete){$placeholders=implode(',',array_fill(0,count($delete['values']),'?'));$pdo->prepare('DELETE FROM '.$quote($delete['table']).' WHERE '.$quote($delete['column'])." IN ($placeholders)")->execute($delete['values']);}
    $delete=$pdo->prepare("DELETE FROM children WHERE id IN ($marks)");$delete->execute($ids);if($delete->rowCount()!==count($ids))throw new RuntimeException('Child removal count mismatch.');
    $pdo->commit();echo 'Removed '.count($ids).' under-three child records. Families and guardians retained. Backup: '.$path."\n";
}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
