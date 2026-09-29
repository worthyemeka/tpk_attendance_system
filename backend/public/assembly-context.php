<?php
declare(strict_types=1);

function api_assembly_sessions(PDO $db, array $actor): array {
    return api_classroom_context_sessions($db, $actor);
}

function api_assembly(PDO $db): never {
    $actor=api_actor($db); $sessions=api_assembly_sessions($db,$actor); $groups=[];
    foreach($sessions as $service){
        $sid=(int)$service['id'];
        $attendance=$db->prepare("SELECT COUNT(DISTINCT child_id) FROM attendance WHERE service_session_id=? AND status IN ('CHECKED_IN','PICKUP_REQUESTED','PICKED_UP')");$attendance->execute([$sid]);
        $team=[];
        if(api_table_exists($db,'roster_assignments')&&api_table_exists($db,'duty_types')){
            $teamQuery=$db->prepare("SELECT ra.user_id AS userId,ra.status,dt.name AS dutyName,COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.title,''),' ',COALESCE(p.first_name,''),' ',COALESCE(p.last_name,''))),''),u.name) AS name,p.profile_image_url AS profileImageUrl,p.whatsapp_number AS whatsappNumber,p.mobile_number AS mobileNumber FROM roster_assignments ra JOIN duty_types dt ON dt.id=ra.duty_type_id JOIN staff_users u ON u.id=ra.user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE ra.service_session_id=? AND ra.assignment_date=? AND dt.code='ASSEMBLY' AND ra.status NOT IN ('CANCELLED','REPLACED','ABSENT') ORDER BY ra.id");$teamQuery->execute([$sid,$service['serviceDate']]);$team=$teamQuery->fetchAll();
        }
        $activities=[];$notes=[];
        if(api_table_exists($db,'assembly_activities')){$q=$db->prepare("SELECT a.id,a.activity_name AS activityName,a.led_by_staff_user_id AS ledByStaffUserId,a.notes,a.status,a.created_at AS createdAt,COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.title,''),' ',COALESCE(p.first_name,''),' ',COALESCE(p.last_name,''))),''),u.name) AS ledBy FROM assembly_activities a LEFT JOIN staff_users u ON u.id=a.led_by_staff_user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE a.service_session_id=? AND a.campus_id=? ORDER BY a.created_at,a.id");$q->execute([$sid,(int)$actor['campus_id']]);$activities=$q->fetchAll();}
        if(api_table_exists($db,'assembly_notes')){$q=$db->prepare("SELECT n.id,n.note,n.created_at AS createdAt,COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.title,''),' ',COALESCE(p.first_name,''),' ',COALESCE(p.last_name,''))),''),u.name) AS author FROM assembly_notes n JOIN staff_users u ON u.id=n.created_by_staff_user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE n.service_session_id=? AND n.campus_id=? ORDER BY n.created_at DESC");$q->execute([$sid,(int)$actor['campus_id']]);$notes=$q->fetchAll();}
        $pending=0;foreach($activities as $activity)if($activity['status']==='UPCOMING')$pending++;
        $groups[]=['serviceSession'=>$service,'childrenInService'=>(int)$attendance->fetchColumn(),'team'=>$team,'activities'=>$activities,'notes'=>$notes,'canManage'=>api_can_operate_sunday($db,$actor,$sid),'isSuperAdmin'=>$actor['access_level']==='TPK_SUPER_ADMIN','needAttention'=>$pending+(!$team?1:0)];
    }
    api_ok(['groups'=>$groups,'serviceSessions'=>$sessions]);
}

