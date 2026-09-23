<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_response([]);
$db = db();
$method = $_SERVER['REQUEST_METHOD'];
$path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$campus = $db->query("SELECT id FROM campuses WHERE code='PETRA-WUSE' LIMIT 1")->fetch();
if (!$campus) json_response(['error' => 'The Petra Wuse campus has not been configured.'], 503);
$campusId = (int)$campus['id'];

function teacher_input(): array { return $_POST ?: body(); }
function teacher_request_origin(): string {
    return rtrim(getenv('TPK_FRONTEND_URL') ?: (getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000'), '/');
}
function teacher_response(array $teacher): array {
    return ['staffUserId' => (int)$teacher['staff_user_id'], 'name' => trim($teacher['first_name'] . ' ' . $teacher['last_name']), 'firstName' => $teacher['first_name'], 'lastName' => $teacher['last_name'], 'title' => $teacher['title'] ?: (($teacher['gender'] ?? '') === 'FEMALE' ? 'Aunty' : 'Uncle'), 'accessLevel' => $teacher['access_level'], 'teamStatus' => $teacher['team_status'], 'profileImageUrl' => $teacher['profile_image_url'] ?? null, 'role' => $teacher['access_level'] === 'TPK_SUPER_ADMIN' ? 'TPK Super Admin' : 'TPK Admin'];
}
function teacher_issue_session(PDO $db, int $staffId): string {
    $token = bin2hex(random_bytes(32));
    $db->prepare('DELETE FROM staff_sessions WHERE staff_user_id=? AND (expires_at < NOW() OR revoked_at IS NOT NULL)')->execute([$staffId]);
    $db->prepare('INSERT INTO staff_sessions(staff_user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(), INTERVAL 12 HOUR))')->execute([$staffId, hash('sha256', $token)]);
    return $token;
}
function teacher_issue_verification(PDO $db, int $staffId, string $whatsapp, string $name): ?string {
    $code = (string)random_int(100000, 999999);
    $db->prepare('UPDATE staff_whatsapp_verifications SET used_at=COALESCE(used_at,NOW()) WHERE staff_user_id=? AND used_at IS NULL')->execute([$staffId]);
    $db->prepare('INSERT INTO staff_whatsapp_verifications(staff_user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(), INTERVAL 10 MINUTE))')->execute([$staffId, hash('sha256', $code)]);
    tpk_send_whatsapp_verification($whatsapp, $name, $code);
    return tpk_app_environment() === 'development' ? $code : null;
}

if ($method === 'POST' && $path === '/api/teachers/register') {
    $v = teacher_input();
    foreach (['title','firstName','lastName','birthDate','whatsappNumber','email','password','confirmPassword'] as $key) if (empty(trim((string)($v[$key] ?? '')))) json_response(['error' => 'Please complete all required registration details.'], 422);
    if (!in_array($v['title'], ['Aunty', 'Uncle'], true)) json_response(['error' => 'Choose Aunty or Uncle.'], 422);
    if ($v['password'] !== $v['confirmPassword']) json_response(['error' => 'Your passwords do not match.'], 422);
    if (strlen((string)$v['password']) < 8) json_response(['error' => 'Password must be at least 8 characters.'], 422);
    $whatsapp = tpk_normalize_nigerian_phone($v['whatsappNumber']);
    $mobile = empty(trim((string)($v['mobileNumber'] ?? ''))) ? $whatsapp : tpk_normalize_nigerian_phone($v['mobileNumber']);
    if (!$whatsapp || !$mobile) json_response(['error' => 'Enter valid Nigerian WhatsApp and mobile numbers.'], 422);
    if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) json_response(['error' => 'Enter a valid email address.'], 422);
    $email = strtolower(trim($v['email']));
    $existing = $db->prepare('SELECT s.id FROM staff_users s LEFT JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.email=? OR p.whatsapp_number_normalized=? LIMIT 1');
    $existing->execute([$email, $whatsapp]);
    if ($existing->fetch()) json_response(['error' => 'An account already exists for this email address or WhatsApp number.'], 409);
    $db->beginTransaction();
    try {
        $name = trim($v['firstName'] . ' ' . $v['lastName']);
        $db->prepare("INSERT INTO staff_users(campus_id,name,email,role,access_level,team_status,account_status,is_active) VALUES(?,?,?,'VIEWER','TPK_ADMIN','ACTIVE','PENDING_VERIFICATION',0)")->execute([$campusId, $name, $email]);
        $staffId = (int)$db->lastInsertId(); $gender = $v['title'] === 'Aunty' ? 'FEMALE' : 'MALE';
        $db->prepare('INSERT INTO teacher_profiles(staff_user_id,title,first_name,last_name,birth_date,gender,marital_status,primary_phone,secondary_phone,residential_address,emergency_contact,emergency_relationship_phone,password_hash,whatsapp_number,whatsapp_number_normalized,mobile_number,mobile_number_normalized) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$staffId, $v['title'], trim($v['firstName']), trim($v['lastName']), $v['birthDate'], $gender, 'Not provided', $whatsapp, $mobile === $whatsapp ? null : $mobile, 'Not provided', 'Not provided', 'Not provided', password_hash($v['password'], PASSWORD_DEFAULT), $whatsapp, $whatsapp, $mobile === $whatsapp ? null : $mobile, $mobile === $whatsapp ? null : $mobile]);
        if (!empty($_FILES['profilePhoto']) && ($_FILES['profilePhoto']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) $db->prepare('UPDATE teacher_profiles SET profile_image_url=? WHERE staff_user_id=?')->execute([tpk_store_profile_photo($_FILES['profilePhoto'], $staffId), $staffId]);
        $developmentUrl = teacher_issue_verification($db, $staffId, $whatsapp, $name);
        audit($db, $campusId, 'TEACHER_REGISTERED', 'StaffUser', $staffId, ['email' => $email]);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    $response = ['message' => 'We sent a verification code to your WhatsApp number. Enter it to activate your account.'];
    if ($developmentUrl) $response['developmentVerificationCode'] = $developmentUrl;
    json_response($response, 201);
}

if ($method === 'POST' && $path === '/api/teachers/verify') {
    $v = teacher_input(); $email = strtolower(trim((string)($v['email'] ?? ''))); $code = trim((string)($v['code'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $code)) json_response(['error' => 'Enter the email address and six-digit WhatsApp code.'], 422);
    $s = $db->prepare('SELECT v.id,v.staff_user_id,su.campus_id FROM staff_whatsapp_verifications v JOIN staff_users su ON su.id=v.staff_user_id WHERE su.email=? AND v.token_hash=? AND v.used_at IS NULL AND v.expires_at>NOW() LIMIT 1');
    $s->execute([$email, hash('sha256', $code)]); $verification = $s->fetch();
    if (!$verification) json_response(['error' => 'That code is invalid or expired.'], 422);
    $bootstrap = $db->prepare('SELECT p.whatsapp_number_normalized FROM teacher_profiles p WHERE p.staff_user_id=?'); $bootstrap->execute([(int)$verification['staff_user_id']]); $whatsapp = $bootstrap->fetchColumn();
    $accessQuery = $db->prepare('SELECT access_level FROM staff_bootstrap_access WHERE whatsapp_number_normalized=? LIMIT 1'); $accessQuery->execute([$whatsapp]); $access = $accessQuery->fetchColumn() ?: 'TPK_ADMIN';
    $db->beginTransaction();
    try {
        $db->prepare('UPDATE staff_whatsapp_verifications SET used_at=NOW() WHERE id=? AND used_at IS NULL')->execute([(int)$verification['id']]);
        $db->prepare("UPDATE staff_users SET account_status='VERIFIED',is_active=1,access_level=? WHERE id=?")->execute([$access, (int)$verification['staff_user_id']]);
        $db->prepare('UPDATE teacher_profiles SET whatsapp_verified_at=NOW() WHERE staff_user_id=?')->execute([(int)$verification['staff_user_id']]);
        audit($db, (int)$verification['campus_id'], 'TEACHER_WHATSAPP_VERIFIED', 'StaffUser', (int)$verification['staff_user_id'], ['accessLevel' => $access]);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    json_response(['message' => 'Account verified.']);
}

if ($method === 'GET' && $path === '/api/teachers/verify') {
    $token = (string)($_GET['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) json_response(['error' => 'This verification link is invalid.'], 422);
    $s = $db->prepare('SELECT v.id,v.staff_user_id,p.whatsapp_number_normalized,su.campus_id FROM staff_whatsapp_verifications v JOIN teacher_profiles p ON p.staff_user_id=v.staff_user_id JOIN staff_users su ON su.id=v.staff_user_id WHERE v.token_hash=? AND v.used_at IS NULL AND v.expires_at>NOW() LIMIT 1');
    $s->execute([hash('sha256', $token)]); $verification = $s->fetch();
    if (!$verification) json_response(['error' => 'This verification link has expired or was already used.'], 410);
    $bootstrap = $db->prepare('SELECT access_level FROM staff_bootstrap_access WHERE whatsapp_number_normalized=? LIMIT 1'); $bootstrap->execute([$verification['whatsapp_number_normalized']]);
    $access = $bootstrap->fetchColumn() ?: 'TPK_ADMIN';
    $db->beginTransaction();
    try {
        $db->prepare('UPDATE staff_whatsapp_verifications SET used_at=NOW() WHERE id=? AND used_at IS NULL')->execute([$verification['id']]);
        $db->prepare("UPDATE staff_users SET account_status='VERIFIED',is_active=1,access_level=? WHERE id=?")->execute([$access, $verification['staff_user_id']]);
        $db->prepare('UPDATE teacher_profiles SET whatsapp_verified_at=NOW() WHERE staff_user_id=?')->execute([$verification['staff_user_id']]);
        audit($db, (int)$verification['campus_id'], 'TEACHER_WHATSAPP_VERIFIED', 'StaffUser', (int)$verification['staff_user_id'], ['accessLevel' => $access]);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    json_response(['message' => 'Account verified. Your TribePetra Kids account is ready.']);
}

if ($method === 'POST' && $path === '/api/teachers/login') {
    $v = teacher_input(); $identifier = trim((string)($v['identifier'] ?? $v['email'] ?? ''));
    if ($identifier === '' || empty($v['password'])) json_response(['error' => 'Email or WhatsApp number and password are required.'], 422);
    $phone = tpk_normalize_nigerian_phone($identifier);
    $s = $db->prepare('SELECT s.id AS staff_user_id,s.is_active,s.account_status,s.access_level,s.team_status,p.first_name,p.last_name,p.title,p.gender,p.profile_image_url,p.password_hash FROM staff_users s JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.campus_id=? AND (s.email=? OR p.whatsapp_number_normalized=?) LIMIT 1');
    $s->execute([$campusId, strtolower($identifier), $phone ?: '']); $teacher = $s->fetch();
    if (!$teacher || !password_verify($v['password'], $teacher['password_hash'])) json_response(['error' => 'Incorrect email, WhatsApp number, or password.'], 401);
    if ($teacher['account_status'] !== 'VERIFIED') json_response(['error' => 'Verify your WhatsApp number before signing in.'], 403);
    if (!(bool)$teacher['is_active'] || $teacher['team_status'] === 'INACTIVE') json_response(['error' => 'This team account is inactive. Please speak with a TPK Super Admin.'], 403);
    json_response(['teacher' => teacher_response($teacher), 'sessionToken' => teacher_issue_session($db, (int)$teacher['staff_user_id'])]);
}

if ($method === 'POST' && $path === '/api/teachers/logout') {
    $token = preg_replace('/^Bearer\s+/i', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($token) $db->prepare('UPDATE staff_sessions SET revoked_at=NOW() WHERE token_hash=?')->execute([hash('sha256', $token)]);
    json_response(['message' => 'Signed out.']);
}

json_response(['error' => 'Route not found.'], 404);
