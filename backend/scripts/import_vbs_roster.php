<?php
declare(strict_types=1);

// Called inside the backfill transaction. Names are historical source identities,
// not authenticated accounts; aliases and ambiguous blocks are never auto-merged.
function import_vbs_roster(PDO $db,int $event,array $roster,array $days,int $file): array {
    $groups=[];$people=[];$added=0;
    foreach(array_merge($roster['classes'],array_keys($roster['rotations'])) as $name){
        $db->prepare('INSERT IGNORE INTO event_roster_groups(event_id,name,kind) VALUES(?,?,?)')->execute([$event,$name,in_array($name,$roster['classes'],true)?'CLASS':'ROTATION']);
        $q=$db->prepare('SELECT id FROM event_roster_groups WHERE event_id=? AND name=?');$q->execute([$event,$name]);$groups[$name]=(int)$q->fetchColumn();
    }
    foreach($roster['rotations'] as $rotation=>$classes)foreach($classes as $class)$db->prepare('INSERT IGNORE INTO event_roster_group_members(rotation_id,class_id) VALUES(?,?)')->execute([$groups[$rotation],$groups[$class]]);
    $person=function(array $p)use($db,$event,&$people):int{
        $key=hash('sha256',mb_strtolower(trim($p['name'])));if(isset($people[$key]))return $people[$key];
        $db->prepare('INSERT IGNORE INTO event_roster_people(event_id,source_name,source_key,review_required) VALUES(?,?,?,?)')->execute([$event,$p['name'],$key,(int)!empty($p['requiresReview'])]);
        $q=$db->prepare('SELECT id FROM event_roster_people WHERE event_id=? AND source_key=?');$q->execute([$event,$key]);return $people[$key]=(int)$q->fetchColumn();
    };
    $assign=function(int $pid,int $day,?int $activity,?int $group,string $role,int $page)use($db,$event,$file):void{
        $q=$db->prepare('SELECT id FROM event_roster_assignments WHERE event_id=? AND person_id=? AND day_id=? AND activity_id<=>? AND roster_group_id<=>? AND responsibility=?');$q->execute([$event,$pid,$day,$activity,$group,$role]);if($q->fetchColumn())return;
        $db->prepare("INSERT INTO event_roster_assignments(event_id,person_id,day_id,activity_id,roster_group_id,responsibility,call_time,source_file_id,source_page) VALUES(?,?,?,?,?,?,'08:00',?,?)")->execute([$event,$pid,$day,$activity,$group,$role,$file,$page]);
    };
    foreach($roster['leads'] as $lead)$assign($person($lead),$days[$lead['dayNumber']],null,null,'VBS day lead',$lead['sourcePage']);
    foreach($roster['activities'] as $i=>$activity){
        $q=$db->prepare('SELECT id FROM event_programme_activities WHERE event_id=? AND source_key=?');$q->execute([$event,$activity['sourceKey']]);$aid=(int)$q->fetchColumn();
        if(!$aid){$db->prepare('INSERT INTO event_programme_activities(event_id,day_id,title,starts_at,ends_at,notes,sort_order,source_key,source_file_id,source_page,roster_group_id,responsible_raw) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$event,$days[$activity['dayNumber']],$activity['title'],$activity['startsAt'],$activity['endsAt'],'PLANNED · '.$roster['sourceName'].' · page '.$activity['sourcePage'].'. '.$roster['warning'],$i,$activity['sourceKey'],$file,$activity['sourcePage'],$groups[$activity['group']]??null,$activity['rawPeople']]);$aid=(int)$db->lastInsertId();$added++;}
        foreach($activity['people'] as $p)$assign($person($p),$days[$activity['dayNumber']],$aid,$groups[$p['group']??$activity['group']]??null,$p['role'],$activity['sourcePage']);
    }
    return ['activitiesAdded'=>$added,'sourceIdentities'=>count($people)];
}
