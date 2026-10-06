<?php
declare(strict_types=1);

function api_assembly_sessions(PDO $db, array $actor): array {
    if(isset($_GET['month'])) {
        $month=(string)$_GET['month'];
        if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$month))api_error('VALIDATION_ERROR','Choose a valid assembly month.',422);
        $start=$month.'-01';
        $end=(new DateTimeImmutable($start))->modify('+1 month')->format('Y-m-d');
        $q=$db->prepare('SELECT id,name,service_date AS serviceDate,service_type AS serviceType,starts_at AS startsAt,ends_at AS endsAt,status FROM service_sessions WHERE campus_id=? AND service_date>=? AND service_date<? AND service_type IS NOT NULL ORDER BY service_date DESC,starts_at,id');
        $q->execute([(int)$actor['campus_id'],$start,$end]);
        return $q->fetchAll();
    }
    return api_classroom_context_sessions($db, $actor);
}

function api_assembly_reaction_payload(PDO $db,array $actor,int $id): array {
    $q=$db->prepare('SELECT id,service_session_id FROM assembly_notes WHERE id=? AND campus_id=?');
    $q->execute([$id,(int)$actor['campus_id']]);$note=$q->fetch();
    if(!$note)api_error('NOTE_NOT_FOUND','This assembly note was not found.',404);
    $counts=['LIKE'=>0,'APPLAUSE'=>0,'HEART'=>0];$mine=null;
    $ready=api_table_exists($db,'assembly_note_reactions');
    if($ready){
        $q=$db->prepare('SELECT reaction,COUNT(*) AS total FROM assembly_note_reactions WHERE note_id=? GROUP BY reaction');
        $q->execute([$id]);foreach($q->fetchAll() as $row)$counts[$row['reaction']]=(int)$row['total'];
        $q=$db->prepare('SELECT reaction FROM assembly_note_reactions WHERE note_id=? AND staff_user_id=?');
        $q->execute([$id,(int)$actor['id']]);$mine=$q->fetchColumn()?:null;
    }
    return ['replies'=>[],'reactions'=>$counts,'myReaction'=>$mine,'canInteract'=>$ready];
}

function api_assembly_note_reaction(PDO $db,int $id,bool $save=false): never {
    $actor=api_actor($db);$payload=api_assembly_reaction_payload($db,$actor,$id);
    if(!$save)api_ok($payload);
    if(!$payload['canInteract'])api_error('FEATURE_NOT_READY','Assembly reactions are not available yet.',503);
    $v=api_input();$reaction=$v['reaction']??null;
    if($reaction!==null&&!in_array($reaction,['LIKE','APPLAUSE','HEART'],true))api_error('VALIDATION_ERROR','Choose a supported reaction.',422);
    if($reaction===null){$q=$db->prepare('DELETE FROM assembly_note_reactions WHERE note_id=? AND staff_user_id=?');$q->execute([$id,(int)$actor['id']]);}
    else{$q=$db->prepare('INSERT INTO assembly_note_reactions(note_id,staff_user_id,reaction) VALUES(?,?,?) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction)');$q->execute([$id,(int)$actor['id'],$reaction]);}
    api_ok(api_assembly_reaction_payload($db,$actor,$id));
}

