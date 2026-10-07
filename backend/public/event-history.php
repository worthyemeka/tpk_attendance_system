<?php
declare(strict_types=1);
require_once __DIR__.'/event-appearance.php';

function event_volunteer_api_allowed(string $path,string $method): bool {
    if($path==='/api/v1/me/appearance')return in_array($method,['GET','PATCH'],true);
    if($method==='GET')return $path==='/api/v1/events'||(bool)preg_match('#^/api/v1/events/\d+(?:/files/\d+)?$#',$path);
    return $method==='POST'&&(bool)preg_match('#^/api/v1/events/\d+/volunteer-attendance$#',$path);
}
function event_history_routes(PDO $db,string $path,string $method): void {
    if($path==='/api/v1/public/event-account/setup'&&$method==='POST')api_event_password_setup($db);
    if($path==='/api/v1/me/appearance'&&in_array($method,['GET','PATCH'],true))api_staff_appearance($db);
    if(preg_match('#^/api/v1/events/(\d+)/files(?:/(\d+))?$#',$path,$m)){
        if($method==='GET'&&isset($m[2]))api_event_file($db,(int)$m[1],(int)$m[2]);
        if($method==='POST'&&!isset($m[2]))api_event_file($db,(int)$m[1]);
    }
    if($method==='PATCH'&&preg_match('#^/api/v1/events/(\d+)/children/(\d+)$#',$path,$m))api_event_registration_profile($db,(int)$m[1],(int)$m[2]);
    if($method==='PATCH'&&preg_match('#^/api/v1/events/(\d+)/roster-people/(\d+)$#',$path,$m))api_event_roster_identity($db,(int)$m[1],(int)$m[2]);
    if(preg_match('#^/api/v1/events/(\d+)/imports(?:/(\d+)(?:/(commit|row))?)?$#',$path,$m)&&in_array($method,['GET','POST','PATCH'],true))api_event_import($db,(int)$m[1],(int)($m[2]??0),$m[3]??'');
    if($method==='POST'&&preg_match('#^/api/v1/events/(\d+)/(days|curriculum|volunteer-registration|volunteer-attendance|appearance)$#',$path,$m)){
        $f=['days'=>'api_event_day','curriculum'=>'api_event_curriculum','volunteer-registration'=>'api_event_volunteer_register','volunteer-attendance'=>'api_event_volunteer_presence','appearance'=>'api_event_appearance'][$m[2]];$f($db,(int)$m[1]);
    }
}

