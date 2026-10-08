<?php
declare(strict_types=1);

/** Sunday codes are valid only on their own service day in campus local time.
 * This is checked on every use, so existing codes expire without a scheduled job
 * or deletion of attendance/history. Event-only sessions retain their own policy.
 */
function tpk_sunday_pickup_state(array $service,?DateTimeImmutable $now=null): array {
    if(empty($service['serviceType']))return ['valid'=>true,'expiresAt'=>null];
    try{$zone=new DateTimeZone((string)($service['timezone']??'Africa/Lagos'));}catch(Throwable){$zone=new DateTimeZone('Africa/Lagos');}
    $value=(string)($service['serviceDate']??'');
    $day=DateTimeImmutable::createFromFormat('!Y-m-d',$value,$zone);
    if(!$day||$day->format('Y-m-d')!==$value||$day->format('N')!=='7')return ['valid'=>false,'expiresAt'=>null];
    $deadline=$day->modify('+1 day');$current=($now??new DateTimeImmutable('now',$zone))->setTimezone($zone);
    return ['valid'=>$current>=$day&&$current<$deadline,'expiresAt'=>$deadline->format(DateTimeInterface::ATOM)];
}
function tpk_pickup_code_state(PDO $db,int $id,?DateTimeImmutable $now=null): array {
    $s=$db->prepare('SELECT ss.service_date AS serviceDate,ss.service_type AS serviceType,cp.timezone FROM service_pickup_codes pc JOIN service_sessions ss ON ss.id=pc.service_session_id JOIN campuses cp ON cp.id=ss.campus_id WHERE pc.id=?');
    $s->execute([$id]);$service=$s->fetch();
    return $service?tpk_sunday_pickup_state($service,$now):['valid'=>false,'expiresAt'=>null];
}
function api_require_valid_pickup_code(PDO $db,int $id): void {
    if(!tpk_pickup_code_state($db,$id)['valid'])api_error('PICKUP_CODE_EXPIRED','This pickup code has expired. Sunday pickup codes can only be used on the Sunday they were issued for.',410);
}