function api_assembly_activity_reaction(PDO $db,int $id,bool $save=false): never {
    $actor=api_actor($db);$q=$db->prepare('SELECT id FROM assembly_activities WHERE id=? AND campus_id=?');$q->execute([$id,(int)$actor['campus_id']]);if(!$q->fetch())api_error('ACTIVITY_NOT_FOUND','This assembly activity was not found.',404);
    $ready=api_table_exists($db,'assembly_activity_reactions');
    if($save){if(!$ready)api_error('FEATURE_NOT_READY','Video reactions need the curriculum storage update.',503);$reaction=api_input()['reaction']??null;
        if($reaction!==null&&!in_array($reaction,['LIKE','APPLAUSE','HEART'],true))api_error('VALIDATION_ERROR','Choose a supported reaction.',422);
        if($reaction===null)$db->prepare('DELETE FROM assembly_activity_reactions WHERE activity_id=? AND staff_user_id=?')->execute([$id,(int)$actor['id']]);
        else $db->prepare('INSERT INTO assembly_activity_reactions(activity_id,staff_user_id,reaction) VALUES(?,?,?) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction)')->execute([$id,(int)$actor['id'],$reaction]);
    }
    $counts=['LIKE'=>0,'APPLAUSE'=>0,'HEART'=>0];$mine=null;
    if($ready){$q=$db->prepare('SELECT reaction,COUNT(*) AS total FROM assembly_activity_reactions WHERE activity_id=? GROUP BY reaction');$q->execute([$id]);foreach($q->fetchAll() as $row)$counts[$row['reaction']]=(int)$row['total'];$q=$db->prepare('SELECT reaction FROM assembly_activity_reactions WHERE activity_id=? AND staff_user_id=?');$q->execute([$id,(int)$actor['id']]);$mine=$q->fetchColumn()?:null;}
    api_ok(['replies'=>[],'reactions'=>$counts,'myReaction'=>$mine,'canInteract'=>$ready]);
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
        if(api_table_exists($db,'assembly_activities')){$q=$db->prepare("SELECT a.id,a.activity_name AS activityName,a.led_by_staff_user_id AS ledByStaffUserId,a.notes,a.status,a.created_at AS createdAt,p.profile_image_url AS ledByProfileImageUrl,COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.title,''),' ',COALESCE(p.first_name,''),' ',COALESCE(p.last_name,''))),''),u.name) AS ledBy FROM assembly_activities a LEFT JOIN staff_users u ON u.id=a.led_by_staff_user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE a.service_session_id=? AND a.campus_id=? ORDER BY a.created_at,a.id");$q->execute([$sid,(int)$actor['campus_id']]);$activities=$q->fetchAll();}
        if(api_table_exists($db,'assembly_notes')){$q=$db->prepare("SELECT n.id,n.note,n.created_at AS createdAt,n.created_by_staff_user_id AS authorId,p.profile_image_url AS authorProfileImageUrl,COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.title,''),' ',COALESCE(p.first_name,''),' ',COALESCE(p.last_name,''))),''),u.name) AS author FROM assembly_notes n JOIN staff_users u ON u.id=n.created_by_staff_user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE n.service_session_id=? AND n.campus_id=? ORDER BY n.created_at DESC");$q->execute([$sid,(int)$actor['campus_id']]);$notes=$q->fetchAll();}
        foreach($activities as &$activity)$activity['media']=api_assembly_activity_media($db,(int)$activity['id']);unset($activity);
        $groups[]=['serviceSession'=>$service,'childrenInService'=>(int)$attendance->fetchColumn(),'team'=>$team,'activities'=>$activities,'notes'=>$notes,'leaders'=>api_assembly_leaders($db,$actor,$sid),'canManage'=>api_service_duty($db,$actor,$sid,null,['ASSEMBLY','ATTENDANCE','HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2']),'isSuperAdmin'=>$actor['access_level']==='TPK_SUPER_ADMIN','needAttention'=>(!$team?1:0)];
    }
    api_ok(['groups'=>$groups,'serviceSessions'=>$sessions]);
}

