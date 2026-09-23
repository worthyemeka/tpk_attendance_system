<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_response([]);
$db = db(); $method = $_SERVER['REQUEST_METHOD']; $path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$campus = $db->query("SELECT id FROM campuses WHERE code='PETRA-WUSE' LIMIT 1")->fetch();
if (!$campus) json_response(['error'=>'Run backend/database/seed.sql first.'],503);
$campusId=(int)$campus['id'];

function teacher_response(array $teacher): array {
  $gender=$teacher['gender'] ?? 'UNSPECIFIED';
  return ['staffUserId'=>(int)$teacher['staff_user_id'],'name'=>trim($teacher['first_name'].' '.$teacher['last_name']),'firstName'=>$teacher['first_name'],'title'=>$gender==='FEMALE'?'Aunty':'Uncle','gender'=>$gender,'accessLevel'=>$teacher['access_level'],'role'=>$teacher['access_level']==='TPK_SUPER_ADMIN'?'TPK Super Admin':'TPK Admin'];
}
if ($method==='POST' && $path==='/api/teachers/register') {
  $v=body(); foreach(['fullName','birthDate','gender','maritalStatus','primaryPhone','email','residentialAddress','emergencyContact','emergencyRelationshipPhone','password'] as $key)if(empty($v[$key]))json_response(['error'=>'Please complete all required teacher details.'],422);
  if(!filter_var($v['email'],FILTER_VALIDATE_EMAIL))json_response(['error'=>'Enter a valid email address.'],422);
  if(!in_array($v['gender'],['FEMALE','MALE'],true))json_response(['error'=>'Select Male or Female.'],422);
  if(strlen((string)$v['password'])<8)json_response(['error'=>'Password must be at least 8 characters.'],422);
  $names=preg_split('/\s+/',trim((string)$v['fullName']),2);$email=strtolower(trim($v['email']));$duplicate=$db->prepare('SELECT id FROM staff_users WHERE email=? LIMIT 1');$duplicate->execute([$email]);if($duplicate->fetch())json_response(['error'=>'An account already exists for this email.'],409);
  $db->beginTransaction();try{$db->prepare("INSERT INTO staff_users(campus_id,name,email,role,access_level,is_active) VALUES(?,?,?,'VIEWER','TPK_ADMIN',0)")->execute([$campusId,trim($v['fullName']),$email]);$staffId=(int)$db->lastInsertId();$db->prepare('INSERT INTO teacher_profiles(staff_user_id,first_name,last_name,birth_date,gender,marital_status,primary_phone,secondary_phone,residential_address,emergency_contact,emergency_relationship_phone,password_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$staffId,$names[0],$names[1]??'',$v['birthDate'],$v['gender'],$v['maritalStatus'],$v['primaryPhone'],$v['secondaryPhone']?:null,$v['residentialAddress'],$v['emergencyContact'],$v['emergencyRelationshipPhone'],password_hash($v['password'],PASSWORD_DEFAULT)]);audit($db,$campusId,'TEACHER_REGISTERED','StaffUser',$staffId,['email'=>$email]);$db->commit();}catch(Throwable $e){$db->rollBack();throw $e;}
  json_response(['message'=>'Registration submitted. A TPK Super Admin will activate your account before you can sign in.'],201);
}
if ($method==='POST' && $path==='/api/teachers/login') {
  $v=body();if(empty($v['email'])||empty($v['password']))json_response(['error'=>'Email and password are required.'],422);
  $s=$db->prepare('SELECT s.id AS staff_user_id,s.is_active,s.access_level,p.first_name,p.last_name,p.gender,p.password_hash FROM staff_users s JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.campus_id=? AND s.email=? LIMIT 1');$s->execute([$campusId,strtolower(trim($v['email']))]);$teacher=$s->fetch();if(!$teacher||!password_verify($v['password'],$teacher['password_hash']))json_response(['error'=>'Incorrect email or password.'],401);if(!(bool)$teacher['is_active'])json_response(['error'=>'Your registration is awaiting TPK Super Admin approval.'],403);json_response(['teacher'=>teacher_response($teacher)]);
}
json_response(['error'=>'Route not found.'],404);
