<?php
declare(strict_types=1);

/** Registration is a people-directory operation, never a service arrival. */
function api_registration_family_lookup(PDO $db): never {
    $actor = api_actor($db, true);
    $phone = api_phone($_GET['phone'] ?? null);
    if (!$phone) api_error('VALIDATION_ERROR', 'Enter a complete Nigerian guardian phone number.', 422);
    $query = $db->prepare('SELECT g.id AS guardianId,g.family_id AS familyId,g.first_name AS firstName,g.last_name AS lastName,g.phone,g.secondary_phone,f.surname AS familyName FROM guardians g JOIN families f ON f.id=g.family_id WHERE f.campus_id=? AND f.is_active=1 ORDER BY g.is_primary DESC,g.id');
    $query->execute([$actor['campus_id']]);
    $matches = [];
    foreach ($query->fetchAll() as $row) {
        if (api_phone($row['phone']) !== $phone && api_phone($row['secondary_phone'] ?? null) !== $phone) continue;
        unset($row['phone'], $row['secondary_phone']);
        $matches[] = $row;
    }
    api_ok($matches);
}

function api_register_children(PDO $db): never {
    $actor = api_actor($db, true);
    $input = api_input();
    $familyId = (int)($input['familyId'] ?? 0);
    $guardianId = (int)($input['guardianId'] ?? 0);
    $guardian = $input['guardian'] ?? [];
    $children = $input['children'] ?? [];
    if (!is_array($children) || !$children || count($children) > 20 || !is_array($guardian)) api_error('VALIDATION_ERROR', 'Provide between 1 and 20 children and a parent or guardian.', 422);
    foreach ($children as $child) if (!is_array($child)) api_error('VALIDATION_ERROR', 'Each child needs their own details.', 422);
    if ($ageError = tpk_registration_age_error($children)) api_error($ageError['code'], $ageError['message'], 422);

    $drafts = []; $seen = [];
    foreach ($children as $child) {
        $first = trim((string)($child['firstName'] ?? ''));
        $last = trim((string)($child['lastName'] ?? ''));
        $dob = (string)($child['dateOfBirth'] ?? '');
        $gender = strtoupper(trim((string)($child['gender'] ?? '')));
        $care = trim((string)($child['careInformation'] ?? ''));
        if (!$first || !$last || strlen($first) > 100 || strlen($last) > 100 || !in_array($gender, ['MALE','FEMALE'], true) || strlen($care) > 4000) api_error('VALIDATION_ERROR', 'Complete each child’s name, date of birth and gender. Keep care notes concise.', 422);
        $key = strtolower($first.'|'.$last.'|'.$dob);
        if (isset($seen[$key])) api_error('DUPLICATE_CHILD', "$first $last appears more than once in this registration.", 409);
        $seen[$key] = true;
        // Birth date is authoritative; registration never accepts a manual override.
        {
            $zone = new DateTimeZone('Africa/Lagos');
            $age = (new DateTimeImmutable($dob, $zone))->diff(new DateTimeImmutable('today', $zone))->y;
            $class = $db->prepare('SELECT id FROM classes WHERE campus_id=? AND is_active=1 AND ? BETWEEN min_age AND max_age ORDER BY display_order,id LIMIT 1');
            $class->execute([$actor['campus_id'], $age]);
            $classId = (int)$class->fetchColumn();
            if (!$classId) api_error('CLASS_NOT_AVAILABLE', 'No active class matches this child’s age. Ask a Super Admin to check the class age ranges.', 422);
        }
        $drafts[] = [$first, $last, $dob, $gender, $classId, $care];
    }
    $first = trim((string)($guardian['firstName'] ?? ''));
    $last = trim((string)($guardian['lastName'] ?? ''));
    $relationship = trim((string)($guardian['relationship'] ?? ''));
    $phone = api_phone($guardian['phone'] ?? null);
    $secondary = api_phone($guardian['secondaryPhone'] ?? null);
    $email = trim((string)($guardian['email'] ?? ''));
    $address = trim((string)($guardian['address'] ?? ''));
    if (!$familyId && (!$first || !$last || !$phone || !$relationship || !$address || strlen($first) > 100 || strlen($last) > 100 || strlen($relationship) > 80 || strlen($email) > 254 || strlen($address) > 1000)) api_error('VALIDATION_ERROR', 'Complete the parent’s name, valid Nigerian phone number, relationship and address. Keep contact details concise.', 422);
    if (!$familyId && (($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) || (!empty($guardian['secondaryPhone']) && !$secondary))) api_error('VALIDATION_ERROR', 'Check the optional email address or second phone number.', 422);

    $db->beginTransaction();
    try {
        // Serialize registrations at this campus so repeated requests cannot create duplicate households.
        $lock = $db->prepare('SELECT id FROM campuses WHERE id=? FOR UPDATE');
        $lock->execute([$actor['campus_id']]);
        if ($familyId) {
            $saved = $db->prepare('SELECT g.id FROM guardians g JOIN families f ON f.id=g.family_id WHERE g.id=? AND g.family_id=? AND f.campus_id=? AND f.is_active=1 FOR UPDATE');
            $saved->execute([$guardianId, $familyId, $actor['campus_id']]);
            if (!$saved->fetchColumn()) api_error('FAMILY_NOT_AVAILABLE', 'Choose a saved guardian from an active family at this campus.', 422);
        } else {
            $existing = $db->prepare('SELECT g.phone,g.secondary_phone FROM guardians g JOIN families f ON f.id=g.family_id WHERE f.campus_id=?');
            $existing->execute([$actor['campus_id']]);
            foreach ($existing->fetchAll() as $row) {
                $numbers = array_filter([api_phone($row['phone']), api_phone($row['secondary_phone'] ?? null)]);
                if (in_array($phone, $numbers, true) || ($secondary && in_array($secondary, $numbers, true))) api_error('REGISTERED_FAMILY_FOUND', 'This number is already registered. Choose Existing family to add children without changing its saved details.', 409);
            }
            do {
                $code = 'TPK-'.date('Y').'-'.strtoupper(bin2hex(random_bytes(3)));
                $exists = $db->prepare('SELECT 1 FROM families WHERE family_code=?');
                $exists->execute([$code]);
            } while ($exists->fetchColumn());
            $db->prepare('INSERT INTO families(campus_id,family_code,surname,phone,email,home_address) VALUES(?,?,?,?,?,?)')->execute([$actor['campus_id'],$code,$last,$phone,$email ?: null,$address]);
            $familyId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO guardians(family_id,first_name,last_name,phone,secondary_phone,email,relationship,is_primary,is_authorized) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$familyId,$first,$last,$phone,$secondary ?: null,$email ?: null,$relationship,1,1]);
            $guardianId = (int)$db->lastInsertId();
        }
        $savedGuardian = $db->prepare('SELECT relationship FROM guardians WHERE id=? AND family_id=?');
        $savedGuardian->execute([$guardianId,$familyId]);
        $relationship = (string)$savedGuardian->fetchColumn();
        $registered = [];
        foreach ($drafts as $index => [$childFirst,$childLast,$dob,$gender,$classId,$care]) {
            $duplicate = $db->prepare('SELECT id FROM children WHERE family_id=? AND first_name=? AND last_name=? AND date_of_birth=? LIMIT 1 FOR UPDATE');
            $duplicate->execute([$familyId,$childFirst,$childLast,$dob]);
            if ($duplicate->fetchColumn()) api_error('DUPLICATE_CHILD', "$childFirst $childLast is already registered in this family. No new children were saved.", 409);
            $db->prepare('INSERT INTO children(family_id,class_id,first_name,last_name,date_of_birth,gender,joined_at,is_active,is_first_visit,class_assignment_required,source_system,source_record_key) VALUES(?,?,?,?,?,?,CURDATE(),1,1,0,?,?)')->execute([$familyId,$classId,$childFirst,$childLast,$dob,$gender,'super-admin-registration',date('c').':'.$index]);
            $childId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO child_guardians(child_id,guardian_id,relationship,is_primary,authorised_pickup) VALUES(?,?,?,?,?)')->execute([$childId,$guardianId,$relationship,1,1]);
            if ($care !== '') $db->prepare('INSERT INTO child_care_profiles(child_id,other_relevant_care_information) VALUES(?,?)')->execute([$childId,$care]);
            $registered[] = ['id'=>$childId,'firstName'=>$childFirst,'lastName'=>$childLast,'classId'=>$classId];
        }
        api_audit($db,$actor,'CHILDREN_REGISTERED','Family',$familyId,['guardianId'=>$guardianId,'childIds'=>array_column($registered,'id'),'registrationOnly'=>true]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
    api_ok(['familyId'=>$familyId,'guardianId'=>$guardianId,'children'=>$registered,'registrationOnly'=>true],201);
}