function api_assembly_activity(PDO $db, int $id=0): never {
    $actor=api_actor($db);
    if(!api_table_exists($db,'assembly_activities'))api_error('FEATURE_NOT_READY','Assembly storage is not available yet.',503);
    $multipart=str_starts_with($_SERVER['CONTENT_TYPE']??'','multipart/form-data');
    if($multipart && empty($_POST) && (int)($_SERVER['CONTENT_LENGTH']??0)>0)api_error('UPLOAD_TOO_LARGE','These attachments are too large. Please upload smaller files.',413);
    $v=$multipart?$_POST:api_input();$sid=(int)($v['serviceSessionId']??0);
    if($id){$q=$db->prepare('SELECT service_session_id,activity_name,led_by_staff_user_id,notes,status FROM assembly_activities WHERE id=? AND campus_id=?');$q->execute([$id,(int)$actor['campus_id']]);$found=$q->fetch();if(!$found)api_error('ACTIVITY_NOT_FOUND','Assembly activity not found.',404);$sid=(int)$found['service_session_id'];$v=array_replace(['activityName'=>$found['activity_name'],'ledByStaffUserId'=>$found['led_by_staff_user_id'],'notes'=>$found['notes'],'status'=>$found['status']],$v);}
    if(!api_service_duty($db,$actor,$sid,null,['ASSEMBLY','ATTENDANCE','HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2']))api_error('FORBIDDEN','You are not authorised to update Assembly for this service.',403);
    $name=trim((string)($v['activityName']??''));if($name===''||mb_strlen($name)>180)api_error('VALIDATION_ERROR','Enter an activity name of up to 180 characters.',422);
    $status=strtoupper((string)($v['status']??'UPCOMING'));if(!in_array($status,['UPCOMING','COMPLETED','SKIPPED'],true))api_error('VALIDATION_ERROR','This activity update is not valid.',422);
    $leader=(int)($v['ledByStaffUserId']??0);
    if($leader&&!in_array($leader,array_map('intval',array_column(api_assembly_leaders($db,$actor,$sid),'userId')),true))api_error('TEACHER_NOT_ASSIGNED','Choose an Assembly teacher or service leader from this Sunday.',422);
    $uploads=api_assembly_uploads();
    if($uploads&&!api_table_exists($db,'assembly_activity_media'))api_error('FEATURE_NOT_READY','Attachment storage is not available yet.',503);
    $written=[];
    try {
        $db->beginTransaction();
        if($id){$q=$db->prepare('UPDATE assembly_activities SET activity_name=?,led_by_staff_user_id=?,notes=?,status=? WHERE id=?');$q->execute([$name,$leader?:null,trim((string)($v['notes']??''))?:null,$status,$id]);}
        else{$q=$db->prepare('INSERT INTO assembly_activities(campus_id,service_session_id,activity_name,led_by_staff_user_id,notes,created_by_staff_user_id) VALUES(?,?,?,?,?,?)');$q->execute([(int)$actor['campus_id'],$sid,$name,$leader?:null,trim((string)($v['notes']??''))?:null,(int)$actor['id']]);$id=(int)$db->lastInsertId();}
        api_assembly_store_media($db,$actor,$id,$uploads,$written);
        api_audit($db,$actor,'ASSEMBLY_ACTIVITY_SAVED','AssemblyActivity',$id,['serviceSessionId'=>$sid]);
        $db->commit();
    }catch(Throwable $error){
        if($db->inTransaction())$db->rollBack();
        foreach($written as $path)if(is_file($path))unlink($path);
        error_log('Assembly upload failed: '.$error->getMessage());
        api_error('SAVE_FAILED','We could not save this activity and its attachments. Please try again.',500);
    }
    api_ok(['id'=>$id,'media'=>api_assembly_activity_media($db,$id)],201);
}

function api_assembly_note(PDO $db): never {
    $actor=api_actor($db);if(!api_table_exists($db,'assembly_notes'))api_error('FEATURE_NOT_READY','Assembly storage has not been installed yet.',503);$v=api_input();$sid=(int)($v['serviceSessionId']??0);$q=$db->prepare('SELECT id FROM service_sessions WHERE id=? AND campus_id=?');$q->execute([$sid,(int)$actor['campus_id']]);if(!$q->fetch())api_error('SERVICE_SESSION_NOT_FOUND','This service is not available for your campus.',404);if(!api_service_duty($db,$actor,$sid,null,['ASSEMBLY','ATTENDANCE','HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2']))api_error('FORBIDDEN','You are not authorised to add Assembly notes for this service.',403);$note=trim((string)($v['note']??''));if($note==='')api_error('VALIDATION_ERROR','Enter an Assembly note.',422);$q=$db->prepare('INSERT INTO assembly_notes(campus_id,service_session_id,note,created_by_staff_user_id) VALUES(?,?,?,?)');$q->execute([(int)$actor['campus_id'],$sid,$note,(int)$actor['id']]);$id=(int)$db->lastInsertId();api_audit($db,$actor,'ASSEMBLY_NOTE_CREATED','AssemblyNote',$id,['serviceSessionId'=>$sid]);api_ok(['id'=>$id],201);
}
