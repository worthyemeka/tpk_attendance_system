<?php
declare(strict_types=1);

/** Authorisation is based on the real campus week, never a UI date or session. */
function api_people_week(DateTimeImmutable $now): array {
    $day=$now->setTime(0,0);$start=$day->modify('-'.((int)$day->format('N')-1).' days');
    return [$start->format('Y-m-d'),$start->modify('+7 days')->format('Y-m-d')];
}
function api_can_view_people_directory(PDO $db,array $actor,?DateTimeImmutable $now=null): bool {
    if(in_array($actor['access_level'],['TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN'],true))return true;
    if($actor['access_level']!=='TPK_ADMIN')return false;
    $zone=$db->prepare('SELECT timezone FROM campuses WHERE id=?');$zone->execute([(int)$actor['campus_id']]);
    $timezone=(string)($zone->fetchColumn()?:'Africa/Lagos');
    try{$tz=new DateTimeZone($timezone);}catch(Throwable){$tz=new DateTimeZone('Africa/Lagos');}
    [$start,$end]=api_people_week(($now??new DateTimeImmutable('now',$tz))->setTimezone($tz));
    $s=$db->prepare("SELECT 1 FROM roster_assignments ra
      JOIN duty_types dt ON dt.id=ra.duty_type_id
      JOIN staff_users staff ON staff.id=ra.user_id AND staff.campus_id=?
      LEFT JOIN service_sessions ss ON ss.id=ra.service_session_id
      WHERE ra.user_id=? AND ra.assignment_date>=? AND ra.assignment_date<?
        AND WEEKDAY(ra.assignment_date)=6
        AND dt.code IN ('HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2')
        AND ra.status NOT IN ('CANCELLED','REPLACED','ABSENT')
        AND (ra.service_session_id IS NULL OR (ss.campus_id=staff.campus_id AND ss.service_date=ra.assignment_date AND ss.service_type IS NOT NULL))
      LIMIT 1");
    $s->execute([(int)$actor['campus_id'],(int)$actor['id'],$start,$end]);return (bool)$s->fetchColumn();
}
function api_require_people_access(PDO $db,array $actor): void {
    if(!api_can_view_people_directory($db,$actor))api_error('PEOPLE_ACCESS_DENIED','Children, guardian and family records are available only to this week’s Heads of Service and assistants, Follow-Up Leads and Super Admins.',403);
}
/** Cover record exports and operational lookups as well as directory pages. */
function api_people_record_route(string $path): bool {
    return (bool)preg_match('#^/api/v1/(?:children|guardians|families|check-ins|check-in-requests|assisted-check-ins|pickup-dashboard|pickup-codes|follow-ups)(?:/|$)#',$path)
      ||(bool)preg_match('#^/api/v1/classes/\d+/children$#',$path)
      ||(bool)preg_match('#^/api/v1/classrooms/\d+(?:/|$)#',$path)
      ||(bool)preg_match('#^/api/v1/classroom-assignments/\d+/children(?:/|$)#',$path);
}
