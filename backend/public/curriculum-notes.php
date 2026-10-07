<?php
declare(strict_types=1);
function event_note_blocks(PDO $db,int $resource):array {
 $q=$db->prepare('SELECT block_type AS type,text_content AS text,image_file_id AS fileId,caption FROM event_curriculum_blocks WHERE resource_id=? ORDER BY position');$q->execute([$resource]);return $q->fetchAll();
}
function event_validate_note_blocks(PDO $db,int $event,$blocks):array {
 if(!is_array($blocks)||count($blocks)>200||array_keys($blocks)!==range(0,count($blocks)-1)&&$blocks!==[])api_error('VALIDATION_ERROR','Use up to 200 ordered note sections.',422);
 $clean=[];$total=0;
 foreach($blocks as $block){if(!is_array($block)||!in_array($block['type']??'', ['heading','paragraph','list','image'],true))api_error('VALIDATION_ERROR','Choose a valid note section.',422);
  $kind=$block['type'];$text=$block['text']??'';$caption=$block['caption']??'';if(!is_string($text)||!is_string($caption))api_error('VALIDATION_ERROR','Note text must be plain text.',422);
  $text=trim($text);$caption=trim($caption);$total+=strlen($text)+strlen($caption);if($total>100000||strlen($caption)>1000||($kind==='heading'&&mb_strlen($text)>180))api_error('VALIDATION_ERROR','Keep notes under 100,000 characters and headings under 180.',422);
  $file=null;if($kind==='image'){$file=filter_var($block['fileId']??0,FILTER_VALIDATE_INT);$q=$db->prepare("SELECT id FROM event_source_files WHERE id=? AND event_id=? AND mime_type IN ('image/png','image/jpeg','image/webp')");$q->execute([$file,$event]);if(!$file||!$q->fetchColumn())api_error('VALIDATION_ERROR','Choose a picture uploaded to this event.',422);}elseif($text==='')continue;
  $clean[]=['type'=>$kind,'text'=>$kind==='image'?null:$text,'fileId'=>$file,'caption'=>$kind==='image'?($caption?:null):null];
 }
 return $clean;
}
function event_save_note_blocks(PDO $db,int $resource,array $blocks):void {
 $db->prepare('DELETE FROM event_curriculum_blocks WHERE resource_id=?')->execute([$resource]);
 $q=$db->prepare('INSERT INTO event_curriculum_blocks(resource_id,position,block_type,text_content,image_file_id,caption) VALUES(?,?,?,?,?,?)');
 foreach($blocks as $i=>$b)$q->execute([$resource,$i,$b['type'],$b['text'],$b['fileId'],$b['caption']]);
}
function api_event_curriculum_notes(PDO $db,int $event,int $resource):never {
 $actor=api_actor($db,true);event_allowed($db,$actor,$event);$v=api_input();$blocks=event_validate_note_blocks($db,$event,$v['noteBlocks']??null);if(!$blocks)api_error('VALIDATION_ERROR','Add at least one note section before saving.',422);
 $db->beginTransaction();try{$q=$db->prepare('SELECT id FROM event_curriculum_resources WHERE event_id=? AND id=? FOR UPDATE');$q->execute([$event,$resource]);if(!$q->fetchColumn()){$db->rollBack();api_error('NOT_FOUND','Resource not found in this event.',404);}event_save_note_blocks($db,$resource,$blocks);api_audit($db,$actor,'EVENT_CURRICULUM_NOTES_UPDATED','EventResource',$resource);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['id'=>$resource,'noteBlocks'=>$blocks]);
}
