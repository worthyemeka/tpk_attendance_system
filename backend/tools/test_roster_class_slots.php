<?php
declare(strict_types=1);
require dirname(__DIR__).'/roster-class-slots.php';
function check_slots(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$classes=[['id'=>2,'name'=>'Tribe A'],['id'=>3,'name'=>'Tribe B'],['id'=>4,'name'=>'Tribe C'],['id'=>1,'name'=>'TribePetra Teens']];
$date='2026-10-11';
check_slots(tpk_roster_unfilled_slots($classes,[$date],[])===11,'All four classes must count as required slots.');
$assignment=['assignmentDate'=>$date,'dutyCode'=>'CLASS_TEACHER','classId'=>1,'status'=>'ASSIGNED'];
check_slots(tpk_roster_unfilled_slots($classes,[$date],[$assignment])===10,'A Teens assignment must fill its own slot.');
check_slots(tpk_roster_unfilled_slots($classes,[$date],[$assignment,$assignment])===10,'Two teachers fill only one class slot.');
check_slots(tpk_roster_unfilled_slots($classes,[$date],[array_merge($assignment,['status'=>'CANCELLED'])])===11,'Cancelled assignments cannot fill a slot.');
check_slots(tpk_roster_unfilled_slots($classes,[$date],[array_merge($assignment,['assignmentDate'=>'2026-10-18'])])===11,'Another date cannot fill this Sunday.');
$classes[3]['name']='Renamed Teens';
check_slots(tpk_roster_unfilled_slots($classes,[$date],[$assignment])===10,'Matching must use class ID, not name.');
check_slots(tpk_roster_unfilled_slots($classes,[],[])===0,'Empty dates have no required slots.');
echo "PASS: Teens and any configured classes included in unfilled totals; class IDs survive renames; duplicate/cancelled/wrong-date assignments handled.\n";
