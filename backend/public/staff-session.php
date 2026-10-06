<?php
declare(strict_types=1);

/** expires_at is the idle deadline. Ordinary authenticated reads never renew it. */
function tpk_staff_session(PDO $db, string $token, bool $activity = false): ?array {
    if (!preg_match('/^[a-f0-9]{64}$/i', $token)) return null;
    $hash = hash('sha256', $token);
    if ($activity) {
        // Check expiry and account eligibility in the same update. An expired or
        // revoked session can never be revived by a late heartbeat.
        $s = $db->prepare("UPDATE staff_sessions ss JOIN staff_users s ON s.id=ss.staff_user_id
            SET ss.expires_at=DATE_ADD(NOW(), INTERVAL 48 HOUR)
            WHERE ss.token_hash=? AND ss.revoked_at IS NULL AND ss.expires_at>NOW()
              AND s.is_active=1 AND s.account_status='VERIFIED' AND s.team_status<>'INACTIVE'");
        $s->execute([$hash]);
    }
    $s = $db->prepare("SELECT s.id AS staff_user_id,s.access_level,s.team_status,p.first_name,p.last_name,p.title,p.gender,p.profile_image_url,
        UNIX_TIMESTAMP(ss.expires_at)*1000 AS expiresAtMs,UNIX_TIMESTAMP(NOW())*1000 AS serverTimeMs
        FROM staff_sessions ss JOIN staff_users s ON s.id=ss.staff_user_id JOIN teacher_profiles p ON p.staff_user_id=s.id
        WHERE ss.token_hash=? AND ss.revoked_at IS NULL AND ss.expires_at>NOW()
          AND s.is_active=1 AND s.account_status='VERIFIED' AND s.team_status<>'INACTIVE' LIMIT 1");
    $s->execute([$hash]);
    return $s->fetch() ?: null;
}

function tpk_staff_session_clock(?array $session): array {
    if (!$session) throw new RuntimeException('Session could not be created.');
    return ['expiresAtMs'=>(int)$session['expiresAtMs'],'serverTimeMs'=>(int)$session['serverTimeMs']];
}
