<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
$db = db();
$campus = $db->query("SELECT id, name FROM campuses WHERE code='PETRA-WUSE' LIMIT 1")->fetch();
if (!$campus) json_response(['error'=>'Run backend/database/seed.sql first.'],503);
$session = $db->prepare('SELECT id, name, UNIX_TIMESTAMP(starts_at)*1000 AS startsAt FROM service_sessions WHERE campus_id=? AND is_open=1 AND service_date=CURDATE() ORDER BY starts_at DESC LIMIT 1');
$session->execute([$campus['id']]); $session=$session->fetch(); $sessionId=(int)($session['id']??0);
$classes=$db->prepare("SELECT c.id,c.name,c.age_label AS ageLabel,c.color,COUNT(a.id) AS checkedIn FROM classes c LEFT JOIN attendance a ON a.class_id=c.id AND a.service_session_id=? AND a.status <> 'PICKED_UP' WHERE c.campus_id=? AND c.is_active=1 GROUP BY c.id ORDER BY c.name");
$classes->execute([$sessionId,$campus['id']]); $classes=$classes->fetchAll();
$attendance=[]; if($sessionId){$a=$db->prepare('SELECT a.id,a.status,UNIX_TIMESTAMP(a.checked_in_at)*1000 AS checkedInAt,ch.first_name AS firstName,ch.last_name AS lastName,cl.name AS className FROM attendance a JOIN children ch ON ch.id=a.child_id JOIN classes cl ON cl.id=a.class_id WHERE a.service_session_id=? ORDER BY a.checked_in_at DESC');$a->execute([$sessionId]);$attendance=$a->fetchAll();}
$recent=array_map(fn($row)=>['id'=>$row['id'],'status'=>$row['status'],'checkedInAt'=>(int)$row['checkedInAt'],'child'=>['firstName'=>$row['firstName'],'lastName'=>$row['lastName']],'class'=>['name'=>$row['className']]],array_slice($attendance,0,6));
json_response(['campus'=>$campus,'session'=>$session,'classes'=>$classes,'recent'=>$recent,'metrics'=>['checkedIn'=>count($attendance),'pickedUp'=>count(array_filter($attendance,fn($a)=>$a['status']==='PICKED_UP')),'present'=>count(array_filter($attendance,fn($a)=>$a['status']!=='PICKED_UP')),'classes'=>count($classes)]]);
