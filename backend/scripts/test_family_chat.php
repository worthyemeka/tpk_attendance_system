<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/config.php';
require dirname(__DIR__).'/public/family-chat.php';
$db=db();$checks=0;
function check(bool $ok,string $name):void {global $checks;if(!$ok)throw new RuntimeException('FAIL: '.$name);$checks++;}
function rejects(callable $action,int $code,string $name):void {try{$action();}catch(DomainException $e){check($e->getCode()===$code,$name);return;}throw new RuntimeException('FAIL: '.$name);}
// Connection-local temporary fixtures shadow real tables: no live staff or family records are touched.
$db->exec('CREATE TEMPORARY TABLE families(id INT PRIMARY KEY,campus_id INT,surname VARCHAR(100))');
$db->exec('CREATE TEMPORARY TABLE children(id INT PRIMARY KEY,family_id INT,first_name VARCHAR(100),last_name VARCHAR(100))');
$db->exec('CREATE TEMPORARY TABLE staff_users(id INT PRIMARY KEY,campus_id INT,name VARCHAR(100),is_active INT,team_status VARCHAR(30),account_status VARCHAR(30),access_level VARCHAR(40))');
$db->exec('CREATE TEMPORARY TABLE notifications(id BIGINT AUTO_INCREMENT PRIMARY KEY,campus_id INT,staff_user_id INT,type VARCHAR(64),category VARCHAR(40),importance VARCHAR(20),title VARCHAR(180),body VARCHAR(500),target_path VARCHAR(255),dedupe_key VARCHAR(190) UNIQUE)');
$source=file_get_contents(__DIR__.'/migrate_family_chat.php');preg_match_all('/\$db->exec\("(CREATE TABLE IF NOT EXISTS .*?)"\);/s',$source,$matches);
foreach($matches[1] as $sql){$sql=str_replace('CREATE TABLE IF NOT EXISTS','CREATE TEMPORARY TABLE',$sql);$sql=preg_replace('/,?\n\s*FOREIGN KEY[^\n]+/','',$sql);$db->exec($sql);}
$db->exec("INSERT INTO families VALUES(1,1,'Example'),(2,2,'Other campus'),(3,1,'Second family')");
$db->exec("INSERT INTO children VALUES(1,1,'Child','Example')");
$db->exec("INSERT INTO staff_users VALUES(1,1,'Teacher One',1,'ACTIVE','VERIFIED','TPK_ADMIN'),(2,1,'Follow Up Lead',1,'ACTIVE','VERIFIED','TPK_FOLLOW_UP_ADMIN'),(3,2,'Other Campus',1,'ACTIVE','VERIFIED','TPK_ADMIN'),(4,1,'Inactive',0,'INACTIVE','VERIFIED','TPK_ADMIN'),(5,1,'Volunteer',1,'ACTIVE','VERIFIED','EVENT_VOLUNTEER')");
$actor=$db->query('SELECT * FROM staff_users WHERE id=1')->fetch();$lead=$db->query('SELECT * FROM staff_users WHERE id=2')->fetch();
check(count(tpk_chat_families($db,$actor,'',1)['families'])===2,'only own campus families');
check(count(tpk_chat_families($db,$actor,'Child Example',1)['families'])===1,'search by child');
check(count(tpk_chat_staff($db,$actor))===2,'only eligible campus recipients');
check((int)tpk_chat_staff($db,$actor)[0]['id']===2,'follow-up lead first');
rejects(fn()=>tpk_chat_history($db,$actor,2),404,'cross-campus history blocked');
rejects(fn()=>tpk_chat_history($db,array_replace($actor,['access_level'=>'EVENT_VOLUNTEER']),1),403,'event-only account blocked');
rejects(fn()=>tpk_chat_history($db,array_replace($actor,['is_active'=>0]),1),403,'inactive sender blocked');
$message=['body'=>"First line\nSecond line <script>literal text</script>",'recipientId'=>2,'clientKey'=>'11111111-1111-4111-8111-111111111111'];
$sent=tpk_chat_send($db,$actor,1,$message);check($sent['created'],'message saved');
$duplicate=tpk_chat_send($db,$actor,1,$message);check(!$duplicate['created']&&$sent['id']===$duplicate['id'],'retry cannot duplicate');
check((int)$db->query('SELECT COUNT(*) FROM notifications')->fetchColumn()===1,'one notification per message');
check($db->query('SELECT target_path FROM notifications')->fetchColumn()==='/account/messages?familyId=1','notification opens exact family');
check(tpk_chat_history($db,$lead,1)['messages'][0]['body']===$message['body'],'newlines and literal text preserved');
rejects(fn()=>tpk_chat_send($db,$actor,3,$message),409,'client key cannot target a different family');
$new=array_replace($message,['clientKey'=>'22222222-2222-4222-8222-222222222222']);
rejects(fn()=>tpk_chat_send($db,$actor,1,array_replace($new,['recipientId'=>3])),422,'cross-campus recipient blocked');
rejects(fn()=>tpk_chat_send($db,$actor,1,array_replace($new,['recipientId'=>4])),422,'inactive recipient blocked');
rejects(fn()=>tpk_chat_send($db,$actor,1,array_replace($new,['recipientId'=>5])),422,'event-only recipient blocked');
rejects(fn()=>tpk_chat_send($db,$actor,1,array_replace($new,['body'=>' '])),422,'empty body blocked');
rejects(fn()=>tpk_chat_send($db,$actor,1,array_replace($new,['body'=>str_repeat('a',4001)])),422,'oversized body blocked');
rejects(fn()=>tpk_chat_send($db,$actor,1,array_replace($new,['clientKey'=>'invalid'])),422,'invalid retry key blocked');
check((int)tpk_chat_families($db,$lead,'Example',1)['families'][0]['unreadCount']===1,'unread count for another teacher');
tpk_chat_mark_read($db,$lead,1,$sent['id']);
check((int)tpk_chat_families($db,$lead,'Example',1)['families'][0]['unreadCount']===0,'reading clears unread count');
rejects(fn()=>tpk_chat_mark_read($db,$lead,3,$sent['id']),422,'cannot mark another family message read');
for($i=0;$i<55;$i++)$db->prepare("INSERT INTO family_chat_messages(family_id,sender_staff_id,recipient_staff_id,sender_name,recipient_name,body,client_key,created_at) VALUES(1,1,2,'Teacher','Lead',?,UUID(),DATE_SUB(NOW(),INTERVAL 1 DAY))")->execute(['History '.$i]);
$latest=tpk_chat_history($db,$actor,1);check(count($latest['messages'])===50&&$latest['hasMore'],'history paginates');
$older=tpk_chat_history($db,$actor,1,(int)$latest['messages'][0]['id']);check(count($older['messages'])===6&&!$older['hasMore'],'older history available without overlap');
$last=(int)$latest['messages'][49]['id'];tpk_chat_mark_read($db,$lead,1,$last);tpk_chat_mark_read($db,$lead,1,$sent['id']);
check((int)$db->query('SELECT last_read_id FROM family_chat_reads')->fetchColumn()===$last,'read cursor cannot move backwards');
for($i=0;$i<29;$i++)$db->prepare("INSERT INTO family_chat_messages(family_id,sender_staff_id,recipient_staff_id,sender_name,recipient_name,body,client_key) VALUES(1,1,2,'Teacher','Lead','Rate fixture',UUID())")->execute();
rejects(fn()=>tpk_chat_send($db,$actor,1,$new),429,'send rate is limited');
echo "$checks family chat checks passed; temporary fixtures only, no real messages or notifications sent.\n";
