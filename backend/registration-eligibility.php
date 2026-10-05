<?php
declare(strict_types=1);

/** Validate before starting transactions or writing any family/child records. */
function tpk_registration_eligibility(string $dob, ?string $today = null): string {
    $zone = new DateTimeZone('Africa/Lagos');
    $today ??= (new DateTimeImmutable('now', $zone))->format('Y-m-d');
    $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $dob, $zone);
    if (!$birth || $birth->format('Y-m-d') !== $dob || $dob > $today) return 'INVALID_DATE';
    $age = (int)substr($today,0,4) - (int)substr($dob,0,4) - (substr($today,5) < substr($dob,5) ? 1 : 0);
    return $age < 3 ? 'UNDER_THREE' : 'ELIGIBLE';
}

function tpk_registration_age_error(array $children, ?string $today = null): ?array {
    foreach ($children as $child) {
        $eligibility = tpk_registration_eligibility(is_array($child) ? (string)($child['dateOfBirth'] ?? '') : '', $today);
        if ($eligibility === 'INVALID_DATE') return ['code'=>'VALIDATION_ERROR','message'=>'Every child needs a valid date of birth that is not in the future.'];
        if ($eligibility === 'UNDER_THREE') return ['code'=>'CHILD_TOO_YOUNG','message'=>'Your child cannot register with TPK yet because they are not three years old. Children can join from their third birthday.'];
    }
    return null;
}
