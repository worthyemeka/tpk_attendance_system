<?php
declare(strict_types=1);

/** A shared campus-staff conversation per family; never a parent/public endpoint. */
function tpk_chat_require_staff(array $actor): void {
    if (!(bool)($actor['is_active']??false) || ($actor['account_status']??'')!=='VERIFIED'
        || ($actor['team_status']??'')==='INACTIVE'
        || !in_array($actor['access_level']??'', ['TPK_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_SUPER_ADMIN'],true)) {
        throw new DomainException('Sign in with an active TPK teacher account to use family chat.',403);
    }
}

function tpk_chat_family(PDO $db,array $actor,int $id): array {
    tpk_chat_require_staff($actor);
    $q=$db->prepare('SELECT id,surname AS name FROM families WHERE id=? AND campus_id=?');
    $q->execute([$id,$actor['campus_id']]);
    $family=$q->fetch();
    if(!$family)throw new DomainException('This family conversation is not available.',404);
    return $family;
}

function tpk_chat_staff(PDO $db,array $actor): array {
    tpk_chat_require_staff($actor);
    $q=$db->prepare("SELECT id,name,access_level AS role FROM staff_users WHERE campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' AND access_level IN ('TPK_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_SUPER_ADMIN') ORDER BY access_level='TPK_FOLLOW_UP_ADMIN' DESC,name,id");
    $q->execute([$actor['campus_id']]);return $q->fetchAll();
}

