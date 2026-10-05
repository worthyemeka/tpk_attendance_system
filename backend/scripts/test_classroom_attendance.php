<?php
declare(strict_types=1);

// Exercise the read-only query helper without connecting to or changing a database.
$source=file_get_contents(__DIR__.'/../public/v1.php');
$start=strpos($source,'function api_classroom_monthly_attendance(');
$end=strpos($source,'function api_classroom_detail(',$start);
if($start===false||$end===false)throw new RuntimeException('Attendance helper not found.');
eval(substr($source,$start,$end-$start));

class AttendanceTestStatement extends PDOStatement {
    public array $parameters=[];
    public function __construct(private array $rows) {}
    public function execute(?array $params=null): bool {$this->parameters=$params??[];return true;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return $this->rows;}
}
class AttendanceTestDatabase extends PDO {
    public array $queries=[];
    public array $statements=[];
    public function __construct() {}
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $this->queries[]=$query;
        $rows=count($this->queries)===1
            ? [['id'=>'21','name'=>'First Service','serviceDate'=>'2026-10-04'],['id'=>'22','name'=>'First Service','serviceDate'=>'2026-10-04']]
            : [['service_session_id'=>'21','child_id'=>'101'],['service_session_id'=>'22','child_id'=>'102']];
        $statement=new AttendanceTestStatement($rows);$this->statements[]=$statement;return $statement;
    }
}
function attendanceCheck(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$db=new AttendanceTestDatabase();
$result=api_classroom_monthly_attendance($db,['campus_id'=>5],['id'=>22,'serviceType'=>'FIRST_SERVICE'],'2026-10-01','2026-11-01');
attendanceCheck($result['presentBySession'][21]===[101],'First session attendance must be retained with numeric child IDs.');
attendanceCheck($result['presentBySession'][22]===[102],'Different sessions on the same Sunday must stay separate.');
attendanceCheck($result['presentByDate']['2026-10-04']===[101,102],'Legacy date history must merge rather than overwrite attendance.');
attendanceCheck($db->statements[0]->parameters===[5,'FIRST_SERVICE',22,'2026-10-01','2026-11-01'],'Query must stay scoped to the campus, service and month.');
attendanceCheck(count($db->queries)===2,'Month attendance should use one bulk query rather than one per Sunday.');
attendanceCheck($db->statements[1]->parameters===[21,22],'Bulk attendance must use exactly the returned session IDs.');
echo "Classroom attendance API regression checks passed (6 cases).\n";
