<?php
declare(strict_types=1);
// Private source package -> archive structure + PREVIEW only. Attendance requires
// a separate explicit administrator review/commit from the event's Reports tab.
require dirname(__DIR__).'/config.php';
require dirname(__DIR__).'/registration-eligibility.php';
require dirname(__DIR__).'/public/events.php';
require __DIR__.'/import_vbs_roster.php';
final class BackfillResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('Response');}}
function api_ok(array $data,int $status=200):void{throw new BackfillResponse($data);}
function api_error(string $code,string $message,int $status=400):void{throw new RuntimeException($code.': '.$message);}
function api_actor(PDO $db,bool $super=false):array{return $GLOBALS['actor'];}
function api_input():array{return $GLOBALS['input'];}
function api_method():string{return 'POST';}
function api_audit(PDO $db,array $actor,string $action,string $entity,int $id,array $meta=[]):void{
    audit($db,(int)$actor['campus_id'],$action,$entity,$id,['adminId'=>$actor['id']]+$meta);
}
function api_phone(?string $value):?string{$p=preg_replace('/\D+/','',(string)$value);if(str_starts_with($p,'234')&&strlen($p)===13)$p='0'.substr($p,3);return strlen($p)===11&&str_starts_with($p,'0')?$p:null;}
function backfill_result(callable $fn):array{try{$fn();}catch(BackfillResponse $r){return $r->data;}throw new RuntimeException('No result');}
$options=getopt('',['package:','source-dir:','admin-id:','confirm','import-ready']);
if(empty($options['package'])||empty($options['source-dir'])||empty($options['admin-id'])){fwrite(STDERR,"Supply --package=private.json --source-dir=original-pdfs --admin-id=N; add --confirm to create the archive preview.\n");exit(1);}
$package=json_decode(file_get_contents($options['package']),true,512,JSON_THROW_ON_ERROR);
if(($package['startDate']??'')!=='2026-08-24'||($package['endDate']??'')!=='2026-08-29'||count($package['days']??[])!==6)throw new RuntimeException('Expected the confirmed six VBS dates.');
foreach($package['sources'] as $source){$path=rtrim($options['source-dir'],'/').'/'.basename($source['name']);if(!is_file($path)||filesize($path)>25*1024*1024||!hash_equals($source['sha256'],hash_file('sha256',$path)))throw new RuntimeException('An original source is missing or has changed.');}
if(!array_key_exists('confirm',$options)){echo json_encode(['mode'=>'preview only','sourceRows'=>count($package['rows']),'flagged'=>count(array_filter($package['rows'],fn($r)=>!empty($r['requiresReview']))),'dates'=>[$package['startDate'],$package['endDate']],'resources'=>count($package['curriculum'])])."\n";exit;}
$db=db();$q=$db->prepare("SELECT id,campus_id,name,access_level FROM staff_users WHERE id=? AND access_level='TPK_SUPER_ADMIN' AND account_status='VERIFIED' AND is_active=1");$q->execute([(int)$options['admin-id']]);$actor=$q->fetch();if(!$actor)throw new RuntimeException('An active Super Admin is required.');
$campus=(int)(tpk_regular_campus($db)['id']??0);if((int)$actor['campus_id']!==$campus)throw new RuntimeException('This source package belongs to the regular headquarters campus.');
$q=$db->prepare('SELECT id FROM ministry_events WHERE campus_id=? AND name=? AND starts_on=? AND ends_on=?');$q->execute([$campus,$package['name'],$package['startDate'],$package['endDate']]);$existing=$q->fetchAll();if(count($existing)>1)throw new RuntimeException('Multiple matching archives found; review before retrying.');
$id=(int)($existing[0]['id']??0);$files=[];$days=[];$createdFiles=[];$rosterResult=null;
$directory=dirname(__DIR__).'/storage/event-resources';if(!is_dir($directory)&&!mkdir($directory,0750,true)&&!is_dir($directory))throw new RuntimeException('Private storage unavailable.');
$db->beginTransaction();
try{
    if(!$id){$input=['name'=>$package['name'],'type'=>'VBS','startDate'=>$package['startDate'],'endDate'=>$package['endDate'],'registrationOpens'=>$package['startDate'],'registrationCloses'=>$package['endDate'],'status'=>'ARCHIVED','themeName'=>$package['themeName'],'themeSongUrl'=>'https://www.youtube.com/watch?v=DY0yI8ZPibQ','timezone'=>'Africa/Lagos','description'=>'Historical VBS records. Original attendance marks and planning resources are retained separately; live Sunday records are unchanged.'];$id=backfill_result(fn()=>api_event_save($db))['id'];}
    foreach($package['days'] as $d){$q=$db->prepare('SELECT id FROM event_days WHERE event_id=? AND day_number=?');$q->execute([$id,$d['dayNumber']]);$did=$q->fetchColumn();if(!$did){$input=$d;$did=backfill_result(fn()=>api_event_day($db,$id))['id'];}$days[$d['dayNumber']]=(int)$did;}
    foreach($package['sources'] as $source){$q=$db->prepare('SELECT id FROM event_source_files WHERE event_id=? AND sha256=?');$q->execute([$id,$source['sha256']]);$fid=$q->fetchColumn();if(!$fid){$stored=bin2hex(random_bytes(20)).'.pdf';$path=$directory.'/'.$stored;if(!copy(rtrim($options['source-dir'],'/').'/'.basename($source['name']),$path))throw new RuntimeException('Source copy failed.');chmod($path,0640);$createdFiles[]=$path;$db->prepare('INSERT INTO event_source_files(event_id,original_name,stored_name,mime_type,byte_size,sha256,uploaded_by) VALUES(?,?,?,\'application/pdf\',?,?,?)')->execute([$id,$source['name'],$stored,filesize($path),$source['sha256'],$actor['id']]);$fid=(int)$db->lastInsertId();}$files[$source['name']]=$fid;}
    foreach($package['curriculum'] as $resource){$q=$db->prepare('SELECT id FROM event_curriculum_resources WHERE event_id=? AND title=?');$q->execute([$id,$resource['title']]);if($q->fetchColumn())continue;$db->prepare('INSERT INTO event_curriculum_resources(event_id,title,resource_type,content,external_url,source_file_id,source_page_start,source_page_end,created_by) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$id,$resource['title'],$resource['type'],$resource['content']??null,$resource['url']??null,$files[$resource['sourceName']??'']??null,$resource['pageStart']??null,$resource['pageEnd']??null,$actor['id']]);$rid=(int)$db->lastInsertId();$db->prepare('INSERT INTO event_curriculum_targets(resource_id,day_id) VALUES(?,?)')->execute([$rid,$resource['type']==='LESSON_PLAN'?$days[6]:null]);}
    // Exact historical labels only: the file names Tribe C (5–8) and D (2–4).
    // It does not name the older classes, so they are not invented here.
    foreach([['Tribe D',2,4],['Tribe C',5,8]] as [$name,$min,$max])$db->prepare('INSERT IGNORE INTO event_groups(event_id,name,min_age,max_age) VALUES(?,?,?,?)')->execute([$id,$name,$min,$max]);
    $attendanceFile=$files['VBS 2026 Abuja Attendance - Sheet1.pdf'];
    foreach($package['reportedDropoffTotals'] as $i=>$value){$q=$db->prepare("SELECT id FROM event_reported_statistics WHERE event_id=? AND day_id=? AND metric='Drop-off total' AND source_file_id=?");$q->execute([$id,$days[$i+1],$attendanceFile]);if(!$q->fetchColumn())$db->prepare("INSERT INTO event_reported_statistics(event_id,day_id,metric,reported_value,source_file_id,source_page) VALUES(?,?,'Drop-off total',?,?,2)")->execute([$id,$days[$i+1],$value,$attendanceFile]);}
    $programme=[
      ['09:00','09:30','Arrival, Registration & Assembly','Bags at TPK Auditorium, then Big Church.'],
      ['09:30','09:40','Restroom Break & Seating','Tribe D sits in front.'],
      ['09:40','10:12','Group 1 Quiz','Ages 9–Teenagers. First five correct respondents represent each class.'],
      ['10:12','10:45','Group 2 Quiz','Tribes C & D. Class representatives participate.'],
      ['10:45','11:00','Spoken Word','Timing fixed in the source plan.'],
      ['11:00','11:20','SUPERCOOL Presentation','Before the movie.'],
      ['11:20','11:40','Presentation of Certificates','Arrange certificates beforehand.'],
      ['11:40','12:10','Snack Time','Food and cotton candy.'],
      ['12:10','13:20','Class & Age Group Presentations','Manage segment timing carefully.'],
      ['13:20','13:30','Transition / Movie Setup','Children settle; technical setup.'],
      ['13:30','14:30','Movie','Final activity in the proposed programme.'],
      ['14:30',null,'Programme Ends','Hard deadline from the planning minutes.']];
    foreach($programme as $i=>[$start,$end,$title,$notes]){$q=$db->prepare('SELECT id FROM event_programme_activities WHERE event_id=? AND day_id=? AND title=?');$q->execute([$id,$days[6],$title]);if(!$q->fetchColumn())$db->prepare('INSERT INTO event_programme_activities(event_id,day_id,title,starts_at,ends_at,notes,sort_order) VALUES(?,?,?,?,?,?,?)')->execute([$id,$days[6],$title,$start,$end,'PLANNED · Source: VBS Outline Plans (Word).pdf, pages 5–6. Finale mapped to the final confirmed VBS day; delivery was not recorded. '.$notes,$i]);}
    $q=$db->prepare('SELECT event_id FROM event_appearances WHERE event_id=?');$q->execute([$id]);if(!$q->fetchColumn())$db->prepare("INSERT INTO event_appearances(event_id,preset,enabled,apply_dashboard,updated_by) VALUES(?,'JUNGLE',1,0,?)")->execute([$id,$actor['id']]);
    if(!empty($package['volunteerRoster'])){
        $rosterResult=import_vbs_roster($db,$id,$package['volunteerRoster'],$days,(int)$files[$package['volunteerRoster']['sourceName']]);
        foreach($package['days'] as $d){$q=$db->prepare('SELECT id FROM event_sessions WHERE event_id=? AND day_id=? AND name=?');$name=$d['label'].' · daily roster (planned)';$q->execute([$id,$days[$d['dayNumber']],$name]);if($q->fetchColumn())continue;$schedule=array_values(array_filter($package['volunteerRoster']['activities'],fn($a)=>$a['dayNumber']===$d['dayNumber']));$starts=min(array_column($schedule,'startsAt'));$ends=max(array_column($schedule,'endsAt'));$db->prepare('INSERT INTO event_sessions(event_id,day_id,name,starts_at,ends_at) VALUES(?,?,?,?,?)')->execute([$id,$days[$d['dayNumber']],$name,$d['date'].' '.$starts,$d['date'].' '.$ends]);}
    }
    $db->commit();
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();foreach($createdFiles as $path)if(is_file($path))unlink($path);throw $error;}
$input=['kind'=>'CHILDREN','sourceName'=>$package['sourceName'],'rows'=>$package['rows']];$preview=backfill_result(fn()=>api_event_import($db,$id));
$committed=null;if(array_key_exists('import-ready',$options)){$input=['confirm'=>true,'readyOnly'=>true];$committed=backfill_result(fn()=>api_event_import($db,$id,(int)$preview['id'],'commit'));}
echo json_encode(['eventId'=>$id,'batchId'=>$preview['id'],'sourceRows'=>count($package['rows']),'attendanceImport'=>$committed,'plannedRoster'=>$rosterResult,'note'=>'Ambiguous rows remain pending. Historical planned roles do not confirm volunteer attendance or grant accounts. Existing children and Sunday records are unchanged.'])."\n";
