<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/config.php';
if(PHP_SAPI!=='cli')exit(1);
$db=db();$apply=in_array('--apply',$argv,true);
$sql=file_get_contents(dirname(__DIR__).'/database/2026_assembly_workspace.sql')."\n".file_get_contents(dirname(__DIR__).'/database/2026_classroom_interactions.sql')."\n".file_get_contents(dirname(__DIR__).'/database/2026_assembly_note_reactions.sql');
// Audit every required table before any write; never replay older migrations.
$expected=[
 'assembly_activities'=>['id','campus_id','service_session_id','activity_name','led_by_staff_user_id','notes','status','created_by_staff_user_id','created_at','updated_at'],
 'assembly_notes'=>['id','campus_id','service_session_id','note','created_by_staff_user_id','created_at'],
 'assembly_note_reactions'=>['note_id','staff_user_id','reaction'],
 'classroom_review_replies'=>['id','review_id','body','created_by_staff_user_id','created_at'],
 'classroom_review_reactions'=>['review_id','staff_user_id','reaction'],
 'assembly_activity_media'=>['id','activity_id','stored_name','original_name','mime_type','byte_size','created_by_staff_user_id','created_at'],
];
foreach(['classroom_weekly_reviews'=>'bigint unsigned','staff_users'=>'int unsigned','service_sessions'=>'int unsigned','campuses'=>'int unsigned'] as $table=>$type){
 $column=$db->query("SHOW COLUMNS FROM $table LIKE 'id'")->fetch();
 if(!$column||strtolower($column['Type'])!==$type)throw new RuntimeException("Audit stopped: unexpected $table.id type. No schema changed.");
}
$missing=[];
foreach($expected as $table=>$fields){
 $q=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$q->execute([$table]);
 if(!$q->fetchColumn()){$missing[]=$table;echo "MISSING $table\n";continue;}
 $columns=array_column($db->query("SHOW COLUMNS FROM $table")->fetchAll(),'Field');
 if(array_diff($fields,$columns))throw new RuntimeException("Audit stopped: $table is partially defined. No schema changed.");
 echo "EXISTS $table (preserved)\n";
}
if(!$apply){echo 'Audit only. Missing tables: '.count($missing).". Use --apply after backup.\n";exit;}
foreach(explode(';',$sql) as $statement){
 if(preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/',$statement,$match)&&in_array($match[1],$missing,true)){$db->exec($statement);echo "CREATED {$match[1]}\n";}
}
echo "Reconciliation complete; existing tables and data unchanged.\n";
