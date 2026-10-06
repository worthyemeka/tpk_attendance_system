<?php
declare(strict_types=1);
// Run once a minute from the server scheduler. Never handles a browser request.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../config.php';
require __DIR__.'/../public/teacher-attendance.php';
function api_table_exists(PDO $db,string $table): bool {$s=$db->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$s->execute([$table]);return(bool)$s->fetchColumn();}
function api_error(string $code,string $message,int $status=400): void {throw new RuntimeException($code.': '.$message);}
$db=db();api_teacher_attendance_ready($db);$now=api_teacher_now();
$actors=$db->query("SELECT id,campus_id FROM staff_users WHERE access_level='TPK_SUPER_ADMIN' AND is_active=1 AND account_status='VERIFIED' AND team_status<>'INACTIVE' ORDER BY id")->fetchAll();
$seen=[];foreach($actors as $actor){if(isset($seen[$actor['campus_id']]))continue;$seen[$actor['campus_id']]=true;api_teacher_sync_services($db,$actor,$now->format('Y-m-d'),$now->modify('+1 day')->format('Y-m-d'));api_teacher_queue_welfare($db,$actor);}
