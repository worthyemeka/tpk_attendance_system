<?php
declare(strict_types=1);
require dirname(__DIR__).'/config.php';
$pdo=db();$base='https://tpk-checkin.vercel.app';$tokens=[];$familyId=0;$childId=0;$guardianId=0;
function edit_request(string $base,string $route,string $method,string $token,array $body,int $expected):array {
    $payload=json_encode($body);$context=stream_context_create(['http'=>['method'=>$method,'header'=>"Authorization: Bearer $token\r\nContent-Type: application/json\r\n",'content'=>$payload,'ignore_errors'=>true,'timeout'=>20]]);
    $raw=file_get_contents($base.$route,false,$context);$status=0;foreach($http_response_header??[] as $header)if(preg_match('/^HTTP\/\S+ (\d+)/',$header,$m))$status=(int)$m[1];
    if($status!==$expected)throw new RuntimeException("$method $route expected $expected, received $status.");
    $data=json_decode($raw?:'',true);if(!is_array($data))throw new RuntimeException('Invalid API response.');return $data;
}
try {
    $staff=$pdo->query("SELECT s.id,s.campus_id,s.access_level FROM staff_users s JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.is_active=1 AND s.account_status='VERIFIED' AND s.team_status<>'INACTIVE' AND s.access_level IN ('TPK_SUPER_ADMIN','TPK_ADMIN') ORDER BY s.id")->fetchAll();
    $users=[];foreach($staff as $row)if(!isset($users[$row['access_level']]))$users[$row['access_level']]=$row;
    if(!isset($users['TPK_SUPER_ADMIN'],$users['TPK_ADMIN']))throw new RuntimeException('Both access levels required for permission verification.');
    foreach($users as $role=>$user){$tokens[$role]=bin2hex(random_bytes(32));$pdo->prepare('INSERT INTO staff_sessions(staff_user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))')->execute([$user['id'],hash('sha256',$tokens[$role])]);}
    $campus=(int)$users['TPK_SUPER_ADMIN']['campus_id'];$code='HTTP-EDIT-TEST-'.bin2hex(random_bytes(6));
    $pdo->prepare('INSERT INTO families(campus_id,family_code,surname) VALUES(?,?,?)')->execute([$campus,$code,'Synthetic edit verification']);$familyId=(int)$pdo->lastInsertId();
    $classId=(int)$pdo->query("SELECT id FROM classes WHERE campus_id=$campus ORDER BY id LIMIT 1")->fetchColumn();
    $pdo->prepare("INSERT INTO children(family_id,class_id,first_name,last_name,date_of_birth,gender) VALUES(?,?,?,?,'2018-01-01','FEMALE')")->execute([$familyId,$classId,'Synthetic','Child']);$childId=(int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO guardians(family_id,first_name,last_name,phone,relationship,is_primary) VALUES(?,?,?,?,'Mother',1)")->execute([$familyId,'Synthetic','Parent','08000000000']);$guardianId=(int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO child_guardians(child_id,guardian_id,is_primary,relationship) VALUES(?,?,1,'Mother')")->execute([$childId,$guardianId]);
    edit_request($base,"/api/v1/children/$childId",'PATCH',$tokens['TPK_SUPER_ADMIN'],['firstName'=>'Saved child','classAssignmentRequired'=>false,'careInformation'=>'Synthetic care note'],200);
    $child=edit_request($base,"/api/v1/children/$childId",'GET',$tokens['TPK_SUPER_ADMIN'],[],200);
    if($child['data']['firstName']!=='Saved child')throw new RuntimeException('Saved child did not persist.');
    $care=edit_request($base,"/api/v1/children/$childId/care-profile",'GET',$tokens['TPK_SUPER_ADMIN'],[],200);
    if($care['data']['other_relevant_care_information']!=='Synthetic care note')throw new RuntimeException('Care note did not persist.');
    edit_request($base,"/api/v1/guardians/$guardianId",'PATCH',$tokens['TPK_SUPER_ADMIN'],['firstName'=>'Saved parent','primaryPhone'=>'08000000000','secondaryPhone'=>null,'email'=>'parent@example.invalid','homeAddress'=>'Synthetic address','authorisedPickup'=>false],200);
    $parent=edit_request($base,"/api/v1/guardians/$guardianId",'GET',$tokens['TPK_SUPER_ADMIN'],[],200);
    if($parent['data']['firstName']!=='Saved parent'||$parent['data']['homeAddress']!=='Synthetic address'||(bool)$parent['data']['authorisedPickup'])throw new RuntimeException('Saved parent did not persist.');
    edit_request($base,"/api/v1/guardians/$guardianId",'PATCH',$tokens['TPK_SUPER_ADMIN'],['primaryPhone'=>'invalid'],422);
    edit_request($base,"/api/v1/children/$childId",'PATCH',$tokens['TPK_ADMIN'],['firstName'=>'Forbidden'],403);
    edit_request($base,"/api/v1/guardians/$guardianId",'PATCH',$tokens['TPK_ADMIN'],['firstName'=>'Forbidden'],403);
    echo "PASS: live Super Admin child/care and parent edits persist; invalid phone rejected; regular teachers cannot edit.\n";
}finally{
    if($childId){$pdo->prepare('DELETE FROM child_guardians WHERE child_id=?')->execute([$childId]);$pdo->prepare('DELETE FROM children WHERE id=? AND family_id=?')->execute([$childId,$familyId]);$pdo->prepare("DELETE FROM audit_logs WHERE entity_type='Child' AND entity_id=? AND action IN ('CHILD_UPDATED','CHILD_PROFILE_UPDATED')")->execute([$childId]);}
    if($guardianId){$pdo->prepare('DELETE FROM guardians WHERE id=? AND family_id=?')->execute([$guardianId,$familyId]);$pdo->prepare("DELETE FROM audit_logs WHERE entity_type='Guardian' AND entity_id=? AND action='GUARDIAN_UPDATED'")->execute([$guardianId]);}
    if($familyId)$pdo->prepare('DELETE FROM families WHERE id=?')->execute([$familyId]);
    foreach($tokens as $token)$pdo->prepare('DELETE FROM staff_sessions WHERE token_hash=?')->execute([hash('sha256',$token)]);
    echo "Synthetic records, audit entries and temporary sessions removed. Real child/parent records unchanged.\n";
}
