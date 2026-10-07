<?php
declare(strict_types=1);
require dirname(__DIR__).'/config.php';
if(!in_array('--confirm',$argv,true)){fwrite(STDERR,"Use --confirm after taking a database backup.\n");exit(1);}
$db=db();
// MySQL DDL auto-commits; introspection makes a interrupted release resumable.
$sql=preg_replace('/^\s*--[^\n]*(?:\n|$)/m','',file_get_contents(__DIR__.'/../database/2026_event_history.sql'));
foreach(explode(';',$sql) as $statement){$statement=trim($statement);if(!$statement)continue;
 if(preg_match('/^ALTER TABLE (\w+) ADD COLUMN (\w+)/',$statement,$m)){
  $q=$db->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');$q->execute([$m[1],$m[2]]);if($q->fetchColumn())continue;
 }
 if(preg_match('/^ALTER TABLE (\w+) ADD CONSTRAINT (\w+)/',$statement,$m)){
  $q=$db->prepare('SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name=? AND constraint_name=?');$q->execute([$m[1],$m[2]]);if($q->fetchColumn())continue;
 }
 $db->exec($statement);
}
$campuses=[['PETRA-PRIME-ABUJA','Petra Prime Abuja'],['PETRA-MABUSHI','Petra Mabushi (Regional Campus)'],['PETRA-KUBWA','Petra Kubwa'],['PETRA-LUGBE','Petra Lugbe'],['PETRA-APO','Petra Apo'],['PETRA-MARARABA','Petra Mararaba']];
foreach($campuses as [$code,$name])$db->prepare("INSERT INTO campuses(code,name,timezone) VALUES(?,?,'Africa/Lagos') ON DUPLICATE KEY UPDATE code=VALUES(code)")->execute([$code,$name]);
$db->exec('UPDATE event_registrations r JOIN campuses c ON c.name COLLATE utf8mb4_unicode_ci=r.home_campus COLLATE utf8mb4_unicode_ci SET r.home_campus_id=c.id WHERE r.home_campus_id IS NULL');
echo "Event history schema ready; existing people, attendance and campus names preserved.\n";
