<?php
declare(strict_types=1);
require __DIR__.'/../registration-eligibility.php';
function ageCheck(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$cases=[['2023-10-06','UNDER_THREE'],['2023-10-05','ELIGIBLE'],['2023-10-04','ELIGIBLE'],['2024-11-19','UNDER_THREE'],['2018-11-19','ELIGIBLE'],['2027-01-01','INVALID_DATE'],['2026-02-30','INVALID_DATE'],['','INVALID_DATE'],['2024-02-29','UNDER_THREE']];
foreach($cases as [$dob,$expected])ageCheck(tpk_registration_eligibility($dob,'2026-10-05')===$expected,$dob);
ageCheck(tpk_registration_eligibility('2024-02-29','2027-02-28')==='UNDER_THREE','Leap-day child before third birthday.');
ageCheck(tpk_registration_eligibility('2024-02-29','2027-03-01')==='ELIGIBLE','Leap-day child after third birthday.');
ageCheck(tpk_registration_age_error([['dateOfBirth'=>'2018-11-19'],['dateOfBirth'=>'2024-11-19']],'2026-10-05')['code']==='CHILD_TOO_YOUNG','Check every sibling.');
ageCheck(tpk_registration_age_error([['dateOfBirth'=>'2023-10-05']],'2026-10-05')===null,'Third birthday is allowed.');

// Execute the actual registration function with no real database. Any attempt
// to start a transaction or mutate data fails this test.
$source=file_get_contents(__DIR__.'/../public/public-registration.php');
$start=strpos($source,'function public_registration(PDO');$end=strpos($source,'function public_pickup_ticket',$start);
eval(substr($source,$start,$end-$start));
function public_input(): array {return ['guardian'=>[],'children'=>[['dateOfBirth'=>'2025-01-01']]];}
function public_campus(PDO $db): array {return ['id'=>1];}
function public_error(string $code,string $message,int $status=400): never {throw new DomainException($code,$status);}
class NoWriteRegistrationDatabase extends PDO {
    public function __construct() {}
    public function beginTransaction(): bool {throw new RuntimeException('Started transaction before age validation.');}
    public function prepare(string $query,array $options=[]): PDOStatement|false {throw new RuntimeException('Database query before age validation: '.$query);}
}
try {public_registration(new NoWriteRegistrationDatabase());throw new RuntimeException('Under-three registration was accepted.');}
catch(DomainException $error){ageCheck($error->getMessage()==='CHILD_TOO_YOUNG'&&$error->getCode()===422,'Return a clear 422 age error before any writes.');}
$staff=file_get_contents(__DIR__.'/../public/v1.php');
foreach(['api_create_child'=>'function api_staff','api_assisted_checkin'=>'function api_pickup_code_lookup'] as $function=>$next){
    $begin=strpos($staff,'function '.$function.'(');$finish=strpos($staff,$next,$begin+1);$body=substr($staff,$begin,$finish===false?null:$finish-$begin);
    $guard=strpos($body,'tpk_registration_age_error');$write=strpos($body,$function==='api_assisted_checkin'?'$db->beginTransaction()':'INSERT INTO children');
    ageCheck($guard!==false&&$write!==false&&$guard<$write,'Staff registration must validate age before writes: '.$function);
}
echo "Registration eligibility API checks passed (16 assertions; no database writes).\n";
