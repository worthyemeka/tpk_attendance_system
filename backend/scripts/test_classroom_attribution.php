<?php
declare(strict_types=1);

// Read-only contract regression: no connection to a real database.
require __DIR__.'/../public/classroom-interactions.php';
require __DIR__.'/../public/assembly-media.php';
function api_table_exists(PDO $db,string $table): bool {return true;}
function api_error(string $code,string $message,int $status=400): never {throw new RuntimeException($message);}
class PhotoResult extends RuntimeException {public function __construct(public array $data){parent::__construct('Captured photos');}}
function api_actor(PDO $db): array {return ['id'=>9,'campus_id'=>1,'access_level'=>'TPK_ADMIN'];}
function api_ok(array $data,int $status=200): never {throw new PhotoResult($data);}
class AttributionStatement extends PDOStatement {
    public function __construct(private array $rows) {}
    public function execute(?array $params=null): bool {return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $orientation=PDO::FETCH_ORI_NEXT,int $offset=0): mixed {return $this->rows[0]??false;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array {return $this->rows;}
    public function fetchColumn(int $column=0): mixed {return false;}
}
class AttributionDatabase extends PDO {
    public array $queries=[];
    public function __construct() {}
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $this->queries[]=$query;
        $rows=match(true){
            str_contains($query,'FROM classroom_weekly_reviews')=>[['id'=>1,'class_id'=>2,'service_session_id'=>3]],
            str_contains($query,'FROM service_sessions')=>[['id'=>3,'service_date'=>'2026-10-04','service_type'=>'FIRST_SERVICE']],
            str_contains($query,'FROM classroom_review_replies')=>[['id'=>1,'authorId'=>9,'author'=>'Auntie Grace','authorProfileImageUrl'=>'/uploads/profiles/grace.jpg','body'=>'Well done','createdAt'=>'2026-10-05 10:00:00'],['id'=>2,'authorId'=>10,'author'=>'Uncle Daniel','authorProfileImageUrl'=>null,'body'=>'Thank you','createdAt'=>'2026-10-05 11:00:00']],
            str_contains($query,'FROM assembly_activity_media')=>[['id'=>4,'name'=>'Sunday.mp4','mimeType'=>'video/mp4','size'=>100,'createdAt'=>'2026-10-05 14:20:00']],
            str_contains($query,'FROM staff_users')=>[['id'=>9,'profileImageUrl'=>'/uploads/profiles/grace.jpg']],
            default=>[],
        };
        return new AttributionStatement($rows);
    }
}
function attributionCheck(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$db=new AttributionDatabase();
$discussion=api_discussion_payload($db,['id'=>9,'campus_id'=>1,'access_level'=>'TPK_SUPER_ADMIN'],1);
attributionCheck($discussion['replies'][0]['authorProfileImageUrl']==='/uploads/profiles/grace.jpg','Reply photo must belong to its author.');
attributionCheck($discussion['replies'][1]['authorProfileImageUrl']===null,'A teacher without a photo must remain supported.');
attributionCheck(str_contains(implode("\n",$db->queries),'p.profile_image_url AS authorProfileImageUrl'),'Reply query must actually select the photo.');
$media=api_assembly_activity_media($db,7);
attributionCheck($media[0]['createdAt']==='2026-10-05 14:20:00','Keep attachment upload date distinct from the Sunday date.');
attributionCheck($media[0]['url']==='/api/v1/assembly/media/4','Attachment URLs must still use the protected download route.');
attributionCheck(str_contains(end($db->queries),'created_at AS createdAt'),'Media query must select its stored timestamp.');
$reviewSource=file_get_contents(__DIR__.'/../public/v1.php');
attributionCheck(str_contains($reviewSource,'r.created_by_staff_user_id AS authorId,p.profile_image_url AS authorProfileImageUrl'),'Weekly review photo must be joined through its recorded author.');
$assemblySource=file_get_contents(__DIR__.'/../public/assembly-context.php');
attributionCheck(str_contains($assemblySource,'n.created_by_staff_user_id AS authorId,p.profile_image_url AS authorProfileImageUrl'),'Assembly notes must select the note author photo.');
try{api_teacher_photos($db);}catch(PhotoResult $result){attributionCheck($result->data[0]['id']===9,'Photos retain the recorded staff ID.');}
attributionCheck(str_contains(end($db->queries),'WHERE u.campus_id=?'),'Photo fallback remains restricted to the authenticated campus.');
attributionCheck(!str_contains(end($db->queries),'email')&&!str_contains(end($db->queries),'phone'),'Photo fallback must not expose contact information.');
echo "Classroom attribution API checks passed (11 cases).\n";
