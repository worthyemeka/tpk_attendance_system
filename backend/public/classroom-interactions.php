<?php
declare(strict_types=1);

function api_teacher_photos(PDO $db): never {
    $actor=api_actor($db);
    // Photos only, including historical authors; never expose profile details.
    $q=$db->prepare('SELECT u.id,p.profile_image_url AS profileImageUrl FROM staff_users u JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE u.campus_id=? AND p.profile_image_url IS NOT NULL');
    $q->execute([(int)$actor['campus_id']]);
    api_ok($q->fetchAll());
}

/** Permissions follow the actual service/date, not the teacher's latest roster. */
function api_service_duty(PDO $db, array $actor, int $sid, ?int $classId = null, array $codes = []): bool {
    $q=$db->prepare('SELECT id,service_date,service_type FROM service_sessions WHERE id=? AND campus_id=?');
    $q->execute([$sid,(int)$actor['campus_id']]);$service=$q->fetch();
    if(!$service)return false;
    if($actor['access_level']==='TPK_SUPER_ADMIN')return true;
    $where="ra.user_id=? AND ra.assignment_date=? AND ra.status NOT IN ('CANCELLED','REPLACED','ABSENT') AND (ra.service_session_id=? OR ra.service_session_id IS NULL)";
    $params=[(int)$actor['id'],$service['service_date'],$sid];
    if($codes){$where.=' AND dt.code IN ('.implode(',',array_fill(0,count($codes),'?')).')';$params=array_merge($params,$codes);}
    if($classId!==null){$where.=" AND (ra.class_id=? OR (?='FIRST_SERVICE' AND dt.code='FIRST_SERVICE_TEAM'))";$params[]=$classId;$params[]=$service['service_type'];}
    $q=$db->prepare("SELECT 1 FROM roster_assignments ra JOIN duty_types dt ON dt.id=ra.duty_type_id WHERE $where LIMIT 1");$q->execute($params);return(bool)$q->fetchColumn();
}
function api_review_allowed(PDO $db,array $actor,int $classId,int $sid): bool {
    return api_service_duty($db,$actor,$sid,null,['HEAD_OF_SERVICE','ATTENDANCE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2']) || api_service_duty($db,$actor,$sid,$classId);
}
function api_discussion_payload(PDO $db,array $actor,int $id): array {
    $q=$db->prepare('SELECT id,class_id,service_session_id FROM classroom_weekly_reviews WHERE id=? AND campus_id=?');$q->execute([$id,(int)$actor['campus_id']]);$review=$q->fetch();
    if(!$review)api_error('REVIEW_NOT_FOUND','This discussion was not found.',404);
    // Staff participating in that service can encourage the class team.
    $allowed=api_service_duty($db,$actor,(int)$review['service_session_id']);
    if(!$allowed)api_error('FORBIDDEN','This discussion is outside your assigned service.',403);
    $replies=[];$counts=['LIKE'=>0,'APPLAUSE'=>0,'HEART'=>0];$mine=null;
    $ready=api_table_exists($db,'classroom_review_replies')&&api_table_exists($db,'classroom_review_reactions');
    if($ready){
        $q=$db->prepare("SELECT r.id,r.body,r.created_at AS createdAt,r.created_by_staff_user_id AS authorId,p.profile_image_url AS authorProfileImageUrl,COALESCE(NULLIF(TRIM(CONCAT_WS(' ',p.title,p.first_name,p.last_name)),''),u.name) AS author FROM classroom_review_replies r JOIN staff_users u ON u.id=r.created_by_staff_user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE r.review_id=? ORDER BY r.created_at,r.id");$q->execute([$id]);$replies=$q->fetchAll();
        $q=$db->prepare('SELECT reaction,COUNT(*) AS total FROM classroom_review_reactions WHERE review_id=? GROUP BY reaction');$q->execute([$id]);foreach($q->fetchAll() as $row)$counts[$row['reaction']]=(int)$row['total'];
        $q=$db->prepare('SELECT reaction FROM classroom_review_reactions WHERE review_id=? AND staff_user_id=?');$q->execute([$id,(int)$actor['id']]);$mine=$q->fetchColumn()?:null;
    }
    return ['replies'=>$replies,'reactions'=>$counts,'myReaction'=>$mine,'canInteract'=>$ready];
}
function api_discussion(PDO $db,int $id,string $action=''): never {
    $actor=api_actor($db);$payload=api_discussion_payload($db,$actor,$id);
    if($action==='')api_ok($payload);
    if(!$payload['canInteract'])api_error('FEATURE_NOT_READY','Discussion replies are not available yet.',503);
    $v=api_input();
    if($action==='reply'){
        $body=trim((string)($v['body']??''));if($body===''||mb_strlen($body)>2000)api_error('VALIDATION_ERROR','Enter a reply of up to 2,000 characters.',422);
        $q=$db->prepare('INSERT INTO classroom_review_replies(review_id,body,created_by_staff_user_id) VALUES(?,?,?)');$q->execute([$id,$body,(int)$actor['id']]);
        api_audit($db,$actor,'CLASSROOM_DISCUSSION_REPLY','ClassroomWeeklyReview',$id,[]);
    }else{
        $reaction=$v['reaction']??null;
        if($reaction!==null&&!in_array($reaction,['LIKE','APPLAUSE','HEART'],true))api_error('VALIDATION_ERROR','Choose a supported reaction.',422);
        // Setting the desired reaction is idempotent; retrying cannot double-count.
        if($reaction===null){$q=$db->prepare('DELETE FROM classroom_review_reactions WHERE review_id=? AND staff_user_id=?');$q->execute([$id,(int)$actor['id']]);}
        else{$q=$db->prepare('INSERT INTO classroom_review_reactions(review_id,staff_user_id,reaction) VALUES(?,?,?) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction)');$q->execute([$id,(int)$actor['id'],$reaction]);}
    }
    api_ok(api_discussion_payload($db,$actor,$id));
}

function api_assembly_leaders(PDO $db,array $actor,int $sid): array {
    $q=$db->prepare("SELECT DISTINCT u.id AS userId,COALESCE(NULLIF(TRIM(CONCAT_WS(' ',p.title,p.first_name,p.last_name)),''),u.name) AS name FROM staff_users u LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE u.campus_id=? AND u.is_active=1 AND u.account_status='VERIFIED' AND u.team_status<>'INACTIVE' AND (u.access_level='TPK_SUPER_ADMIN' OR EXISTS(SELECT 1 FROM roster_assignments ra JOIN duty_types dt ON dt.id=ra.duty_type_id JOIN service_sessions s ON s.id=? AND s.campus_id=u.campus_id WHERE ra.user_id=u.id AND ra.assignment_date=s.service_date AND (ra.service_session_id=s.id OR ra.service_session_id IS NULL) AND ra.status NOT IN ('CANCELLED','REPLACED','ABSENT') AND dt.code IN ('ASSEMBLY','HEAD_OF_SERVICE','ATTENDANCE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2'))) ORDER BY name");$q->execute([(int)$actor['campus_id'],$sid]);return$q->fetchAll();
}
