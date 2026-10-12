<?php
declare(strict_types=1);
final class TeenError extends RuntimeException{}
function api_error(string $code,string $message,int $status=400):never{throw new TeenError($code);}
function event_text($v,int $max=180):string{if(!is_string($v)||trim($v)===''||mb_strlen(trim($v))>$max)api_error('VALIDATION_ERROR','Invalid',422);return trim($v);}
function event_date($v):string{$d=is_string($v)?DateTimeImmutable::createFromFormat('!Y-m-d',$v):false;if(!$d||$d->format('Y-m-d')!==$v)api_error('VALIDATION_ERROR','Invalid date',422);return $v;}
function api_phone(?string $v):?string{$v=preg_replace('/\D+/','',$v??'');if(str_starts_with($v,'234')&&strlen($v)===13)$v='0'.substr($v,3);return strlen($v)===11&&str_starts_with($v,'0')?$v:null;}
function api_table_exists(PDO $db,string $table):bool{return true;}
$root=$argv[1]??dirname(__DIR__);require $root.'/public/teen-programme.php';$checks=0;
function checkTeen(bool $pass,string $message):void{if(!$pass)throw new RuntimeException($message);$GLOBALS['checks']++;}
function rejectTeen(callable $fn,string $code):void{try{$fn();throw new RuntimeException('Unexpected acceptance');}catch(TeenError $e){checkTeen($e->getMessage()===$code,'Wrong rejection');}}
$event=['id'=>1,'starts_on'=>'2026-10-17'];$form=['minAge'=>11,'maxAge'=>19,'rules'=>'Respect everyone','rulesVersion'=>hash('sha256','Respect everyone')];
$v=['name'=>'Fixture Boy','dateOfBirth'=>'2015-10-17','school'=>'Fixture School','schoolClass'=>'JSS 1','whatsapp'=>'','guardianName'=>'Fixture Guardian','guardianPhone'=>'08000000000','rulesAccepted'=>true,'rulesVersion'=>$form['rulesVersion'],'guardianPermission'=>true];
foreach(['2015-10-17'=>11,'2007-10-18'=>18,'2007-10-17'=>19,'2006-10-18'=>19] as $dob=>$age){$v['dateOfBirth']=$dob;checkTeen(event_teen_values($event,$form,$v)['age']===$age,'Age boundary failed');}
foreach(['2015-10-18','2006-10-17','2030-01-01'] as $dob){$v['dateOfBirth']=$dob;rejectTeen(fn()=>event_teen_values($event,$form,$v),'AGE_NOT_ELIGIBLE');}
$v['dateOfBirth']='2015-10-17';$v['guardianPermission']=false;rejectTeen(fn()=>event_teen_values($event,$form,$v),'GUARDIAN_PERMISSION_REQUIRED');$v['dateOfBirth']='2008-10-17';checkTeen(event_teen_values($event,$form,$v)['guardianPermission']===null,'Adult must not be recorded as parental consent');
$v['rulesAccepted']=false;rejectTeen(fn()=>event_teen_values($event,$form,$v),'RULES_REQUIRED');$v['rulesAccepted']=true;$v['rulesVersion']='stale';rejectTeen(fn()=>event_teen_values($event,$form,$v),'RULES_CHANGED');$v['rulesVersion']=$form['rulesVersion'];$v['guardianPhone']='invalid';rejectTeen(fn()=>event_teen_values($event,$form,$v),'VALIDATION_ERROR');$v['guardianPhone']='08000000000';$v['dateOfBirth']='2015-02-30';rejectTeen(fn()=>event_teen_values($event,$form,$v),'VALIDATION_ERROR');
$v['dateOfBirth']='2015-10-17';$v['guardianPermission']=true;$v['guardianPhone']=[];rejectTeen(fn()=>event_teen_values($event,$form,$v),'VALIDATION_ERROR');$v['guardianPhone']='08000000000';$v['whatsapp']=[];rejectTeen(fn()=>event_teen_values($event,$form,$v),'VALIDATION_ERROR');$v['whatsapp']='';
if(getenv('TPK_MYSQL_SMOKE')==='1'){
 require (getenv('TPK_CONFIG_ROOT')?:$root).'/config.php';$db=db();$tables=['ministry_events','event_registrations','event_children','event_teen_forms','event_teen_registration_details'];
 try{foreach($tables as $t){$ddl=$db->query('SHOW CREATE TABLE `'.$t.'`')->fetch(PDO::FETCH_NUM)[1];$ddl=preg_replace('/^CREATE TABLE /','CREATE TEMPORARY TABLE ',$ddl);$ddl=preg_replace('/^\s*CONSTRAINT[^\n]*\n/m','',$ddl);$ddl=preg_replace('/,\s*\)/',')',$ddl);$db->exec($ddl);}
  $db->exec("INSERT INTO ministry_events(id,campus_id,name,event_type,starts_on,ends_on,registration_opens,registration_closes,public_key,created_by) VALUES(1,1,'Fixture','OTHER','2026-10-17','2026-10-31','2026-10-12','2026-10-16','fixture-key',1)");
  $before=$db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM families)+(SELECT COUNT(*) FROM staff_users)+(SELECT COUNT(*) FROM staff_sessions)')->fetchColumn();
  $v['dateOfBirth']='2015-10-17';$v['guardianPermission']=true;$r=event_teen_register($db,$event,$form,$v);checkTeen(strlen($r['referenceCode'])===16,'Missing reference');checkTeen((int)$db->query('SELECT COUNT(*) FROM event_teen_registration_details')->fetchColumn()===1,'Missing structured record');rejectTeen(fn()=>event_teen_register($db,$event,$form,$v),'ALREADY_REGISTERED');checkTeen((int)$db->query('SELECT COUNT(*) FROM event_registrations')->fetchColumn()===1,'Duplicate orphan registration');
  $saved=$db->query('SELECT rules_snapshot,guardian_permission_declared FROM event_teen_registration_details')->fetch();checkTeen($saved['rules_snapshot']===$form['rules']&&(int)$saved['guardian_permission_declared']===1,'Rules or guardian declaration missing');
  checkTeen($before===$db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM families)+(SELECT COUNT(*) FROM staff_users)+(SELECT COUNT(*) FROM staff_sessions)')->fetchColumn(),'Regular records or accounts changed');
 }finally{if($db->inTransaction())$db->rollBack();foreach(array_reverse($tables) as $t)$db->exec("DROP TEMPORARY TABLE IF EXISTS `$t`");}
}
echo "PASS: $checks teen registration boundary, rules, guardian and isolation checks.\n";
