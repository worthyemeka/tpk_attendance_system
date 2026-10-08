<?php
declare(strict_types=1);
require __DIR__.'/../public/people-access.php';
class ReadOnlyPeopleDB extends PDO {public function __construct(){}}
$db=new ReadOnlyPeopleDB();
foreach(['TPK_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_SUPER_ADMIN'] as $role){
 if(!api_can_view_people_directory($db,['access_level'=>$role]))throw new RuntimeException('Teacher directory denied: '.$role);
}
if(api_can_view_people_directory($db,['access_level'=>'EVENT_VOLUNTEER']))throw new RuntimeException('Event account escaped its scope.');
$v=file_get_contents(__DIR__.'/../public/v1.php');
if(str_contains($v,'api_require_people_access(')||str_contains($v,'api_people_record_route('))throw new RuntimeException('Global records restriction remains.');
$events=file_get_contents(__DIR__.'/../public/events.php');
if(str_contains($events,'api_can_view_people_directory('))throw new RuntimeException('Unrequested event restriction remains.');
echo "PASS: all teacher roles have directory read access; event-only accounts remain limited; global restrictions removed.\n";
