<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/config.php';
require_once dirname(__DIR__).'/public/classroom-interactions.php';
if(PHP_SAPI!=='cli')exit(1);
function check(bool $condition,string $message): void { if(!$condition)throw new RuntimeException($message);echo "PASS $message\n"; }
$db=db();$tested=0;
$rows=$db->query("SELECT ra.user_id,ra.class_id,ra.service_session_id,dt.code,u.campus_id,u.access_level FROM roster_assignments ra JOIN duty_types dt ON dt.id=ra.duty_type_id JOIN staff_users u ON u.id=ra.user_id JOIN service_sessions s ON s.id=ra.service_session_id AND s.service_date=ra.assignment_date WHERE ra.status NOT IN ('CANCELLED','REPLACED','ABSENT') AND u.is_active=1 AND u.account_status='VERIFIED' AND u.team_status<>'INACTIVE' ORDER BY ra.assignment_date DESC LIMIT 150")->fetchAll();
foreach($rows as $row){
 $actor=['id'=>(int)$row['user_id'],'campus_id'=>(int)$row['campus_id'],'access_level'=>'TPK_ADMIN'];$sid=(int)$row['service_session_id'];
 check(api_service_duty($db,$actor,$sid),'Exact historical service assignment recognised');
 if(in_array($row['code'],['ASSEMBLY','ATTENDANCE','HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2'],true))check(in_array((int)$actor['id'],array_map('intval',array_column(api_assembly_leaders($db,$actor,$sid),'userId')),true),'Eligible Assembly leader included');
 if(in_array($row['code'],['ATTENDANCE','HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2'],true)){
  $q=$db->prepare('SELECT id FROM classes WHERE campus_id=? LIMIT 1');$q->execute([$actor['campus_id']]);$class=(int)$q->fetchColumn();if($class)check(api_review_allowed($db,$actor,$class,$sid),'Service leadership can review a class');
 }
 check(!api_service_duty($db,['id'=>0,'campus_id'=>$actor['campus_id'],'access_level'=>'TPK_ADMIN'],$sid),'Unassigned teacher cannot interact');
 check(!api_service_duty($db,['id'=>$actor['id'],'campus_id'=>0,'access_level'=>'TPK_SUPER_ADMIN'],$sid),'Cross-campus Super Admin blocked');$tested++;
}
check($tested>0,'Real roster records tested');
// All persistence assertions are rolled back, including the temporary review.
$q=$db->query("SELECT u.id AS userId,u.campus_id AS campusId,c.id AS classId,s.id AS sid FROM staff_users u JOIN classes c ON c.campus_id=u.campus_id JOIN service_sessions s ON s.campus_id=u.campus_id WHERE u.access_level='TPK_SUPER_ADMIN' AND u.is_active=1 LIMIT 1");$seed=$q->fetch();check((bool)$seed,'Persistence test relationships available');
try{
 $db->beginTransaction();
 $q=$db->prepare('INSERT INTO classroom_weekly_reviews(campus_id,class_id,service_session_id,worked_well,created_by_staff_user_id) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');$q->execute([$seed['campusId'],$seed['classId'],$seed['sid'],'Rollback-only verification',$seed['userId']]);$review=(int)$db->lastInsertId();
 $q=$db->prepare('INSERT INTO classroom_review_reactions(review_id,staff_user_id,reaction) VALUES(?,?,?) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction)');$q->execute([$review,$seed['userId'],'LIKE']);$q->execute([$review,$seed['userId'],'LIKE']);$q->execute([$review,$seed['userId'],'HEART']);
 $q=$db->prepare('SELECT COUNT(*),MAX(reaction) FROM classroom_review_reactions WHERE review_id=? AND staff_user_id=?');$q->execute([$review,$seed['userId']]);$r=$q->fetch(PDO::FETCH_NUM);check((int)$r[0]===1&&$r[1]==='HEART','Reaction retries and switches never duplicate counts');
 $q=$db->prepare('INSERT INTO classroom_review_replies(review_id,body,created_by_staff_user_id) VALUES(?,?,?)');$q->execute([$review,'Rollback-only reply',$seed['userId']]);$id=$db->lastInsertId();$q=$db->prepare('SELECT body FROM classroom_review_replies WHERE id=?');$q->execute([$id]);check($q->fetchColumn()==='Rollback-only reply','Reply saved against real review and staff IDs');
}finally{if($db->inTransaction())$db->rollBack();}
echo "All test writes rolled back.\n";
