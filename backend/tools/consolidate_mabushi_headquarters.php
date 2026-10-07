<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require (getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__)).'/config.php';
$db=db();$confirm=in_array('--confirm',$argv,true);
$quote=fn(string $s):string=>'`'.str_replace('`','``',$s).'`';
$db->beginTransaction();
try{
 $campuses=$db->query("SELECT * FROM campuses WHERE code IN ('PETRA-WUSE','PETRA-MABUSHI') ORDER BY id FOR UPDATE")->fetchAll();
 $old=null;$regional=null;foreach($campuses as $row){if($row['code']==='PETRA-WUSE')$old=$row;else $regional=$row;}
 if(!$old){if(!$regional)throw new RuntimeException('No regular headquarters campus exists.');$db->rollBack();echo "Already consolidated as Mabushi.\n";exit;}
 // Exact inspected targets; do not infer other campus IDs or merge other campuses.
 if((int)$old['id']!==1||!$regional||(int)$regional['id']!==4)throw new RuntimeException('Campus targets changed; inspect before applying.');
 $columns=$db->query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('campus_id','home_campus_id') AND DATA_TYPE IN ('int','bigint','smallint','tinyint') ORDER BY TABLE_NAME,COLUMN_NAME")->fetchAll();
 $known=array_map(fn($c)=>$c['TABLE_NAME'].'.'.$c['COLUMN_NAME'],$columns);
 $foreign=$db->query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='campuses'")->fetchAll();
 foreach($foreign as $ref)if(!in_array($ref['TABLE_NAME'].'.'.$ref['COLUMN_NAME'],$known,true))throw new RuntimeException('An unreviewed campus dependency exists; inspect before applying.');
 $backup=['createdAt'=>date(DATE_ATOM),'retainedCampusId'=>1,'mergedCampusId'=>4,'campuses'=>$campuses,'rows'=>[]];$counts=[];$summary=[];
 foreach($columns as $column){$table=$column['TABLE_NAME'];$field=$column['COLUMN_NAME'];$rows=$db->query('SELECT * FROM '.$quote($table).' WHERE '.$quote($field).' IN (1,4) FOR UPDATE')->fetchAll();$backup['rows'][$table][$field]=$rows;$counts[$table]=(int)$db->query('SELECT COUNT(*) FROM '.$quote($table))->fetchColumn();$summary[$table.'.'.$field]=['regularRows'=>count(array_filter($rows,fn($r)=>(int)$r[$field]===1)),'mergedRows'=>count(array_filter($rows,fn($r)=>(int)$r[$field]===4))];}
 echo json_encode(['mode'=>$confirm?'CONFIRM':'DRY_RUN','target'=>'Petra Mabushi (Regional Campus)','references'=>$summary],JSON_PRETTY_PRINT)."\n";
 if(!$confirm){$db->rollBack();exit;}
 $dir='/var/backups/tpk/mabushi-headquarters-20261007';if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Protected backup directory unavailable.');chmod($dir,0700);
 $file=$dir.'/campus-links-'.bin2hex(random_bytes(8)).'.json';$handle=fopen($file,'xb');if(!$handle)throw new RuntimeException('Backup unavailable.');chmod($file,0600);$payload=json_encode($backup,JSON_THROW_ON_ERROR);if(fwrite($handle,$payload)!==strlen($payload))throw new RuntimeException('Backup incomplete.');fflush($handle);if(function_exists('fsync'))fsync($handle);fclose($handle);
 // Repoint the separate Mabushi entry into the existing regular-campus ID.
 // No children, people, attendance, sessions or roster rows are deleted.
 foreach($columns as $column)$db->exec('UPDATE '.$quote($column['TABLE_NAME']).' SET '.$quote($column['COLUMN_NAME']).'=1 WHERE '.$quote($column['COLUMN_NAME']).'=4');
 foreach($columns as $column)if((int)$db->query('SELECT COUNT(*) FROM '.$quote($column['TABLE_NAME']).' WHERE '.$quote($column['COLUMN_NAME']).'=4')->fetchColumn()!==0)throw new RuntimeException('A campus link was not reassigned.');
 if($db->exec("DELETE FROM campuses WHERE id=4 AND code='PETRA-MABUSHI'")!==1)throw new RuntimeException('Duplicate campus removal failed.');
 if($db->exec("UPDATE campuses SET name='Petra Mabushi (Regional Campus)',code='PETRA-MABUSHI' WHERE id=1 AND code='PETRA-WUSE'")!==1)throw new RuntimeException('Campus rename failed.');
 foreach($counts as $table=>$count)if((int)$db->query('SELECT COUNT(*) FROM '.$quote($table))->fetchColumn()!==$count)throw new RuntimeException('Linked record counts changed; reverting.');
 if((int)$db->query("SELECT COUNT(*) FROM campuses WHERE code='PETRA-WUSE'")->fetchColumn()!==0)throw new RuntimeException('Wuse remains configured.');
 $db->commit();echo "PASS: Mabushi headquarters retained at campus ID 1; all linked record counts preserved. Protected recovery backup: $file\n";
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