function event_lifecycle(array $event,?string $today=null): string {
    if(in_array($event['status'],['DRAFT','CANCELLED','ARCHIVED'],true))return $event['status'];
    $today=$today??(new DateTimeImmutable('now',new DateTimeZone($event['timezone']??'Africa/Lagos')))->format('Y-m-d');
    return $today<$event['starts_on']?'UPCOMING':($today>$event['ends_on']?'COMPLETED':'LIVE');
}
function event_url($value): ?string {
    if($value===null||$value==='')return null;
    if(!is_string($value)||strlen($value)>1000||!filter_var($value,FILTER_VALIDATE_URL)||strtolower((string)parse_url($value,PHP_URL_SCHEME))!=='https'||parse_url($value,PHP_URL_USER)||parse_url($value,PHP_URL_PASS))api_error('VALIDATION_ERROR','Use a secure HTTPS resource URL without credentials.',422);
    return $value;
}
function event_target(PDO $db,int $event,string $table,$id): ?int {
    if(!$id)return null;
    if(!in_array($table,['event_days','event_sessions','event_groups'],true))throw new LogicException('Invalid target table');
    $q=$db->prepare("SELECT id FROM $table WHERE event_id=? AND id=?");$q->execute([$event,(int)$id]);
    if(!$q->fetchColumn())api_error('VALIDATION_ERROR','Choose a day, session or group from this event.',422);
    return (int)$id;
}
function event_campus(PDO $db,$id): ?int {
    if(!$id)return null;$q=$db->prepare('SELECT id FROM campuses WHERE id=?');$q->execute([(int)$id]);
    if(!$q->fetchColumn())api_error('VALIDATION_ERROR','Choose a saved home campus.',422);return (int)$id;
}
function event_member(PDO $db,array $actor,int $id): bool {
    $q=$db->prepare("SELECT 1 FROM event_volunteers WHERE event_id=? AND staff_user_id=? AND membership_status='ACTIVE'");$q->execute([$id,$actor['id']]);return (bool)$q->fetchColumn();
}
function event_limit_volunteer_data(array &$data): void {
    $assignments=$data['volunteerAssignments'];
    $data['sessions']=array_values(array_filter($data['sessions'],function($session)use($assignments){
        foreach($assignments as $a)if(!$a['sessionId']||(int)$a['sessionId']===(int)$session['id'])return true;
        return false;
    }));
    $data['groups']=array_values(array_filter($data['groups'],function($group)use($assignments){
        foreach($assignments as $a)if(!$a['groupId']||(int)$a['groupId']===(int)$group['id'])return true;
        return false;
    }));
    $days=array_column($data['sessions'],'dayId');
    $wholeEvent=(bool)array_filter($assignments,fn($a)=>!$a['sessionId']);
    $data['days']=array_values(array_filter($data['days'],fn($d)=>$wholeEvent||in_array($d['id'],$days)));
    $data['programme']=array_values(array_filter($data['programme'],function($p)use($assignments,$data){
        foreach($assignments as $a){
            if($p['groupId']&&$a['groupId']&&(int)$p['groupId']!==(int)$a['groupId'])continue;
            if(!$a['sessionId'])return true;
            if($p['sessionId']){if((int)$p['sessionId']===(int)$a['sessionId'])return true;continue;}
            foreach($data['sessions'] as $s)if((int)$s['id']===(int)$a['sessionId']&&(int)$s['dayId']===(int)$p['dayId'])return true;
        }
        return false;
    }));
    $data['historicalReport']=[];$data['reportedStatistics']=[];
    $data['responsibilities']=[];$data['staff']=[];
}
function event_resource_visible(PDO $db,array $actor,int $event,int $resource): bool {
    if($actor['access_level']==='TPK_SUPER_ADMIN')return true;
    if(!event_member($db,$actor,$event))return false;
    // An untargeted resource is for the whole team; otherwise every constrained
    // dimension must match the SAME assignment (not roles from unrelated days).
    $q=$db->prepare('SELECT 1 FROM event_curriculum_targets t JOIN event_volunteer_assignments a ON a.event_id=? AND a.staff_user_id=? LEFT JOIN event_sessions s ON s.id=a.session_id WHERE t.resource_id=? AND (t.group_id IS NULL OR a.group_id IS NULL OR t.group_id=a.group_id) AND (t.session_id IS NULL OR a.session_id IS NULL OR t.session_id=a.session_id) AND (t.day_id IS NULL OR a.session_id IS NULL OR t.day_id=s.day_id) LIMIT 1');$q->execute([$event,$actor['id'],$resource]);return (bool)$q->fetchColumn();
}
function event_history_data(PDO $db,array $actor,array $event,array &$data): void {
    $id=(int)$event['id'];$super=$actor['access_level']==='TPK_SUPER_ADMIN';
    $data['event']['themeName']=$event['theme_name'];$data['event']['themeSongUrl']=$event['theme_song_url'];$data['event']['timezone']=$event['timezone'];$data['event']['lifecycle']=event_lifecycle($event);
    $q=$db->prepare('SELECT id,day_number AS dayNumber,label,calendar_date AS date FROM event_days WHERE event_id=? ORDER BY day_number');$q->execute([$id]);$data['days']=$q->fetchAll();
    $data['campuses']=$db->query('SELECT id,name,code,timezone FROM campuses ORDER BY name')->fetchAll();
    $q=$db->prepare('SELECT * FROM event_appearances WHERE event_id=?');$q->execute([$id]);$data['appearance']=event_appearance_value($q->fetch()?:['preset'=>'DEFAULT','enabled'=>false,'apply_dashboard'=>false,'preserve_after'=>false,'artwork_url'=>null,'artwork_file_id'=>null,'palette_json'=>null]);
    $q=$db->prepare('SELECT r.id,r.title,r.resource_type AS type,r.description,r.content,r.external_url AS url,r.source_file_id AS fileId,r.source_page_start AS pageStart,r.source_page_end AS pageEnd,r.min_age AS minAge,r.max_age AS maxAge,f.original_name AS filename FROM event_curriculum_resources r LEFT JOIN event_source_files f ON f.id=r.source_file_id WHERE r.event_id=? ORDER BY r.resource_type,r.title');$q->execute([$id]);$data['curriculum']=[];
    foreach($q->fetchAll() as $row){if(!$super&&!event_resource_visible($db,$actor,$id,(int)$row['id']))continue;$t=$db->prepare('SELECT day_id AS dayId,session_id AS sessionId,group_id AS groupId FROM event_curriculum_targets WHERE resource_id=?');$t->execute([$row['id']]);$row['targets']=$t->fetchAll();$data['curriculum'][]=$row;}
    $q=$db->prepare('SELECT a.id,a.day_id AS dayId,a.session_id AS sessionId,a.group_id AS groupId,a.title,a.starts_at AS startsAt,a.ends_at AS endsAt,a.notes,a.source_page AS sourcePage,a.responsible_raw AS responsibleRaw,a.roster_group_id AS rosterGroupId,f.original_name AS sourceName FROM event_programme_activities a LEFT JOIN event_source_files f ON f.id=a.source_file_id WHERE a.event_id=? ORDER BY a.day_id,a.sort_order');$q->execute([$id]);$data['programme']=$q->fetchAll();
    $q=$db->prepare('SELECT d.id AS dayId,d.label,d.calendar_date AS date,COUNT(h.child_id) AS recorded,SUM(h.present=1) AS present,SUM(h.present=0) AS absent,SUM(h.picked_up=1) AS pickedUp,SUM(h.picked_up IS NULL) AS pickupUnknown FROM event_days d LEFT JOIN event_historical_attendance h ON h.day_id=d.id WHERE d.event_id=? GROUP BY d.id ORDER BY d.day_number');$q->execute([$id]);$data['historicalReport']=$q->fetchAll();
    $data['historicalAttendance']=[];$data['contacts']=[];$data['cards']=[];$data['imports']=[];$data['sourceFiles']=[];
    $data['historicalRoster']=[];$data['rosterGroups']=[];$data['rosterPeople']=[];
    if($super){
        $q=$db->prepare('SELECT id,name,kind FROM event_roster_groups WHERE event_id=? ORDER BY kind,name');$q->execute([$id]);$data['rosterGroups']=$q->fetchAll();
        $q=$db->prepare('SELECT m.rotation_id,c.name FROM event_roster_group_members m JOIN event_roster_groups c ON c.id=m.class_id WHERE c.event_id=? ORDER BY c.name');$q->execute([$id]);$members=[];foreach($q->fetchAll() as $member)$members[$member['rotation_id']][]=$member['name'];foreach($data['rosterGroups'] as &$group)$group['classes']=implode(', ',$members[$group['id']]??[]);unset($group);
        $q=$db->prepare('SELECT p.id,p.source_name AS name,p.staff_user_id AS staffId,p.review_required AS reviewRequired,s.name AS staffName FROM event_roster_people p LEFT JOIN staff_users s ON s.id=p.staff_user_id WHERE p.event_id=? ORDER BY p.source_name');$q->execute([$id]);$data['rosterPeople']=$q->fetchAll();
        $q=$db->prepare('SELECT a.id,a.day_id AS dayId,a.activity_id AS activityId,a.person_id AS personId,a.responsibility,a.call_time AS callTime,a.source_page AS sourcePage,g.name AS groupName,p.source_name AS name,p.review_required AS reviewRequired FROM event_roster_assignments a JOIN event_roster_people p ON p.id=a.person_id LEFT JOIN event_roster_groups g ON g.id=a.roster_group_id WHERE a.event_id=? ORDER BY a.day_id,a.activity_id,a.id');$q->execute([$id]);$data['historicalRoster']=$q->fetchAll();
    }
    if($super){foreach(['historicalAttendance'=>'SELECT h.child_id AS childId,h.day_id AS dayId,h.present,h.picked_up AS pickedUp,h.food FROM event_historical_attendance h JOIN event_days d ON d.id=h.day_id WHERE d.event_id=?','contacts'=>'SELECT t.id,t.registration_id AS registrationId,t.child_id AS childId,t.contact_type AS type,t.name,t.phone,t.relationship,t.source_text AS sourceText FROM event_registration_contacts t JOIN event_registrations r ON r.id=t.registration_id WHERE r.event_id=?','cards'=>'SELECT t.child_id AS childId,t.day_id AS dayId,t.card_number AS number FROM event_registration_cards t JOIN event_children c ON c.id=t.child_id WHERE c.event_id=?','imports'=>'SELECT id,source_name AS sourceName,import_kind AS kind,state,created_at AS createdAt FROM event_import_batches WHERE event_id=? ORDER BY id DESC','sourceFiles'=>'SELECT id,original_name AS name,mime_type AS mimeType,byte_size AS size,sha256 FROM event_source_files WHERE event_id=? ORDER BY id'] as $key=>$sql){$q=$db->prepare($sql);$q->execute([$id]);$data[$key]=$q->fetchAll();}}
    $q=$db->prepare('SELECT s.day_id AS dayId,s.metric,s.reported_value AS value,s.source_page AS page,f.original_name AS source FROM event_reported_statistics s JOIN event_source_files f ON f.id=s.source_file_id WHERE s.event_id=?');$q->execute([$id]);$data['reportedStatistics']=$super?$q->fetchAll():[];
    // One batch query, not a query per child, for scalable event directories.
    $q=$db->prepare('SELECT c.id,COALESCE(c.home_campus_id,r.home_campus_id) AS homeCampusId,c.reported_age AS reportedAge,c.age_qualifier AS ageQualifier,c.gender,c.scholarship,c.food,c.registration_id AS registrationId,COALESCE(ca.name,r.home_campus) AS homeCampus FROM event_children c JOIN event_registrations r ON r.id=c.registration_id LEFT JOIN campuses ca ON ca.id=COALESCE(c.home_campus_id,r.home_campus_id) WHERE c.event_id=?');$q->execute([$id]);$extra=[];foreach($q->fetchAll() as $row)$extra[$row['id']]=$row;
    foreach($data['children'] as &$child)$child=array_merge($child,$extra[$child['id']]??[]);unset($child);
    if(!$data['canOperate']){
        // Exact safe directory projection: never query addresses, phones, DOB,
        // medical notes, scholarship, source contacts or pickup credentials.
        $filter='';$params=[$id];
        if($actor['access_level']==='EVENT_VOLUNTEER'){
            $filter=" AND EXISTS (SELECT 1 FROM event_volunteer_assignments a WHERE a.event_id=c.event_id AND a.staff_user_id=? AND (a.group_id IS NULL OR a.group_id=c.group_id) AND (a.session_id IS NULL OR EXISTS (SELECT 1 FROM event_child_sessions cs WHERE cs.child_id=c.id AND cs.session_id=a.session_id)))";$params[]=$actor['id'];
        }
        $q=$db->prepare('SELECT c.id,c.name,COALESCE(c.home_campus_id,r.home_campus_id) AS homeCampusId,COALESCE(ca.name,r.home_campus) AS homeCampus,r.guardian_name AS guardianName FROM event_children c JOIN event_registrations r ON r.id=c.registration_id LEFT JOIN campuses ca ON ca.id=COALESCE(c.home_campus_id,r.home_campus_id) WHERE c.event_id=?'.$filter.' ORDER BY c.name');$q->execute($params);$data['children']=$q->fetchAll();
    }
}
function api_event_roster_identity(PDO $db,int $id,int $person): never {
    $actor=api_actor($db,true);event_allowed($db,$actor,$id);$v=api_input();$uid=(int)($v['staffId']??0);
    $q=$db->prepare('SELECT id,review_required FROM event_roster_people WHERE id=? AND event_id=?');$q->execute([$person,$id]);$row=$q->fetch();if(!$row)api_error('PERSON_NOT_FOUND','This source identity is unavailable.',404);
    if($row['review_required'])api_error('IDENTITY_REVIEW_REQUIRED','This source block may contain multiple people. Review the original before linking; do not guess.',409);
    if($uid){$q=$db->prepare('SELECT id FROM staff_users WHERE id=? AND campus_id=?');$q->execute([$uid,$actor['campus_id']]);if(!$q->fetchColumn())api_error('VALIDATION_ERROR','Choose an existing host-campus staff record.',422);}
    $db->prepare('UPDATE event_roster_people SET staff_user_id=? WHERE id=? AND event_id=?')->execute([$uid?:null,$person,$id]);api_audit($db,$actor,'EVENT_ROSTER_IDENTITY_LINKED','EventRosterPerson',$person,['staffId'=>$uid?:null]);api_ok(['id'=>$person,'note'=>'Archive identity linked only; no login, membership or access was granted.']);
}
function api_event_day(PDO $db,int $id): never {
    $actor=api_actor($db,true);$event=event_allowed($db,$actor,$id);$v=api_input();$date=event_date($v['date']??'');$number=(int)($v['dayNumber']??0);
    if($number<1||$number>366||$date<$event['starts_on']||$date>$event['ends_on'])api_error('VALIDATION_ERROR','Choose an event date and day number from 1–366.',422);
    $db->prepare('INSERT INTO event_days(event_id,day_number,label,calendar_date) VALUES(?,?,?,?)')->execute([$id,$number,event_text($v['label']??'',120),$date]);$day=(int)$db->lastInsertId();api_audit($db,$actor,'EVENT_DAY_CREATED','Event',$id);api_ok(['id'=>$day],201);
}
function api_event_registration_profile(PDO $db,int $id,int $child): never {
    $actor=api_actor($db,true);event_allowed($db,$actor,$id);$v=api_input();$campus=event_campus($db,$v['homeCampusId']??null);if(!$campus)api_error('VALIDATION_ERROR','Choose a home campus.',422);
    $q=$db->prepare('SELECT id FROM event_children WHERE id=? AND event_id=?');$q->execute([$child,$id]);if(!$q->fetch())api_error('CHILD_NOT_FOUND','This event child is not available.',404);
    $db->prepare('UPDATE event_children SET home_campus_id=? WHERE id=? AND event_id=?')->execute([$campus,$child,$id]);api_audit($db,$actor,'EVENT_CHILD_CAMPUS_UPDATED','EventChild',$child);api_ok(['id'=>$child]);
}
function api_event_curriculum(PDO $db,int $id): never {
    $actor=api_actor($db,true);event_allowed($db,$actor,$id);$v=api_input();
    $type=$v['type']??'';if(!in_array($type,['LESSON','LESSON_PLAN','GAME','ACTIVITY_GUIDE','VIDEO','SONG','DOCUMENT','MEDIA','OTHER'],true))api_error('VALIDATION_ERROR','Choose a resource type.',422);
    $title=event_text($v['title']??'');$content=trim((string)($v['content']??''));$description=trim((string)($v['description']??''));if(strlen($content)>100000||mb_strlen($description)>4000)api_error('VALIDATION_ERROR','Resource text is too long.',422);
    $url=event_url($v['url']??null);$file=(int)($v['fileId']??0);if($file){$q=$db->prepare('SELECT id FROM event_source_files WHERE id=? AND event_id=?');$q->execute([$file,$id]);if(!$q->fetchColumn())api_error('VALIDATION_ERROR','Choose a file belonging to this event.',422);}
    $day=event_target($db,$id,'event_days',$v['dayId']??null);$session=event_target($db,$id,'event_sessions',$v['sessionId']??null);$group=event_target($db,$id,'event_groups',$v['groupId']??null);
    if($session&&$day){$q=$db->prepare('SELECT day_id FROM event_sessions WHERE id=?');$q->execute([$session]);if((int)$q->fetchColumn()!==$day)api_error('VALIDATION_ERROR','The session must belong to the selected day.',422);}
    $db->beginTransaction();try{$db->prepare('INSERT INTO event_curriculum_resources(event_id,title,resource_type,description,content,external_url,source_file_id,created_by) VALUES(?,?,?,?,?,?,?,?)')->execute([$id,$title,$type,$description?:null,$content?:null,$url,$file?:null,$actor['id']]);$rid=(int)$db->lastInsertId();$db->prepare('INSERT INTO event_curriculum_targets(resource_id,day_id,session_id,group_id) VALUES(?,?,?,?)')->execute([$rid,$day,$session,$group]);api_audit($db,$actor,'EVENT_CURRICULUM_CREATED','EventResource',$rid);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['id'=>$rid],201);
}
function api_event_file(PDO $db,int $id,int $file=0): never {
    $actor=api_actor($db,!$file);event_allowed($db,$actor,$id);
    $dir=dirname(__DIR__).'/storage/event-resources';
    if($file){$q=$db->prepare('SELECT * FROM event_source_files WHERE id=? AND event_id=?');$q->execute([$file,$id]);$row=$q->fetch();if(!$row)api_error('FILE_NOT_FOUND','File not found.',404);
        if($actor['access_level']!=='TPK_SUPER_ADMIN'){$q=$db->prepare('SELECT id FROM event_curriculum_resources WHERE event_id=? AND source_file_id=?');$q->execute([$id,$file]);$allowed=false;foreach($q->fetchAll() as $r)if(event_resource_visible($db,$actor,$id,(int)$r['id']))$allowed=true;$q=$db->prepare("SELECT 1 FROM event_appearances WHERE event_id=? AND artwork_file_id=? AND enabled=1");$q->execute([$id,$file]);if(in_array($row['mime_type'],['image/png','image/jpeg','image/webp'],true)&&$q->fetchColumn())$allowed=true;if(!$allowed)api_error('FORBIDDEN','This source file is not available for your assignment.',403);}
        if(!preg_match('/^[a-f0-9]{40}\.[a-z0-9]+$/',$row['stored_name'])||!is_file($dir.'/'.$row['stored_name']))api_error('FILE_NOT_FOUND','File unavailable.',404);
        header('Access-Control-Allow-Origin: '.tpk_cors_origin());header('Vary: Origin');header('Access-Control-Expose-Headers: Content-Disposition');header('Content-Type: '.$row['mime_type']);header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header('Content-Disposition: attachment; filename="'.str_replace(['"',"\r","\n"],'',basename($row['original_name'])).'"');readfile($dir.'/'.$row['stored_name']);exit;
    }
    $f=$_FILES['file']??null;if(!$f||($f['error']??1)!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name'])||$f['size']<1||$f['size']>25*1024*1024)api_error('VALIDATION_ERROR','Choose a resource up to 25 MB.',422);
    $types=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm','audio/mpeg'=>'mp3','text/plain'=>'txt','text/csv'=>'csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document'=>'docx'];
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);if(!isset($types[$mime]))api_error('VALIDATION_ERROR','Use a PDF, document, CSV, image, audio or supported video.',422);
    if(str_starts_with($mime,'image/')){$size=@getimagesize($f['tmp_name']);if(!$size||$size[0]*$size[1]>16000000)api_error('VALIDATION_ERROR','Use a valid image under 16 megapixels.',422);}
    $hash=hash_file('sha256',$f['tmp_name']);$q=$db->prepare('SELECT id FROM event_source_files WHERE event_id=? AND sha256=?');$q->execute([$id,$hash]);if($existing=$q->fetchColumn())api_ok(['id'=>(int)$existing,'duplicate'=>true]);
    if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))api_error('STORAGE_UNAVAILABLE','Resource storage is unavailable.',503);
    $name=bin2hex(random_bytes(20)).'.'.$types[$mime];$path=$dir.'/'.$name;if(!move_uploaded_file($f['tmp_name'],$path))api_error('STORAGE_UNAVAILABLE','Could not store resource.',503);chmod($path,0640);
    try{$db->prepare('INSERT INTO event_source_files(event_id,original_name,stored_name,mime_type,byte_size,sha256,uploaded_by) VALUES(?,?,?,?,?,?,?)')->execute([$id,substr(basename($f['name']),0,255),$name,$mime,$f['size'],$hash,$actor['id']]);$fid=(int)$db->lastInsertId();api_audit($db,$actor,'EVENT_SOURCE_UPLOADED','EventFile',$fid);}catch(Throwable $e){unlink($path);throw $e;}api_ok(['id'=>$fid],201);
}
function event_volunteer_account(PDO $db,array $actor,array $v): int {
    if(!empty($v['userId'])){$q=$db->prepare('SELECT id FROM staff_users WHERE id=?');$q->execute([(int)$v['userId']]);if(!$q->fetchColumn())api_error('VALIDATION_ERROR','Choose an existing person.',422);return (int)$v['userId'];}
    $email=strtolower(event_text($v['email']??'',150));if(!filter_var($email,FILTER_VALIDATE_EMAIL))api_error('VALIDATION_ERROR','Enter a valid email.',422);
    $q=$db->prepare('SELECT id FROM staff_users WHERE email=?');$q->execute([$email]);if($uid=$q->fetchColumn())return (int)$uid; // Reuse, never reset an existing teacher's authentication or access.
    $name=event_text($v['name']??'',150);$phone=trim((string)($v['phone']??''));$whatsapp=trim((string)($v['whatsapp']??$phone));
    foreach([$phone,$whatsapp] as $number)if($number!==''&&!preg_match('/^\+?[0-9 ()-]{7,40}$/',$number))api_error('VALIDATION_ERROR','Enter a valid international contact number.',422);
    $gender=$v['gender']??null;if($gender!==null&&$gender!==''&&!in_array($gender,['FEMALE','MALE'],true))api_error('VALIDATION_ERROR','Choose an applicable gender or leave it unspecified.',422);
    $parts=preg_split('/\s+/',$name,2);$db->prepare("INSERT INTO staff_users(campus_id,name,email,role,access_level,team_status,account_status,is_active) VALUES(?,?,?,'VIEWER','EVENT_VOLUNTEER','ACTIVE','PENDING_VERIFICATION',1)")->execute([$actor['campus_id'],$name,$email]);$uid=(int)$db->lastInsertId();
    $db->prepare('INSERT INTO teacher_profiles(staff_user_id,first_name,last_name,birth_date,gender,marital_status,primary_phone,whatsapp_number,whatsapp_number_normalized,mobile_number,residential_address,emergency_contact,emergency_relationship_phone,password_hash) VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,?,?)')->execute([$uid,$parts[0],$parts[1]??'',($gender?:null),'Not recorded',$phone,$whatsapp,tpk_normalize_nigerian_phone($whatsapp),$phone,'','','',password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT)]);
    return $uid;
}
function api_event_volunteer_register(PDO $db,int $id): never {
    $actor=api_actor($db,true);event_allowed($db,$actor,$id);$v=api_input();$campus=event_campus($db,$v['homeCampusId']??null);$duty=$v['duty']??'TEACHER';$status=$v['membershipStatus']??'ACTIVE';
    if(!in_array($duty,['TEACHER','LEAD','CHECK_IN','PICKUP'],true)||!in_array($status,['ACTIVE','INACTIVE'],true))api_error('VALIDATION_ERROR','Choose supported event access and account status.',422);
    $session=event_target($db,$id,'event_sessions',$v['sessionId']??null);$group=event_target($db,$id,'event_groups',$v['groupId']??null);$role=event_text($v['responsibility']??'Volunteer',120);
    $db->beginTransaction();try{$uid=event_volunteer_account($db,$actor,$v);$db->prepare('INSERT INTO event_volunteers(event_id,staff_user_id,duty,home_campus_id,membership_status) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE duty=VALUES(duty),home_campus_id=VALUES(home_campus_id),membership_status=VALUES(membership_status)')->execute([$id,$uid,$duty,$campus,$status]);
      $q=$db->prepare('SELECT id FROM event_volunteer_assignments WHERE event_id=? AND staff_user_id=? AND session_id<=>? AND group_id<=>? AND responsibility=?');$q->execute([$id,$uid,$session,$group,$role]);if(!$q->fetchColumn())$db->prepare('INSERT INTO event_volunteer_assignments(event_id,staff_user_id,session_id,group_id,responsibility) VALUES(?,?,?,?,?)')->execute([$id,$uid,$session,$group,$role]);
      $q=$db->prepare('SELECT access_level,account_status FROM staff_users WHERE id=?');$q->execute([$uid]);$person=$q->fetch();$token=null;
      if($person['access_level']==='EVENT_VOLUNTEER'&&$person['account_status']!=='VERIFIED'&&$status==='ACTIVE'){$token=bin2hex(random_bytes(32));$db->prepare('UPDATE event_account_invitations SET used_at=NOW() WHERE staff_user_id=? AND used_at IS NULL')->execute([$uid]);$db->prepare('INSERT INTO event_account_invitations(staff_user_id,token_hash,expires_at,created_by) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 48 HOUR),?)')->execute([$uid,hash('sha256',$token),$actor['id']]);}
      api_audit($db,$actor,'EVENT_VOLUNTEER_REGISTERED','Event',$id,['staffId'=>$uid]);$db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['userId'=>$uid,'setupToken'=>$token],201);
}
function api_event_password_setup(PDO $db): never {
    $v=api_input();$token=$v['token']??'';$password=$v['password']??'';
    if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/',$token)||!is_string($password)||strlen($password)<12||strlen($password)>200)api_error('VALIDATION_ERROR','Use the invitation link and a password of 12–200 characters.',422);
    $db->beginTransaction();try{$q=$db->prepare("SELECT i.id,i.staff_user_id FROM event_account_invitations i JOIN staff_users u ON u.id=i.staff_user_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>NOW() AND u.access_level='EVENT_VOLUNTEER' AND u.is_active=1 AND EXISTS (SELECT 1 FROM event_volunteers v WHERE v.staff_user_id=u.id AND v.membership_status='ACTIVE') FOR UPDATE");$q->execute([hash('sha256',$token)]);$invite=$q->fetch();if(!$invite)api_error('INVITATION_EXPIRED','This invitation has expired or been used. Ask the event administrator for a new link.',410);
      $db->prepare('UPDATE teacher_profiles SET password_hash=? WHERE staff_user_id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$invite['staff_user_id']]);$db->prepare("UPDATE staff_users SET account_status='VERIFIED' WHERE id=?")->execute([$invite['staff_user_id']]);$db->prepare('UPDATE event_account_invitations SET used_at=NOW() WHERE id=?')->execute([$invite['id']]);$db->prepare('UPDATE staff_sessions SET revoked_at=NOW() WHERE staff_user_id=?')->execute([$invite['staff_user_id']]);$db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['ready'=>true]);
}
function api_event_volunteer_presence(PDO $db,int $id): never {
    $actor=api_actor($db);$e=event_allowed($db,$actor,$id);$v=api_input();$sid=event_target($db,$id,'event_sessions',$v['sessionId']??null);$uid=(int)($v['userId']??$actor['id']);
    if(!$sid||($uid!==(int)$actor['id']&&$actor['access_level']!=='TPK_SUPER_ADMIN'))api_error('FORBIDDEN','Confirm only your own assigned attendance.',403);
    $q=$db->prepare("SELECT s.starts_at,s.ends_at FROM event_sessions s JOIN event_volunteer_assignments a ON a.event_id=s.event_id AND (a.session_id=s.id OR a.session_id IS NULL) JOIN event_volunteers v ON v.event_id=a.event_id AND v.staff_user_id=a.staff_user_id WHERE s.id=? AND s.event_id=? AND a.staff_user_id=? AND v.membership_status='ACTIVE' LIMIT 1");$q->execute([$sid,$id,$uid]);$session=$q->fetch();$now=(new DateTimeImmutable('now',new DateTimeZone($e['timezone'])))->format('Y-m-d H:i:s');
    if(!$session||$now<$session['starts_at']||$now>$session['ends_at']||event_lifecycle($e)!=='LIVE')api_error('SESSION_CLOSED','Attendance is available during your assigned live session.',409);
    $db->prepare('INSERT IGNORE INTO event_volunteer_attendance(event_id,staff_user_id,session_id,checked_in_at,recorded_by) VALUES(?,?,?,?,?)')->execute([$id,$uid,$sid,$now,$actor['id']]);api_audit($db,$actor,'EVENT_VOLUNTEER_ARRIVED','Event',$id);api_ok(['present'=>true]);
}
