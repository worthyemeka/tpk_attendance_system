<?php
declare(strict_types=1);

function tpk_notification_due(string $kind, DateTimeImmutable $now): bool {
    return $kind === 'SUNDAY' ? $now->format('N') === '7' && (int)$now->format('G') >= 6 && (int)$now->format('G') < 12 : (int)$now->format('G') >= 8;
}

/** Campus-local dates, one reminder per teacher/day and one birthday greeting per year. */
function tpk_schedule_notifications(PDO $db, ?DateTimeImmutable $clock = null, bool $dryRun = true): array {
    $clock ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $result = ['eligible'=>0, 'created'=>0, 'dryRun'=>$dryRun];
    foreach ($db->query('SELECT id,timezone FROM campuses')->fetchAll(PDO::FETCH_ASSOC) as $campus) {
        try { $zone = new DateTimeZone($campus['timezone'] ?: 'Africa/Lagos'); } catch (Throwable) { continue; }
        $now = $clock->setTimezone($zone); $date = $now->format('Y-m-d');
        $staff = $db->prepare("SELECT s.id,s.name,p.birth_date,COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.title,''),' ',p.first_name,' ',p.last_name)),''),s.name) AS displayName FROM staff_users s JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.campus_id=? AND s.is_active=1 AND s.team_status<>'INACTIVE' AND s.account_status='VERIFIED' AND s.access_level<>'EVENT_VOLUNTEER'");
        $staff->execute([$campus['id']]); $teachers=$staff->fetchAll(PDO::FETCH_ASSOC);
        $notices=[];
        if (tpk_notification_due('SUNDAY',$now)) {
            $sessions=$db->prepare("SELECT MAX(ends_at) FROM service_sessions WHERE campus_id=? AND service_date=? AND is_scheduled=1 AND ends_at>?");
            $sessions->execute([$campus['id'],$date,$now->format('Y-m-d H:i:s')]); $ends=$sessions->fetchColumn();
            if($ends){
                $checked=$db->prepare("SELECT DISTINCT a.staff_user_id FROM teacher_service_attendance a JOIN teacher_services ts ON ts.id=a.service_id WHERE ts.campus_id=? AND ts.kind='SUNDAY' AND DATE(ts.starts_at)=?");$checked->execute([$campus['id'],$date]);$signed=array_map('intval',$checked->fetchAll(PDO::FETCH_COLUMN));
                foreach($teachers as $person){if(in_array((int)$person['id'],$signed,true))continue;
                    $notices[]=['staffUserId'=>(int)$person['id'],'type'=>'SUNDAY_SIGNIN_REMINDER','title'=>'Your Sunday TPK sign-in','body'=>'Good morning! Please sign in to TPK today and check in when you arrive at church.','targetPath'=>'/account/teacher-check-in','dedupeKey'=>'SUNDAY_SIGNIN:'.$person['id'].':'.$date,'payload'=>['serviceDate'=>$date,'expiresAt'=>(new DateTimeImmutable($ends,$zone))->format(DATE_ATOM)]];
                }
            }
        }
        if(tpk_notification_due('BIRTHDAY',$now)){
            foreach($teachers as $birthday){if(substr((string)$birthday['birth_date'],5)!==$now->format('m-d'))continue;
                foreach($teachers as $recipient){$self=(int)$recipient['id']===(int)$birthday['id'];
                    $notices[]=['staffUserId'=>(int)$recipient['id'],'type'=>$self?'BIRTHDAY_GREETING':'TEACHER_BIRTHDAY','title'=>$self?'Happy birthday from your TPK family!':'It’s '.$birthday['displayName'].'’s birthday!','body'=>$self?'We celebrate you and thank God for your life. Wishing you a joyful year ahead.':'Celebrate '.$birthday['displayName'].' today. Open the team profile to send your wishes.','targetPath'=>'/account/team?member='.$birthday['id'],'dedupeKey'=>'TEAM_BIRTHDAY:'.$birthday['id'].':'.$recipient['id'].':'.$date,'payload'=>['birthdayName'=>$birthday['displayName'],'expiresAt'=>$now->modify('tomorrow')->setTime(0,0)->format(DATE_ATOM)]];
                }
            }
        }
        foreach($notices as $notice){$result['eligible']++;if(!$dryRun){$notice['campusId']=(int)$campus['id'];$saved=tpk_create_notification_safe($db,$notice);if($saved['created']??false)$result['created']++;}}
    }
    return $result;
}
