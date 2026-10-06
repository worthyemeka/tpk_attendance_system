<?php
declare(strict_types=1);

function api_curriculum_ready(PDO $db): bool {return api_table_exists($db,'curriculum_resources')&&api_table_exists($db,'class_curriculum_profiles');}
function api_curriculum_date(?string $value): ?string {
    if(!$value)return null;
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    if(!$date||$date->format('Y-m-d')!==$value||$date->format('w')!=='0')api_error('VALIDATION_ERROR','Choose the Sunday this material belongs to.',422);
    return $value;
}
function api_curriculum_url(string $url): ?string {
    $url=trim($url);if($url==='')return null;
    $parts=parse_url($url);
    if(strlen($url)>1000||!filter_var($url,FILTER_VALIDATE_URL)||strtolower($parts['scheme']??'')!=='https'||empty($parts['host'])||isset($parts['user'])||isset($parts['pass']))api_error('VALIDATION_ERROR','Use a complete HTTPS video link without sign-in credentials.',422);
    return $url;
}
function api_curriculum(PDO $db): never {
    $actor=api_actor($db);$ready=api_curriculum_ready($db);
    $classes=$db->prepare('SELECT c.id,c.name,c.age_label AS ageLabel,c.min_age AS minAge,c.max_age AS maxAge,c.display_order AS displayOrder,c.is_active AS active,COUNT(ch.id) AS children FROM classes c LEFT JOIN children ch ON ch.class_id=c.id AND ch.is_active=1 WHERE c.campus_id=? GROUP BY c.id,c.name,c.age_label,c.min_age,c.max_age,c.display_order,c.is_active ORDER BY c.display_order,c.name');$classes->execute([(int)$actor['campus_id']]);$rows=$classes->fetchAll();
    if($ready){$p=$db->prepare('SELECT p.class_id,p.description FROM class_curriculum_profiles p JOIN classes c ON c.id=p.class_id WHERE c.campus_id=?');$p->execute([(int)$actor['campus_id']]);$descriptions=array_column($p->fetchAll(),'description','class_id');foreach($rows as &$row)$row['description']=$descriptions[$row['id']]??'';unset($row);}
    $month=(string)($_GET['month']??date('Y-m'));if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$month))api_error('VALIDATION_ERROR','Choose a valid month.',422);
    $start=$month.'-01';$end=(new DateTimeImmutable($start))->modify('+1 month')->format('Y-m-d');$items=[];
    if($ready){$where=['r.campus_id=?','(r.week_date>=? AND r.week_date<? OR r.week_date IS NULL)'];$params=[(int)$actor['campus_id'],$start,$end];
        if(($class=(int)($_GET['classId']??0))>0){$where[]='r.class_id=?';$params[]=$class;}
        $week=api_curriculum_date($_GET['week']??null);if($week){$where[]='(r.week_date=? OR r.week_date IS NULL)';$params[]=$week;}
        $q=$db->prepare("SELECT r.id,r.class_id AS classId,r.week_date AS weekDate,r.resource_type AS type,r.title,r.topic,r.description,r.video_url AS videoUrl,r.duration_minutes AS durationMinutes,r.setting,r.materials,r.instructions,r.original_name AS fileName,r.mime_type AS mimeType,r.byte_size AS size,r.created_at AS createdAt,r.created_by_staff_user_id AS authorId,p.profile_image_url AS authorProfileImageUrl,COALESCE(NULLIF(TRIM(CONCAT_WS(' ',p.title,p.first_name,p.last_name)),''),u.name) AS author FROM curriculum_resources r JOIN staff_users u ON u.id=r.created_by_staff_user_id LEFT JOIN teacher_profiles p ON p.staff_user_id=u.id WHERE ".implode(' AND ',$where).' ORDER BY r.week_date DESC,r.created_at DESC,r.id DESC');$q->execute($params);$items=$q->fetchAll();foreach($items as &$item)if($item['fileName'])$item['downloadUrl']='/api/v1/curriculum/resources/'.(int)$item['id'].'/file';unset($item);
    }
    api_ok(['classes'=>$rows,'items'=>$items,'month'=>$month,'available'=>$ready,'canManage'=>$actor['access_level']==='TPK_SUPER_ADMIN']);
}
function api_curriculum_upload(): ?array {
    $file=$_FILES['file']??null;if(!$file||($file['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE)return null;
    if(($file['error']??1)!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']??''))api_error('UPLOAD_FAILED','The material could not be uploaded. Try again with a smaller file.',422);
    $size=(int)$file['size'];if($size<1||$size>20*1024*1024)api_error('UPLOAD_TOO_LARGE','Use a file no larger than 20 MB.',422);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);$ext=strtolower(pathinfo($file['name'],PATHINFO_EXTENSION));
    $allowed=['pdf'=>['application/pdf'],'doc'=>['application/msword','application/x-ole-storage','application/CDFV2'],'ppt'=>['application/vnd.ms-powerpoint','application/x-ole-storage','application/CDFV2'],'docx'=>['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip'],'pptx'=>['application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip'],'jpg'=>['image/jpeg'],'jpeg'=>['image/jpeg'],'png'=>['image/png'],'webp'=>['image/webp'],'mp4'=>['video/mp4'],'webm'=>['video/webm'],'mov'=>['video/quicktime']];
    if(!isset($allowed[$ext])||!in_array($mime,$allowed[$ext],true))api_error('VALIDATION_ERROR','Use PDF, DOC, DOCX, PPT, PPTX, JPEG, PNG, WebP, MP4, MOV or WebM.',422);
    if(in_array($ext,['docx','pptx'],true)){
        if(!class_exists('ZipArchive'))api_error('STORAGE_UNAVAILABLE','Document validation is unavailable. Please use a PDF instead.',503);
        $zip=new ZipArchive();if($zip->open($file['tmp_name'])!==true)api_error('VALIDATION_ERROR','This document is not valid.',422);
        $valid=$zip->locateName($ext==='docx'?'word/document.xml':'ppt/presentation.xml')!==false;$zip->close();if(!$valid)api_error('VALIDATION_ERROR','This document is not valid.',422);
        $mime=$allowed[$ext][0];
    }
    if(str_starts_with($mime,'image/')&&!getimagesize($file['tmp_name']))api_error('VALIDATION_ERROR','This image is not valid.',422);
    return ['tmp'=>$file['tmp_name'],'name'=>substr(basename((string)$file['name']),0,255),'mime'=>$mime,'size'=>$size,'stored'=>bin2hex(random_bytes(20)).'.'.$ext];
}
function api_curriculum_save(PDO $db): never {
    $actor=api_actor($db,true);if(!api_curriculum_ready($db))api_error('FEATURE_NOT_READY','Curriculum storage must be installed before adding materials.',503);
    if(empty($_POST)&&(int)($_SERVER['CONTENT_LENGTH']??0)>0)api_error('UPLOAD_TOO_LARGE','The upload exceeds the server limit. Try a smaller file.',413);
    $v=$_POST;$type=(string)($v['type']??'');$class=(int)($v['classId']??0);$title=trim((string)($v['title']??''));$topic=trim((string)($v['topic']??''));$description=trim((string)($v['description']??''));
    if(!in_array($type,['LESSON','VIDEO','GAME'],true)||!$title||mb_strlen($title)>180||mb_strlen($topic)>180||mb_strlen($description)>4000)api_error('VALIDATION_ERROR','Choose a resource type and enter a concise title and description.',422);
    $week=api_curriculum_date($v['weekDate']??null);if(!$week&&$type!=='GAME')api_error('VALIDATION_ERROR','Assign the lesson or video to a Sunday.',422);
    $q=$db->prepare('SELECT id FROM classes WHERE id=? AND campus_id=? AND is_active=1');$q->execute([$class,(int)$actor['campus_id']]);if(!$q->fetch())api_error('CLASS_NOT_FOUND','Choose an active class at this campus.',422);
    $url=api_curriculum_url((string)($v['videoUrl']??''));$file=api_curriculum_upload();
    if($type==='LESSON'&&(!$file||!preg_match('/\.(pdf|docx?|pptx?)$/i',$file['name'])))api_error('VALIDATION_ERROR','Attach a PDF or teaching document for this lesson.',422);
    if($type==='VIDEO'&&$file&&!str_starts_with($file['mime'],'video/'))api_error('VALIDATION_ERROR','Attach a video file for video material.',422);
    if($type==='VIDEO'&&!$url&&(!$file||!str_starts_with($file['mime'],'video/')))api_error('VALIDATION_ERROR','Add a video link or video file.',422);
    $duration=(int)($v['durationMinutes']??0);$materials=trim((string)($v['materials']??''));$instructions=trim((string)($v['instructions']??''));$setting=trim((string)($v['setting']??''));
    if($type==='GAME'&&(!$duration||$duration<1||$duration>240||!$materials||!$instructions))api_error('VALIDATION_ERROR','Add the game duration, materials and how to play.',422);
    if(mb_strlen($materials)>4000||mb_strlen($instructions)>8000||mb_strlen($setting)>180)api_error('VALIDATION_ERROR','Keep game instructions and materials concise.',422);
    $path=null;$db->beginTransaction();try{
        if($file){$dir=dirname(__DIR__).'/storage/curriculum';if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))throw new RuntimeException('Unable to prepare curriculum storage.');$path=$dir.'/'.$file['stored'];if(!move_uploaded_file($file['tmp'],$path))throw new RuntimeException('Unable to save material.');chmod($path,0640);}
        $q=$db->prepare('INSERT INTO curriculum_resources(campus_id,class_id,week_date,resource_type,title,topic,description,video_url,duration_minutes,setting,materials,instructions,stored_name,original_name,mime_type,byte_size,created_by_staff_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');$q->execute([(int)$actor['campus_id'],$class,$week,$type,$title,$topic?:null,$description?:null,$url,$type==='GAME'?$duration:null,$setting?:null,$materials?:null,$instructions?:null,$file['stored']??null,$file['name']??null,$file['mime']??null,$file['size']??null,(int)$actor['id']]);$id=(int)$db->lastInsertId();api_audit($db,$actor,'CURRICULUM_RESOURCE_ADDED','CurriculumResource',$id,['classId'=>$class,'weekDate'=>$week,'type'=>$type]);$db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();if($path&&is_file($path))unlink($path);throw $e;}
    api_ok(['id'=>$id],201);
}
function api_curriculum_file(PDO $db,int $id): never {
    $actor=api_actor($db);if(!api_curriculum_ready($db))api_error('FILE_NOT_FOUND','This material is not available.',404);
    $q=$db->prepare('SELECT stored_name,original_name,mime_type FROM curriculum_resources WHERE id=? AND campus_id=?');$q->execute([$id,(int)$actor['campus_id']]);$file=$q->fetch();
    if(!$file||!preg_match('/^[a-f0-9]{40}\.(pdf|docx?|pptx?|jpe?g|png|webp|mp4|mov|webm)$/',$file['stored_name']??''))api_error('FILE_NOT_FOUND','This material is not available.',404);
    $path=dirname(__DIR__).'/storage/curriculum/'.$file['stored_name'];if(!is_file($path))api_error('FILE_NOT_FOUND','The original material is unavailable.',404);
    header('Access-Control-Allow-Origin: '.tpk_cors_origin());header('Vary: Origin');header('Content-Type: '.$file['mime_type']);header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header('Content-Disposition: attachment; filename="'.str_replace(['"',"\r","\n"],'',basename($file['original_name'])).'"');readfile($path);exit;
}
function api_curriculum_class_save(PDO $db,int $id=0): never {
    $actor=api_actor($db,true);if(!api_curriculum_ready($db))api_error('FEATURE_NOT_READY','Curriculum storage must be installed before editing classes.',503);$v=api_input();
    $name=trim((string)($v['name']??''));$description=trim((string)($v['description']??''));$min=filter_var($v['minAge']??null,FILTER_VALIDATE_INT);$max=filter_var($v['maxAge']??null,FILTER_VALIDATE_INT);$order=filter_var($v['displayOrder']??0,FILTER_VALIDATE_INT);$active=($v['active']??true)?1:0;
    if(!$name||mb_strlen($name)>100||mb_strlen($description)>2000||$min===false||$max===false||$min<3||$max<$min||$max>99||$order===false||$order<0)api_error('VALIDATION_ERROR','Check the class name, age range (3 or older) and display order.',422);
    if($id){$q=$db->prepare('SELECT id FROM classes WHERE id=? AND campus_id=?');$q->execute([$id,(int)$actor['campus_id']]);if(!$q->fetch())api_error('CLASS_NOT_FOUND','Class not found at your campus.',404);}
    if($active){$q=$db->prepare('SELECT id FROM classes WHERE campus_id=? AND is_active=1 AND id<>? AND min_age<=? AND max_age>=?');$q->execute([(int)$actor['campus_id'],$id,$max,$min]);if($q->fetch())api_error('OVERLAPPING_AGES','This age range overlaps an active class. Use separate ranges for reliable automatic placement.',422);}
    $db->beginTransaction();try{$label="Ages {$min}–{$max}";
        if($id)$db->prepare('UPDATE classes SET name=?,age_label=?,min_age=?,max_age=?,display_order=?,is_active=? WHERE id=? AND campus_id=?')->execute([$name,$label,$min,$max,$order,$active,$id,(int)$actor['campus_id']]);
        else{$db->prepare('INSERT INTO classes(campus_id,name,age_label,min_age,max_age,display_order,is_active) VALUES(?,?,?,?,?,?,?)')->execute([(int)$actor['campus_id'],$name,$label,$min,$max,$order,$active]);$id=(int)$db->lastInsertId();}
        $db->prepare('INSERT INTO class_curriculum_profiles(class_id,description) VALUES(?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)')->execute([$id,$description?:null]);api_audit($db,$actor,'CURRICULUM_CLASS_SAVED','Class',$id);$db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}api_ok(['id'=>$id]);
}