function tpk_chat_families(PDO $db,array $actor,string $search,int $page): array {
    tpk_chat_require_staff($actor);
    $search=mb_substr(trim($search),0,100);$page=max(1,min(1000000,$page));$offset=($page-1)*40;
    $where='f.campus_id=?';$params=[$actor['campus_id']];
    if($search!==''){$where.=" AND (f.surname LIKE ? OR EXISTS(SELECT 1 FROM children c WHERE c.family_id=f.id AND CONCAT(c.first_name,' ',c.last_name) LIKE ?))";array_push($params,'%'.$search.'%','%'.$search.'%');}
    $q=$db->prepare("SELECT COUNT(*) FROM families f WHERE $where");$q->execute($params);$total=(int)$q->fetchColumn();
    $staffId=(int)$actor['id'];
    $q=$db->prepare("SELECT f.id,f.surname AS name,MAX(m.id) AS lastId,
      SUM(CASE WHEN m.sender_staff_id<>$staffId AND m.id>COALESCE(r.last_read_id,0) THEN 1 ELSE 0 END) AS unreadCount
      FROM families f LEFT JOIN family_chat_messages m ON m.family_id=f.id
      LEFT JOIN family_chat_reads r ON r.family_id=f.id AND r.staff_user_id=$staffId
      WHERE $where GROUP BY f.id,f.surname,r.last_read_id ORDER BY lastId DESC,f.surname,f.id LIMIT 40 OFFSET $offset");
    $q->execute($params);$families=$q->fetchAll();$last=[];
    $ids=array_values(array_filter(array_column($families,'lastId')));
    if($ids){$marks=implode(',',array_fill(0,count($ids),'?'));$q=$db->prepare("SELECT id,body,sender_name,UNIX_TIMESTAMP(created_at) AS sentAt FROM family_chat_messages WHERE id IN ($marks)");$q->execute($ids);foreach($q->fetchAll() as $row)$last[$row['id']]=$row;}
    foreach($families as &$family){$message=$last[$family['lastId']]??[];$family['lastMessage']=$message['body']??null;$family['lastSender']=$message['sender_name']??null;$family['lastSentAt']=$message['sentAt']??null;unset($family['lastId']);}unset($family);
    return ['families'=>$families,'total'=>$total,'page'=>$page,'pageSize'=>40];
}

function tpk_chat_history(PDO $db,array $actor,int $familyId,int $before=0): array {
    $family=tpk_chat_family($db,$actor,$familyId);
    $q=$db->prepare('SELECT id,sender_staff_id AS senderId,recipient_staff_id AS recipientId,sender_name AS senderName,recipient_name AS recipientName,body,client_key AS clientKey,UNIX_TIMESTAMP(created_at) AS sentAt FROM family_chat_messages WHERE family_id=?'.($before>0?' AND id<?':'').' ORDER BY id DESC LIMIT 51');
    $q->execute($before>0?[$familyId,$before]:[$familyId]);$rows=$q->fetchAll();$hasMore=count($rows)>50;
    if($hasMore)array_pop($rows);
    return ['family'=>$family,'messages'=>array_reverse($rows),'hasMore'=>$hasMore];
}

function tpk_chat_send(PDO $db,array $actor,int $familyId,array $input): array {
    tpk_chat_family($db,$actor,$familyId);
    if(!is_string($input['body']??null)||!is_string($input['clientKey']??null)||!is_scalar($input['recipientId']??null))throw new DomainException('Choose a teacher and write a message.',422);
    $body=trim((string)($input['body']??''));$key=(string)($input['clientKey']??'');$recipientId=(int)($input['recipientId']??0);
    if($body===''||mb_strlen($body)>4000||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i',$key))throw new DomainException('Write a message of up to 4,000 characters and try again.',422);
    $db->beginTransaction();
    try {
        // Serialise sends from one teacher so retries and the rate limit are race-safe.
        $q=$db->prepare('SELECT id FROM staff_users WHERE id=? FOR UPDATE');$q->execute([$actor['id']]);
        $q=$db->prepare('SELECT id,family_id,recipient_staff_id,body FROM family_chat_messages WHERE sender_staff_id=? AND client_key=?');$q->execute([$actor['id'],$key]);$existing=$q->fetch();
        if($existing){
            if((int)$existing['family_id']!==$familyId||(int)$existing['recipient_staff_id']!==$recipientId||$existing['body']!==$body)throw new DomainException('This message attempt has changed. Please refresh and try again.',409);
            $db->commit();return ['id'=>(int)$existing['id'],'created'=>false];
        }
        $q=$db->prepare("SELECT id,name FROM staff_users WHERE id=? AND campus_id=? AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' AND access_level IN ('TPK_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_SUPER_ADMIN')");$q->execute([$recipientId,$actor['campus_id']]);$recipient=$q->fetch();
        if(!$recipient||$recipientId===(int)$actor['id'])throw new DomainException('Choose another active teacher in your campus.',422);
        $q=$db->prepare('SELECT COUNT(*) FROM family_chat_messages WHERE sender_staff_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE)');$q->execute([$actor['id']]);
        if((int)$q->fetchColumn()>=30)throw new DomainException('Please wait a minute before sending another message.',429);
        $q=$db->prepare('INSERT INTO family_chat_messages(family_id,sender_staff_id,recipient_staff_id,sender_name,recipient_name,body,client_key) VALUES(?,?,?,?,?,?,?)');
        $q->execute([$familyId,$actor['id'],$recipientId,mb_substr($actor['name'],0,180),mb_substr($recipient['name'],0,180),$body,$key]);$id=(int)$db->lastInsertId();
        // Chats notify the addressed teacher in-app only, with no family details in the preview.
        $q=$db->prepare("INSERT INTO notifications(campus_id,staff_user_id,type,category,importance,title,body,target_path,dedupe_key) VALUES(?,?,'FAMILY_CHAT_MESSAGE','SYSTEM','INFO','New family chat message',?,?,?)");
        $q->execute([$actor['campus_id'],$recipientId,$actor['name'].' sent you a message in a family conversation.','/account/messages?familyId='.$familyId,'FAMILY_CHAT:'.$id.':'.$recipientId]);
        $db->commit();return ['id'=>$id,'created'=>true];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

function tpk_chat_mark_read(PDO $db,array $actor,int $familyId,int $lastId): void {
    tpk_chat_family($db,$actor,$familyId);
    $q=$db->prepare('SELECT id FROM family_chat_messages WHERE id=? AND family_id=?');$q->execute([$lastId,$familyId]);
    if(!$q->fetchColumn())throw new DomainException('This message is not in the selected conversation.',422);
    $db->prepare('INSERT INTO family_chat_reads(family_id,staff_user_id,last_read_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE last_read_id=GREATEST(last_read_id,VALUES(last_read_id))')->execute([$familyId,$actor['id'],$lastId]);
}

function api_family_chat(PDO $db,string $action,int $familyId=0): never {
    $actor=api_actor($db);
    try {
        if($action==='list')api_ok(tpk_chat_families($db,$actor,(string)($_GET['search']??''),(int)($_GET['page']??1)));
        if($action==='staff')api_ok(tpk_chat_staff($db,$actor));
        if($action==='history')api_ok(tpk_chat_history($db,$actor,$familyId,max(0,(int)($_GET['before']??0))));
        if($action==='send')api_ok(tpk_chat_send($db,$actor,$familyId,api_input()));
        if($action==='read'){tpk_chat_mark_read($db,$actor,$familyId,(int)(api_input()['lastMessageId']??0));api_ok(['read'=>true]);}
    }catch(DomainException $e){api_error('CHAT_UNAVAILABLE',$e->getMessage(),$e->getCode()?:422);}
    api_error('NOT_FOUND','This chat action is not available.',404);
}