function api_assembly_activity(PDO $db, int $id=0): never {
    $actor=api_actor($db); if(!api_table_exists($db,'assembly_activities'))api_error('FEATURE_NOT_READY','Assembly storage has not been installed yet.',503);
    $v=api_input();$sid=(int)($v['serviceSessionId']??0); if($id){$lookup=$db->prepare('SELECT service_session_id AS serviceSessionId FROM assembly_activities WHERE id=? AND campus_id=?');$lookup->execute([$id,(int)$actor['campus_id']]);$found=$lookup->fetch();if(!$found)api_error('ACTIVITY_NOT_FOUND','Assembly activity not found.',404);$sid=(int)$found['serviceSessionId'];}
    $session=$db->prepare('SELECT id FROM service_sessions WHERE id=? AND campus_id=?');$session->execute([$sid,(int)$actor['campus_id']]);if(!$session->fetch())api_error('SERVICE_SESSION_NOT_FOUND','This service is not available for your campus.',404);if(!api_can_operate_sunday($db,$actor,$sid))api_error('FORBIDDEN','You are not authorised to update Assembly for this service.',403);
    $status=strtoupper(trim((string)($v['status']??'UPCOMING')));if(!in_array($status,['UPCOMING','COMPLETED','SKIPPED'],true))api_error('VALIDATION_ERROR','Choose a valid Assembly activity status.',422);
    if($id){$sets=['status=?'];$params=[$status];if(array_key_exists('activityName',$v)){$sets[]='activity_name=?';$params[]=trim((string)$v['activityName']);}if(array_key_exists('notes',$v)){$sets[]='notes=?';$params[]=trim((string)$v['notes'])?:null;}$params[]=$id;$db->prepare('UPDATE assembly_activities SET '.implode(',',$sets).' WHERE id=?')->execute($params);api_audit($db,$actor,'ASSEMBLY_ACTIVITY_UPDATED','AssemblyActivity',$id,['serviceSessionId'=>$sid]);api_ok(['id'=>$id,'updated'=>true]);}
    $name=trim((string)($v['activityName']??''));if($name==='')api_error('VALIDATION_ERROR','Activity name is required.',422);$leader=(int)($v['ledByStaffUserId']??0);if($leader){$q=$db->prepare('SELECT id FROM staff_users WHERE id=? AND campus_id=? AND is_active=1');$q->execute([$leader,(int)$actor['campus_id']]);if(!$q->fetch())api_error('TEACHER_NOT_FOUND','Choose an active teacher from this campus.',422);}$q=$db->prepare('INSERT INTO assembly_activities(campus_id,service_session_id,activity_name,led_by_staff_user_id,notes,status,created_by_staff_user_id) VALUES(?,?,?,?,?,?,?)');$q->execute([(int)$actor['campus_id'],$sid,$name,$leader?:null,trim((string)($v['notes']??''))?:null,$status,(int)$actor['id']]);$new=(int)$db->lastInsertId();api_audit($db,$actor,'ASSEMBLY_ACTIVITY_CREATED','AssemblyActivity',$new,['serviceSessionId'=>$sid]);api_ok(['id'=>$new],201);
}

function api_assembly_note(PDO $db): never {
    $actor=api_actor($db);if(!api_table_exists($db,'assembly_notes'))api_error('FEATURE_NOT_READY','Assembly storage has not been installed yet.',503);$v=api_input();$sid=(int)($v['serviceSessionId']??0);$q=$db->prepare('SELECT id FROM service_sessions WHERE id=? AND campus_id=?');$q->execute([$sid,(int)$actor['campus_id']]);if(!$q->fetch())api_error('SERVICE_SESSION_NOT_FOUND','This service is not available for your campus.',404);if(!api_can_operate_sunday($db,$actor,$sid))api_error('FORBIDDEN','You are not authorised to add Assembly notes for this service.',403);$note=trim((string)($v['note']??''));if($note==='')api_error('VALIDATION_ERROR','Enter an Assembly note.',422);$q=$db->prepare('INSERT INTO assembly_notes(campus_id,service_session_id,note,created_by_staff_user_id) VALUES(?,?,?,?)');$q->execute([(int)$actor['campus_id'],$sid,$note,(int)$actor['id']]);$id=(int)$db->lastInsertId();api_audit($db,$actor,'ASSEMBLY_NOTE_CREATED','AssemblyNote',$id,['serviceSessionId'=>$sid]);api_ok(['id'=>$id],201);
}
