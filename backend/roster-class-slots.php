<?php
declare(strict_types=1);

/** Count teaching slots from configured class IDs, not a fixed A/B/C name list. */
function tpk_roster_unfilled_slots(array $classes, array $sundays, array $assignments): int {
    $slots=[['code'=>'FIRST_SERVICE_TEAM']];
    foreach($classes as $class)$slots[]=['code'=>'CLASS_TEACHER','classId'=>(int)$class['id']];
    foreach(['TEACHER_AT_DOOR','ASSEMBLY','ATTENDANCE','HEAD_OF_SERVICE','ASSISTANT_HEAD_OF_SERVICE_1','ASSISTANT_HEAD_OF_SERVICE_2'] as $code)$slots[]=['code'=>$code];
    $unfilled=0;
    foreach($sundays as $date)foreach($slots as $slot){
        $filled=false;
        foreach($assignments as $row){
            if(in_array($row['status']??'', ['CANCELLED','REPLACED'],true))continue;
            if($row['assignmentDate']===$date && $row['dutyCode']===$slot['code'] && (!isset($slot['classId']) || (int)($row['classId']??0)===$slot['classId'])){$filled=true;break;}
        }
        if(!$filled)$unfilled++;
    }
    return $unfilled;
}
