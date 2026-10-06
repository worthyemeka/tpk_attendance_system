<?php
declare(strict_types=1);

/** PDO execute(array) treats false as an empty string; MySQL strict mode rejects
 * that for TINYINT columns. Preserve nulls and store booleans explicitly as 0/1. */
function tpk_record_edit_parameters(array $values): array {
    return array_map(fn($value) => is_bool($value) ? (int)$value : $value, $values);
}

function tpk_save_child_edit(PDO $db, array $actor, int $id, array $values): void {
    $fields=['firstName'=>'first_name','lastName'=>'last_name','dateOfBirth'=>'date_of_birth','gender'=>'gender','schoolGrade'=>'school_grade','classId'=>'class_id','active'=>'is_active','classAssignmentRequired'=>'class_assignment_required'];
    $sets=[];$params=[];
    foreach($fields as $input=>$column)if(array_key_exists($input,$values)){$sets[]="c.$column=?";$params[]=$values[$input];}
    if(!$sets&&!array_key_exists('careInformation',$values))throw new InvalidArgumentException('No editable child fields were supplied.');
    if(!empty($values['classId'])){
        $class=$db->prepare('SELECT id FROM classes WHERE id=? AND campus_id=?');$class->execute([$values['classId'],$actor['campus_id']]);
        if(!$class->fetchColumn())throw new InvalidArgumentException('Choose a class configured for this campus.');
    }
    $ownsTransaction=!$db->inTransaction();if($ownsTransaction)$db->beginTransaction();
    try {
        if($sets){$params[]=$id;$params[]=$actor['campus_id'];$db->prepare('UPDATE children c JOIN families f ON f.id=c.family_id SET '.implode(',',$sets).' WHERE c.id=? AND f.campus_id=?')->execute(tpk_record_edit_parameters($params));}
        if(array_key_exists('careInformation',$values))$db->prepare('INSERT INTO child_care_profiles(child_id,other_relevant_care_information) VALUES(?,?) ON DUPLICATE KEY UPDATE other_relevant_care_information=VALUES(other_relevant_care_information)')->execute([$id,$values['careInformation']]);
        audit($db,(int)$actor['campus_id'],'CHILD_UPDATED','Child',$id,array_keys($values));
        if($ownsTransaction)$db->commit();
    }catch(Throwable $error){if($ownsTransaction&&$db->inTransaction())$db->rollBack();throw $error;}
}

function tpk_save_guardian_edit(PDO $db, array $actor, int $id, array $values): void {
    $find=$db->prepare('SELECT g.id,g.family_id,g.is_primary FROM guardians g JOIN families f ON f.id=g.family_id WHERE g.id=? AND f.campus_id=?');$find->execute([$id,$actor['campus_id']]);$guardian=$find->fetch();
    if(!$guardian)throw new OutOfBoundsException('Guardian not found.');
    $fields=['firstName'=>'first_name','lastName'=>'last_name','primaryPhone'=>'phone','secondaryPhone'=>'secondary_phone','email'=>'email','relationship'=>'relationship','primary'=>'is_primary','authorisedPickup'=>'is_authorized'];$sets=[];$params=[];
    foreach($fields as $input=>$column)if(array_key_exists($input,$values)){
        $value=$values[$input];
        if(in_array($input,['primaryPhone','secondaryPhone'],true)){
            $digits=preg_replace('/\D+/','',(string)$value);if(str_starts_with($digits,'234')&&strlen($digits)===13)$digits='0'.substr($digits,3);
            $value=strlen($digits)===11&&str_starts_with($digits,'0')?$digits:null;
            if(($input==='primaryPhone'&&!$value)||($input==='secondaryPhone'&&trim((string)$values[$input])!==''&&!$value))throw new InvalidArgumentException('Enter a valid Nigerian phone number.');
        }
        if(in_array($input,['firstName','lastName','relationship'],true)&&trim((string)$value)==='')throw new InvalidArgumentException('Complete the guardian name and relationship.');
        if($input==='email'&&$value!==null&&$value!==''&&!filter_var($value,FILTER_VALIDATE_EMAIL))throw new InvalidArgumentException('Enter a valid email address.');
        $sets[]="$column=?";$params[]=$value;
    }
    if(!$sets&&!array_key_exists('homeAddress',$values))throw new InvalidArgumentException('No editable guardian fields were supplied.');
    $ownsTransaction=!$db->inTransaction();if($ownsTransaction)$db->beginTransaction();
    try {
        if($sets){$params[]=$id;$db->prepare('UPDATE guardians SET '.implode(',',$sets).' WHERE id=?')->execute(tpk_record_edit_parameters($params));}
        if(array_key_exists('homeAddress',$values))$db->prepare('UPDATE families SET home_address=? WHERE id=? AND campus_id=?')->execute([$values['homeAddress'],$guardian['family_id'],$actor['campus_id']]);
        audit($db,(int)$actor['campus_id'],'GUARDIAN_UPDATED','Guardian',$id,array_keys($values));
        if($ownsTransaction)$db->commit();
    }catch(Throwable $error){if($ownsTransaction&&$db->inTransaction())$db->rollBack();throw $error;}
}
