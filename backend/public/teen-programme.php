<?php
declare(strict_types=1);

function event_teen_form(PDO $db,int $id):?array {
    if(!api_table_exists($db,'event_teen_forms'))return null;
    $q=$db->prepare('SELECT min_age AS minAge,max_age AS maxAge,rules FROM event_teen_forms WHERE event_id=?');$q->execute([$id]);$row=$q->fetch();
    return $row?['minAge'=>(int)$row['minAge'],'maxAge'=>(int)$row['maxAge'],'rules'=>$row['rules'],'rulesVersion'=>hash('sha256',$row['rules'])]:null;
}
function event_teen_age(string $dob,string $start):int {
    $birth=new DateTimeImmutable(event_date($dob));$day=new DateTimeImmutable(event_date($start));
    if($birth>$day)return -1;return $birth->diff($day)->y;
}
function event_teen_values(array $event,array $form,array $v):array {
    $name=event_text($v['name']??'');$dob=event_date($v['dateOfBirth']??'');$age=event_teen_age($dob,$event['starts_on']);
    if($age<$form['minAge']||$age>$form['maxAge'])api_error('AGE_NOT_ELIGIBLE',"This programme is for boys aged {$form['minAge']}–{$form['maxAge']} on the first programme day.",422);
    if(($v['rulesAccepted']??null)!==true)api_error('RULES_REQUIRED','Please read and agree to the programme rules.',422);
    if(($v['rulesVersion']??'')!==$form['rulesVersion'])api_error('RULES_CHANGED','The programme rules have changed. Refresh the form and review them before submitting.',409);
    if($age<18&&($v['guardianPermission']??null)!==true)api_error('GUARDIAN_PERMISSION_REQUIRED','Please speak with your parent or guardian before registering.',422);
    $guardian=event_text($v['guardianName']??'');$phone=api_phone(event_text($v['guardianPhone']??'',40));if(!$phone)api_error('VALIDATION_ERROR','Enter a valid parent, guardian or emergency contact phone number.',422);
    $teen=$v['whatsapp']??'';if(!is_string($teen)||mb_strlen($teen)>40)api_error('VALIDATION_ERROR','Enter a valid WhatsApp number or leave it blank.',422);$teen=trim($teen);if($teen!==''&&!api_phone($teen))api_error('VALIDATION_ERROR','Enter a valid WhatsApp number or leave it blank.',422);
    return ['name'=>$name,'dob'=>$dob,'age'=>$age,'guardian'=>$guardian,'phone'=>$phone,'school'=>event_text($v['school']??'',180),'schoolClass'=>event_text($v['schoolClass']??'',80),'whatsapp'=>$teen===''?null:api_phone($teen),'guardianPermission'=>$age<18?1:null];
}
function event_teen_register(PDO $db,array $event,array $form,array $v):array {
    $p=event_teen_values($event,$form,$v);$reference=strtoupper(bin2hex(random_bytes(8)));
    // Event-only identity: does not create accounts, children, guardians or families.
    $identity=hash('sha256',mb_strtolower(preg_replace('/\s+/u',' ',$p['name'])).'|'.$p['dob']);
    $db->beginTransaction();try{
        $lock=$db->prepare('SELECT id FROM ministry_events WHERE id=? FOR UPDATE');$lock->execute([$event['id']]);
        $q=$db->prepare('SELECT id FROM event_children WHERE event_id=? AND identity_key=?');$q->execute([$event['id'],$identity]);if($q->fetchColumn()){$db->rollBack();api_error('ALREADY_REGISTERED','A registration with these participant details already exists. Please contact the programme team if you need help.',409);}
        $db->prepare('INSERT INTO event_registrations(event_id,reference_code,guardian_name,guardian_phone,emergency_phone,home_campus) VALUES(?,?,?,?,?,?)')->execute([$event['id'],$reference,$p['guardian'],$p['phone'],$p['phone'],'Not collected']);$rid=(int)$db->lastInsertId();
        $db->prepare("INSERT INTO event_children(event_id,identity_key,registration_id,name,date_of_birth,gender) VALUES(?,?,?,?,?,'MALE')")->execute([$event['id'],$identity,$rid,$p['name'],$p['dob']]);$cid=(int)$db->lastInsertId();
        $db->prepare('INSERT INTO event_teen_registration_details(child_id,school,school_class,whatsapp_number,rules_snapshot,rules_version,guardian_permission_declared) VALUES(?,?,?,?,?,?,?)')->execute([$cid,$p['school'],$p['schoolClass'],$p['whatsapp'],$form['rules'],$form['rulesVersion'],$p['guardianPermission']]);
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();if($e instanceof PDOException&&$e->getCode()==='23000')api_error('ALREADY_REGISTERED','These participant details are already registered. Please contact the programme team.',409);throw $e;}
    return ['referenceCode'=>$reference];
}
function api_event_teen_rules(PDO $db,int $id):never {
    $actor=api_actor($db,true);event_allowed($db,$actor,$id);if(!event_teen_form($db,$id))api_error('EVENT_NOT_FOUND','This programme form is not available.',404);
    $v=api_input();$rules=event_text($v['rules']??'',4000);$db->prepare('UPDATE event_teen_forms SET rules=? WHERE event_id=?')->execute([$rules,$id]);api_audit($db,$actor,'EVENT_RULES_UPDATED','Event',$id);api_ok(event_teen_form($db,$id));
}
function event_teen_details(PDO $db,int $id):array {
    $q=$db->prepare('SELECT c.id,c.name,c.date_of_birth AS dateOfBirth,r.guardian_name AS guardianName,r.guardian_phone AS guardianPhone,r.reference_code AS referenceCode,r.registered_at AS registeredAt,t.school,t.school_class AS schoolClass,t.whatsapp_number AS whatsapp,t.accepted_at AS acceptedAt,t.guardian_permission_declared AS guardianPermissionDeclared FROM event_children c JOIN event_registrations r ON r.id=c.registration_id JOIN event_teen_registration_details t ON t.child_id=c.id WHERE c.event_id=? ORDER BY r.registered_at DESC,c.id DESC');$q->execute([$id]);return $q->fetchAll();
}
