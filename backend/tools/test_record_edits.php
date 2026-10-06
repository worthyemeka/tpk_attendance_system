<?php
declare(strict_types=1);
require dirname(__DIR__).'/config.php';
require dirname(__DIR__).'/record-edits.php';
$pdo=db();$pdo->beginTransaction();
try {
    if(tpk_record_edit_parameters([false,true,null,'0'])!==[0,1,null,'0'])throw new RuntimeException('Boolean binding regression.');
    $actor=['campus_id'=>(int)$pdo->query('SELECT id FROM campuses ORDER BY id LIMIT 1')->fetchColumn()];
    $code='EDIT-TEST-'.bin2hex(random_bytes(6));
    $pdo->prepare('INSERT INTO families(campus_id,family_code,surname) VALUES(?,?,?)')->execute([$actor['campus_id'],$code,'Edit verification']);$familyId=(int)$pdo->lastInsertId();
    $classId=(int)$pdo->query('SELECT id FROM classes WHERE campus_id='.(int)$actor['campus_id'].' ORDER BY id LIMIT 1')->fetchColumn();
    $pdo->prepare("INSERT INTO children(family_id,class_id,first_name,last_name,date_of_birth,gender) VALUES(?,?,?,?,'2018-01-01','FEMALE')")->execute([$familyId,$classId,'Test','Child']);$childId=(int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO guardians(family_id,first_name,last_name,phone,relationship) VALUES(?,?,?,?,'Mother')")->execute([$familyId,'Test','Parent','08000000000']);$guardianId=(int)$pdo->lastInsertId();
    tpk_save_child_edit($pdo,$actor,$childId,['firstName'=>'Updated','active'=>false,'classAssignmentRequired'=>false,'careInformation'=>'Retain care notes']);
    $child=$pdo->query("SELECT first_name,is_active,class_assignment_required FROM children WHERE id=$childId")->fetch();
    if($child['first_name']!=='Updated'||(int)$child['is_active']!==0||(int)$child['class_assignment_required']!==0)throw new RuntimeException('Child edit failed.');
    if($pdo->query("SELECT other_relevant_care_information FROM child_care_profiles WHERE child_id=$childId")->fetchColumn()!=='Retain care notes')throw new RuntimeException('Care edit failed.');
    tpk_save_child_edit($pdo,$actor,$childId,['active'=>true,'classAssignmentRequired'=>true,'careInformation'=>null]);
    tpk_save_guardian_edit($pdo,$actor,$guardianId,['firstName'=>'Updated parent','primaryPhone'=>'+2348000000000','secondaryPhone'=>null,'email'=>'parent@example.invalid','homeAddress'=>'Test household','authorisedPickup'=>false]);
    $guardian=$pdo->query("SELECT first_name,phone,is_authorized FROM guardians WHERE id=$guardianId")->fetch();
    if($guardian['first_name']!=='Updated parent'||$guardian['phone']!=='08000000000'||(int)$guardian['is_authorized']!==0)throw new RuntimeException('Guardian edit failed.');
    if($pdo->query("SELECT home_address FROM families WHERE id=$familyId")->fetchColumn()!=='Test household')throw new RuntimeException('Household address edit failed.');
    try{tpk_save_guardian_edit($pdo,['campus_id'=>$actor['campus_id']+100000],$guardianId,['firstName'=>'Forbidden']);throw new RuntimeException('Cross-campus edit allowed.');}catch(OutOfBoundsException){}
    try{tpk_save_guardian_edit($pdo,$actor,$guardianId,['primaryPhone'=>'wrong']);throw new RuntimeException('Invalid phone allowed.');}catch(InvalidArgumentException){}
    echo "PASS: boolean false/true/null, child and care edits, parent contact/address edits, validation and campus isolation.\n";
}finally{$pdo->rollBack();echo "All synthetic records and audit entries rolled back; real records unchanged.\n";}
