<?php
$backend=dirname(__DIR__,2).'/backend/public';
require $backend.'/first-timers.php';
class Reply extends Exception {public $data;function __construct($data,$status=200){parent::__construct('', $status);$this->data=$data;}}
function api_actor($db){return $GLOBALS['actor'];}
function api_input(){return $GLOBALS['input'];}
function api_ok($data,$status=200):never{throw new Reply($data,$status);}
function api_error($code,$message,$status=400):never{throw new Reply($code,$status);}
function api_followup_case_allowed($db,$actor,$id){$q=$db->prepare('SELECT owner_staff_user_id AS ownerId FROM follow_up_cases WHERE id=? AND campus_id=?');$q->execute([$id,$actor['campus_id']]);return $q->fetch()?:throw new Reply('NOT_FOUND',404);}
function api_audit(...$args){}
function tpk_create_notification_safe(...$args){}
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
function callApi($callback){try{$callback();}catch(Reply $r){return $r;}throw new RuntimeException('Missing response');}
$code=file_get_contents($backend.'/v1.php');foreach(['api_is_followup_lead','api_followup_assignees','api_assign_followup'] as $name){$a=strpos($code,'function '.$name.'(');$b=strpos($code,"\nfunction ",$a+1);eval(substr($code,$a,$b-$a));}
$admin=new PDO('mysql:host=localhost','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$name='tpk_firsttimer_test_20261125';$admin->exec("CREATE DATABASE $name");
try{
$d=new PDO("mysql:host=localhost;dbname=$name",'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
foreach([
'CREATE TABLE children(id INT PRIMARY KEY,first_name VARCHAR(50),last_name VARCHAR(50))',
'CREATE TABLE classes(id INT PRIMARY KEY,name VARCHAR(50))',
'CREATE TABLE service_sessions(id INT PRIMARY KEY,campus_id INT,name VARCHAR(50),service_date DATE,starts_at DATETIME,service_type VARCHAR(30))',
'CREATE TABLE attendance(id INT PRIMARY KEY,child_id INT,class_id INT,service_session_id INT,status VARCHAR(30))',
'CREATE TABLE staff_users(id INT PRIMARY KEY,campus_id INT,name VARCHAR(50),access_level VARCHAR(40),is_active INT,account_status VARCHAR(30),team_status VARCHAR(30))',
'CREATE TABLE teacher_profiles(staff_user_id INT,title VARCHAR(20),first_name VARCHAR(50),last_name VARCHAR(50),profile_image_url VARCHAR(50))',
'CREATE TABLE follow_up_cases(id INT PRIMARY KEY,campus_id INT,owner_staff_user_id INT,status VARCHAR(30))',
'CREATE TABLE follow_up_tasks(id INT PRIMARY KEY,assigned_to_staff_user_id INT,status VARCHAR(30))',
'CREATE TABLE follow_up_case_children(follow_up_case_id INT,source_task_id INT)',
'CREATE TABLE follow_up_case_events(id INT AUTO_INCREMENT PRIMARY KEY,follow_up_case_id INT,staff_user_id INT,event_type VARCHAR(30),notes TEXT)'
] as $sql)$d->exec($sql);
$d->exec("INSERT INTO children VALUES(1,'First','Test'),(2,'Earlier','Test'),(3,'Second','Test'),(4,'RegisteredOnly','Test'); INSERT INTO classes VALUES(1,'Test Class'); INSERT INTO service_sessions VALUES(1,1,'First','2026-11-01','2026-11-01 09:00:00','FIRST_SERVICE'),(2,1,'Second','2026-11-01','2026-11-01 11:00:00','SECOND_SERVICE'),(3,1,'First','2026-11-08','2026-11-08 09:00:00','FIRST_SERVICE'),(4,1,'Earlier','2026-10-25','2026-10-25 09:00:00','FIRST_SERVICE'),(5,2,'Other campus','2026-11-01','2026-11-01 09:00:00','FIRST_SERVICE'); INSERT INTO attendance VALUES(1,1,1,1,'CHECKED_IN'),(2,1,1,2,'PICKED_UP'),(3,1,1,3,'PICKED_UP'),(4,2,1,4,'CHECKED_IN'),(5,2,1,3,'CHECKED_IN'),(6,3,1,3,'CHECKED_IN'),(7,4,1,1,'ABSENT'),(8,4,1,5,'CHECKED_IN')");
$r=tpk_first_timer_report($d,1,'2026-11-01','2026-12-01');check($r['total']===2,'Monthly unique total');check(array_column($r['weeks'],'count')===[1,1,0,0,0],'Five Sundays, repeat and previous-month visits excluded');check($r['weeks'][0]['serviceDate']==='2026-11-01','Sunday on month boundary');check(tpk_first_timer_report($d,1,'2026-02-01','2026-03-01')['total']===0,'Empty month');check(count(tpk_first_timer_report($d,1,'2026-02-01','2026-03-01')['weeks'])===4,'Four-Sunday month');
$d->exec("INSERT INTO staff_users VALUES(1,1,'Test Lead','TPK_FOLLOW_UP_ADMIN',1,'VERIFIED','ACTIVE'),(2,1,'Test Leader','TPK_SUPER_ADMIN',1,'VERIFIED','ACTIVE'),(3,1,'Inactive','TPK_SUPER_ADMIN',0,'VERIFIED','ACTIVE'),(4,2,'Other campus','TPK_SUPER_ADMIN',1,'VERIFIED','ACTIVE'),(5,1,'Teacher','TPK_ADMIN',1,'VERIFIED','ACTIVE'); INSERT INTO follow_up_cases VALUES(1,1,NULL,'NEEDS_FOLLOW_UP'); INSERT INTO follow_up_tasks VALUES(1,NULL,'OPEN'); INSERT INTO follow_up_case_children VALUES(1,1)");
$GLOBALS['actor']=['id'=>1,'campus_id'=>1,'name'=>'Test Lead','access_level'=>'TPK_FOLLOW_UP_ADMIN'];$GLOBALS['input']=['staffUserId'=>2];
$r=callApi(fn()=>api_followup_assignees($d));check(count($r->data)===3,'Eligible assignees only');$labels=array_column($r->data,'roleLabel','id');check($labels[2]==='Leader'&&$labels[1]==='Follow-Up Lead','Distinct badges');
$r=callApi(fn()=>api_assign_followup($d,1));check($r->getCode()===200,'Lead can assign Super Admin');check((int)$d->query('SELECT owner_staff_user_id FROM follow_up_cases WHERE id=1')->fetchColumn()===2,'Owner persisted');check((int)$d->query('SELECT assigned_to_staff_user_id FROM follow_up_tasks WHERE id=1')->fetchColumn()===2,'Task persisted');check($d->query('SELECT access_level FROM staff_users WHERE id=2')->fetchColumn()==='TPK_SUPER_ADMIN','Role unchanged');
foreach([3,4] as $id){$GLOBALS['input']=['staffUserId'=>$id];check(callApi(fn()=>api_assign_followup($d,1))->getCode()===422,'Ineligible assignee rejected');}
$GLOBALS['actor']['access_level']='TPK_ADMIN';check(callApi(fn()=>api_assign_followup($d,1))->getCode()===403,'Regular teacher cannot assign');
echo "PASS: first Sundays, empty weeks, duplicate visits/services, earlier attendance, campus isolation, registration without attendance, leader badges, lead assigning Super Admin, persisted task and unchanged roles, ineligible assignees and unauthorised actors.\n";
}finally{$admin->exec("DROP DATABASE $name");}
