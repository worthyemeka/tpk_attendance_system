<?php
declare(strict_types=1);

// A directory is not an operational check-in or safeguarding workflow.
function api_basic_teacher(array $actor):bool{return $actor['access_level']==='TPK_ADMIN';}
function api_without_household_addresses(mixed $data):mixed{
    if(!is_array($data))return $data;
    $safe=[];foreach($data as $key=>$value){if(in_array($key,['homeAddress','home_address','houseAddress','house_address'],true))continue;$safe[$key]=api_without_household_addresses($value);}return $safe;
}
function api_safe_children(PDO $db,array $actor,?int $id=null):array{
    $where=['f.campus_id=?','c.is_active=1'];$params=[(int)$actor['campus_id']];
    if($id!==null){$where[]='c.id=?';$params[]=$id;}
    $q=trim((string)($_GET['search']??''));if($q!==''){$where[]="(c.first_name LIKE ? OR c.last_name LIKE ? OR EXISTS(SELECT 1 FROM child_guardians cg JOIN guardians g ON g.id=cg.guardian_id WHERE cg.child_id=c.id AND (g.first_name LIKE ? OR g.last_name LIKE ?)))";array_push($params,...array_fill(0,4,"%$q%"));}
    $filter=' WHERE '.implode(' AND ',$where);
    $count=$db->prepare('SELECT COUNT(*) FROM children c JOIN families f ON f.id=c.family_id'.$filter);$count->execute($params);$total=(int)$count->fetchColumn();
    [$page,$limit,$offset]=$id===null?api_page():[1,1,0];
    $order=strtolower((string)($_GET['order']??'asc'))==='desc'?'DESC':'ASC';
    $s=$db->prepare("SELECT c.id,TRIM(CONCAT(c.first_name,' ',c.last_name)) AS name,cp.id AS homeCampusId,cp.name AS homeCampus,COALESCE((SELECT GROUP_CONCAT(DISTINCT TRIM(CONCAT(g.first_name,' ',g.last_name)) ORDER BY cg.is_primary DESC,g.first_name SEPARATOR ' · ') FROM child_guardians cg JOIN guardians g ON g.id=cg.guardian_id WHERE cg.child_id=c.id),'') AS guardianName FROM children c JOIN families f ON f.id=c.family_id JOIN campuses cp ON cp.id=f.campus_id$filter ORDER BY c.first_name $order,c.last_name $order,c.id $order LIMIT $limit OFFSET $offset");$s->execute($params);
    return ['rows'=>$s->fetchAll(),'meta'=>['page'=>$page,'limit'=>$limit,'total'=>$total,'totalPages'=>max(1,(int)ceil($total/$limit))]];
}
