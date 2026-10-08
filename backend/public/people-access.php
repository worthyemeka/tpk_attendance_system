<?php
declare(strict_types=1);

/** All active, authenticated TPK teachers can read their campus directories.
 * Authentication, campus scoping and Super Admin-only editing remain in v1.php.
 * Event-only volunteer accounts retain their separate limited dashboard.
 */
function api_can_view_people_directory(PDO $db,array $actor): bool {
    return in_array($actor['access_level'],['TPK_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_SUPER_ADMIN'],true);
}
