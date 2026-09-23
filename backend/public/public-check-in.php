<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/config.php';

function checkin_response(mixed $data, int $status = 200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Access-Control-Allow-Origin: ' . (getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000')); header('Access-Control-Allow-Headers: Content-Type'); header('Access-Control-Allow-Methods: POST, OPTIONS'); echo json_encode(['success'=>true,'data'=>$data], JSON_UNESCAPED_SLASHES); exit; }
function checkin_error(string $code,string $message,int $status=400): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['success'=>false,'error'=>['code'=>$code,'message'=>$message]], JSON_UNESCAPED_SLASHES); exit; }
function checkin_input(): array { $value=json_decode(file_get_contents('php://input')?:'{}',true); if(!is_array($value)) checkin_error('INVALID_JSON','Request body must be valid JSON.'); return $value; }
function checkin_phone(?string $value): ?string { $digits=preg_replace('/\D+/','',(string)$value); if(str_starts_with($digits,'234')&&strlen($digits)===13)$digits='0'.substr($digits,3); return strlen($digits)===11&&str_starts_with($digits,'0')?$digits:null; }
function checkin_guardian(PDO $db,string $phone): ?array { foreach($db->query('SELECT id,family_id,phone,secondary_phone FROM guardians')->fetchAll() as $guardian) if(checkin_phone($guardian['phone'])===$phone) return $guardian; return null; }

if(($_SERVER['REQUEST_METHOD']??'GET')==='OPTIONS') checkin_response(null,204);
if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST') checkin_error('METHOD_NOT_ALLOWED','Use POST for check-in.',405);
try {
    $db=db(); $payload=checkin_input(); $phone=checkin_phone($payload['phone']??null); $sessionId=(int)($payload['serviceSessionId']??0); $childIds=array_values(array_unique(array_map('intval',(array)($payload['childIds']??[]))));
    if(!$phone||!$sessionId||!$childIds) checkin_error('VALIDATION_ERROR','Provide a valid phone number, service session and at least one child.',422);
    $session=$db->prepare('SELECT id,campus_id FROM service_sessions WHERE id=? AND is_open=1');$session->execute([$sessionId]);$session=$session->fetch();if(!$session)checkin_error('SERVICE_SESSION_NOT_OPEN','Check-in is not open right now.',409);
    $guardian=checkin_guardian($db,$phone);if(!$guardian)checkin_error('REGISTRATION_NOT_FOUND','We could not find a registration for that phone number.',404);
    $marks=implode(',',array_fill(0,count($childIds),'?'));
    $children=$db->prepare("SELECT c.id,c.class_id,c.first_name,c.last_name FROM children c JOIN child_guardians cg ON cg.child_id=c.id WHERE cg.guardian_id=? AND c.id IN ($marks) AND c.is_active=1");$children->execute(array_merge([(int)$guardian['id']],$childIds));$rows=$children->fetchAll();if(count($rows)!==count($childIds))checkin_error('CHILD_NOT_AUTHORISED','One or more selected children are not linked to this registration.',403);
    $db->beginTransaction();$checked=[];$pending=[];
    foreach($rows as $child){if(!$child['class_id']){$pending[]=['id'=>(int)$child['id'],'firstName'=>$child['first_name'],'lastName'=>$child['last_name']];continue;}$db->prepare("INSERT INTO attendance(service_session_id,child_id,class_id,status,source,is_first_visit) VALUES(?,?,?,'CHECKED_IN','PARENT_QR',0) ON DUPLICATE KEY UPDATE status=status")->execute([(int)$session['id'],(int)$child['id'],(int)$child['class_id']]);$checked[]=['id'=>(int)$child['id'],'firstName'=>$child['first_name'],'lastName'=>$child['last_name']];}
    $pickup=tpk_issue_pickup_code($db,(int)$session['id'],(int)$guardian['family_id'],(int)$guardian['id']);audit($db,(int)$session['campus_id'],'PUBLIC_CHILDREN_CHECKED_IN','ServiceSession',(int)$session['id'],['guardianId'=>(int)$guardian['id'],'childIds'=>$childIds,'pickupCode'=>$pickup['code']]);$db->commit();tpk_send_pickup_code($db,$pickup['id'],[$guardian['phone'],$guardian['secondary_phone']??null],$pickup['code'],$pickup['ticketUrl']);checkin_response(['serviceSessionId'=>(int)$session['id'],'pickupCode'=>$pickup['code'],'pickupTicketUrl'=>$pickup['ticketUrl'],'checkedIn'=>$checked,'classAssignmentRequired'=>$pending]);
} catch(Throwable $exception) { if(isset($db)&&$db->inTransaction())$db->rollBack(); error_log('[TPK public check-in] '.$exception->getMessage());checkin_error('SERVER_ERROR','We could not complete check-in. Please ask a TPK team member for help.',500); }
