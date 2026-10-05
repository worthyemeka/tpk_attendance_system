<?php
declare(strict_types=1);

function api_assembly_uploads(): array {
    if(!isset($_FILES['media']))return [];
    $f=$_FILES['media'];$uploads=[];$total=0;
    if(!is_array($f['name'])||count($f['name'])>6)api_error('VALIDATION_ERROR','Attach up to six pictures or videos.',422);
    $types=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm','video/quicktime'=>'mov'];
    foreach($f['name'] as $i=>$name){
        if($f['error'][$i]===UPLOAD_ERR_NO_FILE)continue;
        if($f['error'][$i]!==UPLOAD_ERR_OK)api_error('UPLOAD_FAILED','The attachment could not be uploaded. Try a smaller file.',422);
        $tmp=$f['tmp_name'][$i];$size=(int)$f['size'][$i];
        if(!is_uploaded_file($tmp))api_error('UPLOAD_FAILED','The attachment could not be uploaded.',422);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($tmp);
        if(!isset($types[$mime])||$size<1||$size>20*1024*1024||(str_starts_with($mime,'image/')&&$size>5*1024*1024))api_error('VALIDATION_ERROR','Use JPEG, PNG or WebP pictures up to 5 MB, or MP4, MOV or WebM videos up to 20 MB.',422);
        if(str_starts_with($mime,'image/')&&!getimagesize($tmp))api_error('VALIDATION_ERROR','This picture is not valid.',422);
        $total+=$size;if($total>25*1024*1024)api_error('VALIDATION_ERROR','Keep the combined attachments below 25 MB.',422);
        $uploads[]=['tmp'=>$tmp,'name'=>substr(basename((string)$name),0,255),'mime'=>$mime,'size'=>$size,'stored'=>bin2hex(random_bytes(20)).'.'.$types[$mime]];
    }
    return$uploads;
}
function api_assembly_media_dir(): string { return dirname(__DIR__).'/storage/assembly-media'; }
function api_assembly_store_media(PDO $db,array $actor,int $id,array $uploads,array &$written): void {
    if(!$uploads)return;
    $dir=api_assembly_media_dir();if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))throw new RuntimeException('Unable to prepare media storage.');
    foreach($uploads as $file){
        $path=$dir.'/'.$file['stored'];if(!move_uploaded_file($file['tmp'],$path))throw new RuntimeException('Unable to save attachment.');$written[]=$path;chmod($path,0640);
        $q=$db->prepare('INSERT INTO assembly_activity_media(activity_id,stored_name,original_name,mime_type,byte_size,created_by_staff_user_id) VALUES(?,?,?,?,?,?)');$q->execute([$id,$file['stored'],$file['name'],$file['mime'],$file['size'],(int)$actor['id']]);
    }
}
function api_assembly_activity_media(PDO $db,int $id): array {
    if(!api_table_exists($db,'assembly_activity_media'))return[];
    $q=$db->prepare('SELECT id,original_name AS name,mime_type AS mimeType,byte_size AS size FROM assembly_activity_media WHERE activity_id=? ORDER BY id');$q->execute([$id]);$rows=$q->fetchAll();foreach($rows as &$r)$r['url']='/api/v1/assembly/media/'.(int)$r['id'];return$rows;
}
function api_assembly_media_download(PDO $db,int $id): never {
    $actor=api_actor($db);
    if(!api_table_exists($db,'assembly_activity_media'))api_error('MEDIA_NOT_FOUND','This attachment was not found.',404);
    $q=$db->prepare('SELECT m.*,a.service_session_id FROM assembly_activity_media m JOIN assembly_activities a ON a.id=m.activity_id WHERE m.id=? AND a.campus_id=?');$q->execute([$id,(int)$actor['campus_id']]);$file=$q->fetch();
    if(!$file)api_error('MEDIA_NOT_FOUND','This attachment was not found.',404);
    if(!api_service_duty($db,$actor,(int)$file['service_session_id']))api_error('FORBIDDEN','This attachment is outside your assigned service.',403);
    if(!preg_match('/^[a-f0-9]{40}\.(jpg|png|webp|mp4|mov|webm)$/',$file['stored_name']))api_error('MEDIA_NOT_FOUND','This attachment was not found.',404);
    $path=api_assembly_media_dir().'/'.$file['stored_name'];if(!is_file($path))api_error('MEDIA_NOT_FOUND','This attachment is unavailable.',404);
    header('Content-Type: '.$file['mime_type']);header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header('Content-Length: '.filesize($path));header('Content-Disposition: inline');readfile($path);exit;
}
