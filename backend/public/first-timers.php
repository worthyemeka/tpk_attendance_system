<?php
declare(strict_types=1);

/** First recorded Sunday attendance, once per child and campus (not registration date). */
function tpk_first_timer_report(PDO $db, int $campus, string $start, string $end): array {
    $query=$db->prepare("SELECT c.id AS childId,c.first_name AS firstName,c.last_name AS lastName,
        COALESCE(cl.name,'Class pending') AS className,ss.name AS serviceName,ss.service_date AS firstVisitDate
        FROM attendance a JOIN service_sessions ss ON ss.id=a.service_session_id
        JOIN children c ON c.id=a.child_id LEFT JOIN classes cl ON cl.id=a.class_id
        WHERE ss.campus_id=? AND ss.service_date>=? AND ss.service_date<?
        AND DAYOFWEEK(ss.service_date)=1 AND ss.service_type IS NOT NULL
        AND a.status IN ('CHECKED_IN','PICKUP_REQUESTED','PICKED_UP')
        AND a.id=(SELECT earlier.id FROM attendance earlier JOIN service_sessions es ON es.id=earlier.service_session_id
            WHERE earlier.child_id=a.child_id AND es.campus_id=ss.campus_id
            AND es.service_type IS NOT NULL AND DAYOFWEEK(es.service_date)=1
            AND earlier.status IN ('CHECKED_IN','PICKUP_REQUESTED','PICKED_UP')
            ORDER BY es.service_date,es.starts_at,earlier.id LIMIT 1)
        ORDER BY ss.service_date,c.first_name,c.last_name,c.id");
    $query->execute([$campus,$start,$end]);$rows=$query->fetchAll(PDO::FETCH_ASSOC);
    $zone=new DateTimeZone('Africa/Lagos');$today=new DateTimeImmutable('today',$zone);
    $day=new DateTimeImmutable($start,$zone);if($day->format('w')!=='0')$day=$day->modify('next Sunday');
    $weeks=[];
    for($week=1;$day->format('Y-m-d')<$end;$day=$day->modify('+7 days'),$week++) {
        $date=$day->format('Y-m-d');$items=array_values(array_filter($rows,static fn($row)=>$row['firstVisitDate']===$date));
        $weeks[]=['week'=>$week,'serviceDate'=>$date,'count'=>count($items),'upcoming'=>$day>$today,'children'=>$items];
    }
    return ['month'=>substr($start,0,7),'total'=>count($rows),'weeks'=>$weeks];
}
