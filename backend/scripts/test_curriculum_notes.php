<?php
declare(strict_types=1);
// All writes below are connection-local temporary records, never real event notes.
if(getenv('TPK_MYSQL_SMOKE')!=='1'){echo "Skipped: enable TPK_MYSQL_SMOKE.\n";exit;}
require (getenv('TPK_CONFIG_ROOT')?:dirname(__DIR__)).'/config.php';
require __DIR__.'/../public/curriculum-notes.php';
class NoteError extends RuntimeException{}
class NoteResult extends RuntimeException{public function __construct(public array $data){}}
function api_error(string $code,string $message,int $status=400):never{throw new NoteError($code);}
function api_ok(array $data,int $status=200):never{throw new NoteResult($data);}
function api_actor(PDO $db,bool $super=false):array{if($super&&$GLOBALS['role']!=='TPK_SUPER_ADMIN')api_error('FORBIDDEN','Super required');return ['id'=>1];}
function event_allowed(PDO $db,array $actor,int $event):void{if($event!==42)api_error('EVENT_NOT_FOUND','Wrong campus');}
function api_input():array{return $GLOBALS['input'];}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void{}
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);$GLOBALS['checks']++;}
function rejects(callable $fn,string $code):void{try{$fn();}catch(NoteError $e){check($e->getMessage()===$code,'Wrong error');return;}throw new RuntimeException('Expected rejection');}
$db=db();$checks=0;$role='TPK_SUPER_ADMIN';$before=$db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM event_curriculum_resources)')->fetchColumn();
try{
 $db->exec('CREATE TEMPORARY TABLE event_curriculum_resources(id INT PRIMARY KEY,event_id INT)');$db->exec('INSERT INTO event_curriculum_resources VALUES(1,42),(2,99)');
 $db->exec('CREATE TEMPORARY TABLE event_source_files(id INT PRIMARY KEY,event_id INT,mime_type VARCHAR(100))');$db->exec("INSERT INTO event_source_files VALUES(10,42,'image/png'),(11,99,'image/jpeg'),(12,42,'application/pdf')");
 $db->exec('CREATE TEMPORARY TABLE event_curriculum_blocks(id INT AUTO_INCREMENT PRIMARY KEY,resource_id INT,position INT,block_type VARCHAR(20),text_content TEXT,image_file_id INT,caption VARCHAR(1000),UNIQUE(resource_id,position))');
 $blocks=[['type'=>'heading','text'=>'How to play'],['type'=>'paragraph','text'=>'Form a circle.'],['type'=>'list','text'=>"Ball\nSpace"],['type'=>'image','fileId'=>10,'caption'=>'Ball illustration']];
 $input=['noteBlocks'=>$blocks];try{api_event_curriculum_notes($db,42,1);}catch(NoteResult $r){check(count($r->data['noteBlocks'])===4,'All blocks saved');}
 $saved=event_note_blocks($db,1);check(array_column($saved,'type')===['heading','paragraph','list','image'],'Order preserved');check((int)$saved[3]['fileId']===10,'Protected picture link');
 rejects(fn()=>event_validate_note_blocks($db,42,[['type'=>'image','fileId'=>11]]),'VALIDATION_ERROR');rejects(fn()=>event_validate_note_blocks($db,42,[['type'=>'image','fileId'=>12]]),'VALIDATION_ERROR');
 rejects(fn()=>event_validate_note_blocks($db,42,[['type'=>'html','text'=>'<script>']]),'VALIDATION_ERROR');rejects(fn()=>event_validate_note_blocks($db,42,[['type'=>'paragraph','text'=>['invalid']]]),'VALIDATION_ERROR');rejects(fn()=>event_validate_note_blocks($db,42,array_fill(0,201,['type'=>'paragraph','text'=>'x'])),'VALIDATION_ERROR');
 rejects(fn()=>event_validate_note_blocks($db,42,[['type'=>'heading','text'=>str_repeat('x',181)]]),'VALIDATION_ERROR');rejects(fn()=>event_validate_note_blocks($db,42,[['type'=>'paragraph','text'=>str_repeat('x',100001)]]),'VALIDATION_ERROR');
 $input=['noteBlocks'=>[]];rejects(fn()=>api_event_curriculum_notes($db,42,1),'VALIDATION_ERROR');$input=['noteBlocks'=>$blocks];rejects(fn()=>api_event_curriculum_notes($db,42,2),'NOT_FOUND');
 $role='TPK_ADMIN';rejects(fn()=>api_event_curriculum_notes($db,42,1),'FORBIDDEN');$role='EVENT_VOLUNTEER';rejects(fn()=>api_event_curriculum_notes($db,42,1),'FORBIDDEN');
 check(count(event_note_blocks($db,1))===4,'Failed writes preserve saved sections');echo "PASS: $checks curriculum ordering, validation, cross-event image and edit-permission checks.\n";
}finally{if($db->inTransaction())$db->rollBack();foreach(['event_curriculum_blocks','event_source_files','event_curriculum_resources']as$t)$db->exec('DROP TEMPORARY TABLE IF EXISTS '.$t);}
check($db->query('SELECT (SELECT COUNT(*) FROM children)+(SELECT COUNT(*) FROM event_curriculum_resources)')->fetchColumn()===$before,'Persistent records changed');
