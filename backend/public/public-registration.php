<?php
declare(strict_types=1);

/* Public parent registration/check-in endpoints. No staff account is needed. */
require_once dirname(__DIR__) . '/config.php';

function public_reply(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . (getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000'));
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_SLASHES);
    exit;
}
function public_error(string $code, string $message, int $status = 400): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => ['code' => $code, 'message' => $message]], JSON_UNESCAPED_SLASHES);
    exit;
}
function public_input(): array {
    $value = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($value)) public_error('INVALID_JSON', 'Request body must be valid JSON.');
    return $value;
}
function public_path(): string { return rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/'); }
function public_phone(?string $value): ?string {
    $digits = preg_replace('/\D+/', '', (string)$value);
    if (str_starts_with($digits, '234') && strlen($digits) === 13) $digits = '0' . substr($digits, 3);
    return strlen($digits) === 11 && str_starts_with($digits, '0') ? $digits : null;
}
function public_name(string $value): string { return trim(preg_replace('/\s+/', ' ', $value) ?: ''); }
function public_split_name(string $name): array {
    $parts = preg_split('/\s+/', public_name($name)) ?: [];
    $first = array_shift($parts) ?: '';
    return [$first, implode(' ', $parts) ?: 'Pickup'];
}
function public_current_session(PDO $db, int $campusId): ?array {
    $statement = $db->prepare('SELECT id,campus_id,service_date,service_type,starts_at,ends_at FROM service_sessions WHERE campus_id=? AND is_open=1 ORDER BY starts_at DESC LIMIT 1');
    $statement->execute([$campusId]);
    return $statement->fetch() ?: null;
}
function public_campus(PDO $db): array {
    $row = $db->query('SELECT id,name,code,timezone FROM campuses ORDER BY id LIMIT 1')->fetch();
    if (!$row) public_error('CAMPUS_NOT_CONFIGURED', 'The check-in campus has not been configured.', 503);
    return $row;
}
function public_class_for_child(PDO $db, int $campusId, string $dob): ?int {
    $birth = new DateTimeImmutable($dob);
    $today = new DateTimeImmutable('today', new DateTimeZone('Africa/Lagos'));
    $age = $birth->diff($today)->y;
    $statement = $db->prepare('SELECT id FROM classes WHERE campus_id=? AND is_active=1 AND min_age IS NOT NULL AND max_age IS NOT NULL AND ? BETWEEN min_age AND max_age ORDER BY display_order,id LIMIT 1');
    $statement->execute([$campusId, $age]);
    $id = $statement->fetchColumn();
    return $id === false ? null : (int)$id;
}
function public_find_guardian(PDO $db, string $phone): ?array {
    $rows = $db->query('SELECT id,family_id,phone FROM guardians')->fetchAll();
    foreach ($rows as $row) if (public_phone($row['phone']) === $phone) return $row;
    return null;
}
function public_family_code(PDO $db): string {
    do {
        $code = 'TPK-' . date('Y') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $statement = $db->prepare('SELECT 1 FROM families WHERE family_code=?');
        $statement->execute([$code]);
    } while ($statement->fetchColumn());
    return $code;
}
function public_session_endpoint(PDO $db): never {
    $campus = public_campus($db);
    $session = public_current_session($db, (int)$campus['id']);
    public_reply($session ? ['id' => (int)$session['id'], 'serviceDate' => $session['service_date'], 'serviceType' => $session['service_type'], 'startsAt' => $session['starts_at'], 'endsAt' => $session['ends_at']] : null);
}
function public_registration(PDO $db): never {
    $payload = public_input();
    $campus = public_campus($db);
    $guardian = $payload['guardian'] ?? [];
    $children = $payload['children'] ?? [];
    if (!is_array($guardian) || !is_array($children) || !$children) public_error('VALIDATION_ERROR', 'Provide one or more children and the parent or guardian details.', 422);
    foreach (['firstName', 'lastName', 'relationship'] as $field) if (!public_name((string)($guardian[$field] ?? ''))) public_error('VALIDATION_ERROR', "Guardian $field is required.", 422);
    $phone = public_phone($guardian['primaryPhone'] ?? null);
    if (!$phone) public_error('INVALID_PHONE', 'Enter a valid Nigerian primary phone number.', 422);
    $secondaryPhone = empty($guardian['secondaryPhone']) ? null : public_phone($guardian['secondaryPhone']);
    if (!empty($guardian['secondaryPhone']) && !$secondaryPhone) public_error('INVALID_PHONE', 'Enter a valid Nigerian secondary phone number.', 422);
    $sessionId = isset($payload['serviceSessionId']) ? (int)$payload['serviceSessionId'] : 0;
    $session = $sessionId ? (function () use ($db, $sessionId, $campus) { $s=$db->prepare('SELECT id,campus_id FROM service_sessions WHERE id=? AND campus_id=? AND is_open=1'); $s->execute([$sessionId,$campus['id']]); return $s->fetch() ?: null; })() : public_current_session($db, (int)$campus['id']);
    if (!$session) public_error('SERVICE_SESSION_NOT_OPEN', 'Check-in is not open right now. Please ask a TPK team member for help.', 409);
    $db->beginTransaction();
    try {
        $existing = public_find_guardian($db, $phone);
        if ($existing) {
            $guardianId = (int)$existing['id'];
            $familyId = (int)$existing['family_id'];
            $db->prepare('UPDATE guardians SET first_name=?,last_name=?,phone=?,secondary_phone=?,email=?,relationship=?,is_primary=1,is_authorized=1 WHERE id=?')->execute([public_name($guardian['firstName']),public_name($guardian['lastName']),$phone,$secondaryPhone,trim((string)($guardian['email'] ?? '')) ?: null,public_name($guardian['relationship']),$guardianId]);
            if (isset($guardian['address'])) $db->prepare('UPDATE families SET home_address=? WHERE id=?')->execute([trim((string)$guardian['address']) ?: null,$familyId]);
        } else {
            $surname = public_name((string)$guardian['lastName']);
            $db->prepare('INSERT INTO families(campus_id,family_code,surname,phone,email,home_address) VALUES(?,?,?,?,?,?)')->execute([(int)$campus['id'],public_family_code($db),$surname,$phone,trim((string)($guardian['email'] ?? '')) ?: null,trim((string)($guardian['address'] ?? '')) ?: null]);
            $familyId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO guardians(family_id,first_name,last_name,phone,secondary_phone,email,relationship,is_primary,is_authorized) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$familyId,public_name($guardian['firstName']),public_name($guardian['lastName']),$phone,$secondaryPhone,trim((string)($guardian['email'] ?? '')) ?: null,public_name($guardian['relationship']),1,1]);
            $guardianId = (int)$db->lastInsertId();
        }
        $registered = [];
        foreach ($children as $index => $child) {
            if (!is_array($child)) public_error('VALIDATION_ERROR', 'Each child must be an object.', 422);
            $first = public_name((string)($child['firstName'] ?? '')); $last = public_name((string)($child['lastName'] ?? '')); $dob = (string)($child['dateOfBirth'] ?? '');
            if (!$first || !$last || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) public_error('VALIDATION_ERROR', 'Every child needs a first name, last name and valid date of birth.', 422);
            if ((new DateTimeImmutable($dob)) > new DateTimeImmutable('today')) public_error('VALIDATION_ERROR', 'A child date of birth cannot be in the future.', 422);
            $gender = strtoupper((string)($child['gender'] ?? 'UNSPECIFIED')); if (!in_array($gender, ['MALE','FEMALE','UNSPECIFIED'], true)) public_error('VALIDATION_ERROR', 'Gender must be MALE, FEMALE or UNSPECIFIED.', 422);
            $duplicate = $db->prepare('SELECT id FROM children WHERE family_id=? AND first_name=? AND last_name=? AND date_of_birth=? LIMIT 1'); $duplicate->execute([$familyId,$first,$last,$dob]);
            if ($duplicate->fetchColumn()) public_error('DUPLICATE_CHILD', "$first $last is already registered for this family.", 409);
            $classId = public_class_for_child($db, (int)$campus['id'], $dob);
            $db->prepare('INSERT INTO children(family_id,class_id,first_name,last_name,date_of_birth,gender,medical_notes,is_active,is_first_visit,class_assignment_required,source_system,source_record_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$familyId,$classId,$first,$last,$dob,$gender,null,1,1,$classId ? 0 : 1,'public-parent-registration',date('c') . ':child:' . $index]);
            $childId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO child_guardians(child_id,guardian_id,relationship,is_primary,authorised_pickup) VALUES(?,?,?,?,?)')->execute([$childId,$guardianId,public_name($guardian['relationship']),1,1]);
            $care = trim((string)($child['careInformation'] ?? ''));
            if ($care !== '') $db->prepare('INSERT INTO child_care_profiles(child_id,other_relevant_care_information) VALUES(?,?)')->execute([$childId,$care]);
            $checkedIn = false;
            if ($classId) {
                $db->prepare("INSERT INTO attendance(service_session_id,child_id,class_id,status,source,is_first_visit) VALUES(?,?,?,'CHECKED_IN','PARENT_QR',1) ON DUPLICATE KEY UPDATE status=status")->execute([(int)$session['id'],$childId,$classId]);
                $checkedIn = true;
            }
            $registered[] = ['id'=>$childId,'firstName'=>$first,'lastName'=>$last,'classId'=>$classId,'classAssignmentRequired'=>!$classId,'checkedIn'=>$checkedIn];
        }
        $picker = $payload['pickup'] ?? ['mode' => 'SELF'];
        if (($picker['mode'] ?? 'SELF') === 'OTHER') {
            $pickerPhone = public_phone($picker['phone'] ?? null); $pickerName = public_name((string)($picker['fullName'] ?? '')); $relationship = public_name((string)($picker['relationship'] ?? ''));
            if (!$pickerPhone || !$pickerName || !$relationship) public_error('VALIDATION_ERROR', 'Enter the authorised pickup person’s name, relationship and phone number.', 422);
            [$pickupFirst,$pickupLast] = public_split_name($pickerName);
            $db->prepare('INSERT INTO authorized_pickups(family_id,first_name,last_name,phone,relationship,is_active) VALUES(?,?,?,?,?,1)')->execute([$familyId,$pickupFirst,$pickupLast,$pickerPhone,$relationship]);
        }
        audit($db, (int)$campus['id'], 'PUBLIC_CHILDREN_REGISTERED', 'Family', $familyId, ['guardianId'=>$guardianId,'childIds'=>array_column($registered,'id'),'serviceSessionId'=>(int)$session['id']]);
        $db->commit();
        public_reply(['familyId'=>$familyId,'guardianId'=>$guardianId,'serviceSessionId'=>(int)$session['id'],'pickupCode'=>'TPK-' . strtoupper(bin2hex(random_bytes(3))),'children'=>$registered],201);
    } catch (Throwable $exception) {
        if ($db->inTransaction()) $db->rollBack();
        throw $exception;
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') public_reply(null, 204);
try {
    $db = db(); $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); $path = public_path();
    if ($method === 'GET' && $path === '/api/v1/public/service-session/current') public_session_endpoint($db);
    if ($method === 'POST' && $path === '/api/v1/public/registrations') public_registration($db);
    public_error('ROUTE_NOT_FOUND', 'The requested public API endpoint was not found.', 404);
} catch (PDOException $exception) {
    error_log('[TPK public registration] ' . $exception->getMessage()); public_error('DATA_UNAVAILABLE', 'Registration data is temporarily unavailable. Please ask a TPK team member for help.', 503);
} catch (Throwable $exception) {
    error_log('[TPK public registration] ' . $exception->getMessage()); public_error('SERVER_ERROR', 'We could not complete that request. Please try again or ask a TPK team member for help.', 500);
}
