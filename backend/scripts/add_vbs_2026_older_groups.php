<?php
declare(strict_types=1);
// Run on the Oracle host after deploying the backend. Preview is the default.
require_once dirname(__DIR__).'/config.php';

$db=db();
$campusId=(int)(tpk_regular_campus($db)['id']??0);
if(!$campusId)throw new RuntimeException('Regular TPK headquarters campus was not found; no changes made.');
$query=$db->prepare("SELECT id FROM ministry_events WHERE campus_id=? AND event_type='VBS' AND starts_on='2026-08-24' AND ends_on='2026-08-29'");
$query->execute([$campusId]);
$ids=$query->fetchAll(PDO::FETCH_COLUMN);
if(count($ids)!==1)throw new RuntimeException('Expected exactly one Wuse VBS 2026 event; no changes made.');
$eventId=(int)$ids[0];
$groups=[['Tribe B',9,11],['Tribe A (Teens)',12,19]];
$query=$db->prepare('SELECT id,name,min_age,max_age FROM event_groups WHERE event_id=? ORDER BY min_age');
$query->execute([$eventId]);
$existing=$query->fetchAll(PDO::FETCH_ASSOC);
foreach($groups as [$name,$min,$max]){
    foreach($existing as $group){
        if($group['name']===$name && ((int)$group['min_age']!==$min||(int)$group['max_age']!==$max))throw new RuntimeException("$name exists with a different age range; review before changing it.");
        if($group['name']!==$name && (int)$group['min_age']<=$max && (int)$group['max_age']>=$min)throw new RuntimeException("$name overlaps {$group['name']}; review before changing it.");
    }
}
echo json_encode(['eventId'=>$eventId,'existing'=>$existing,'add'=>$groups],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;
if(!in_array('--confirm',$argv,true)){echo "Preview only. Rerun with --confirm to add the groups.\n";exit(0);}
$db->beginTransaction();
try{
    foreach($groups as [$name,$min,$max]){
        $query=$db->prepare('SELECT id FROM event_groups WHERE event_id=? AND name=?');
        $query->execute([$eventId,$name]);
        if(!$query->fetchColumn())$db->prepare('INSERT INTO event_groups(event_id,name,min_age,max_age) VALUES(?,?,?,?)')->execute([$eventId,$name,$min,$max]);
    }
    $db->commit();
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
echo "Two older VBS groups are available. Existing child assignments were not changed.\n";
