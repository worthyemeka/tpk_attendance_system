<?php
declare(strict_types=1);
require __DIR__.'/../public/people-privacy.php';
function assertPrivacy(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
assertPrivacy(api_basic_teacher(['access_level'=>'TPK_ADMIN']),'Teacher directory must be limited');
assertPrivacy(!api_basic_teacher(['access_level'=>'TPK_SUPER_ADMIN']),'Super Admin editing must remain available');
assertPrivacy(!api_basic_teacher(['access_level'=>'TPK_FOLLOW_UP_ADMIN']),'Assigned follow-up contact workflows must remain available');
$data=['name'=>'Sample Child','homeAddress'=>'private','guardian'=>['name'=>'Sample Parent','home_address'=>'private'],'contacts'=>[['houseAddress'=>'private','name'=>'Sample Contact']]];
$safe=api_without_household_addresses($data);
assertPrivacy(!isset($safe['homeAddress'])&&!isset($safe['guardian']['home_address'])&&!isset($safe['contacts'][0]['houseAddress']),'Nested addresses leaked');
assertPrivacy($safe['guardian']['name']==='Sample Parent','Names must be preserved');
if(getenv('TPK_MYSQL_SMOKE')==='1'){
 require (getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__)).'/config.php';
 function api_page():array{return [1,12,0];}
 $db=db();$campus=(int)$db->query('SELECT campus_id FROM families ORDER BY id LIMIT 1')->fetchColumn();$_GET=[];
 $result=api_safe_children($db,['campus_id'=>$campus]);
 foreach($result['rows'] as $row)assertPrivacy(array_keys($row)===['id','name','homeCampusId','homeCampus','guardianName'],'Child allowlist leaked extra fields');
 assertPrivacy($result['meta']['total']>=count($result['rows']),'Pagination total invalid');
 $_GET=['order'=>'desc'];$descending=api_safe_children($db,['campus_id'=>$campus]);
 $expected=$db->prepare('SELECT c.id FROM children c JOIN families f ON f.id=c.family_id WHERE f.campus_id=? AND c.is_active=1 ORDER BY c.first_name DESC,c.last_name DESC,c.id DESC LIMIT 12');$expected->execute([$campus]);
 assertPrivacy(array_map('intval',array_column($descending['rows'],'id'))===array_map('intval',$expected->fetchAll(PDO::FETCH_COLUMN)),'Descending name sorting is inconsistent');
 $_GET=['order'=>'desc; DROP TABLE children'];$invalid=api_safe_children($db,['campus_id'=>$campus]);
 assertPrivacy(array_column($invalid['rows'],'id')===array_column($result['rows'],'id'),'Invalid sorting direction must safely fall back to ascending');
 echo "PASS: read-only child directory SQL allowlist and pagination.\n";
}
echo "PASS: teacher directory policy and nested address redaction.\n";
