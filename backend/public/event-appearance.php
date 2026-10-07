<?php
declare(strict_types=1);
function event_default_palette():array{return ['primary'=>'#46501c','secondary'=>'#392b17','accent'=>'#d9a52c','surface'=>'#faf8ef','text'=>'#29321d','onPrimary'=>'#ffffff','onAccent'=>'#171c11'];}
function event_colour_luminance(string $hex):float{$v=[];foreach([1,3,5] as $i){$c=hexdec(substr($hex,$i,2))/255;$v[]=$c<=.04045?$c/12.92:pow(($c+.055)/1.055,2.4);}return $v[0]*.2126+$v[1]*.7152+$v[2]*.0722;}
function event_colour_contrast(string $a,string $b):float{$x=event_colour_luminance($a);$y=event_colour_luminance($b);return (max($x,$y)+.05)/(min($x,$y)+.05);}
function event_palette($value):array{
 if(!is_array($value))api_error('VALIDATION_ERROR','Upload an image to generate a valid colour palette.',422);$result=[];
 foreach(array_keys(event_default_palette()) as $key){$c=$value[$key]??'';if(!is_string($c)||!preg_match('/^#[a-f0-9]{6}$/i',$c))api_error('VALIDATION_ERROR','Use valid six-digit theme colours.',422);$result[$key]=strtolower($c);}
 foreach([['primary','onPrimary'],['accent','onAccent'],['surface','text']] as [$bg,$fg])if(event_colour_contrast($result[$bg],$result[$fg])<4.5)api_error('VALIDATION_ERROR','The generated theme needs readable text contrast. Choose another image or use the Jungle preset.',422);
 if(event_colour_contrast($result['secondary'],'#ffffff')<4.5)api_error('VALIDATION_ERROR','The sidebar colour needs readable white text.',422);
 return $result;
}
function event_appearance_value(array $row):array{$row['palette']=$row['palette_json']?json_decode($row['palette_json'],true):($row['preset']==='JUNGLE'?event_default_palette():null);unset($row['palette_json']);return $row;}
function event_theme_available(array $event):bool{
 $phase=event_lifecycle($event);return !in_array($phase,['DRAFT','CANCELLED'],true)&&(!in_array($phase,['ARCHIVED','COMPLETED'],true)||!empty($event['preserve_after']));
}
function api_event_appearance(PDO $db,int $id):never{
 $actor=api_actor($db,true);$event=event_allowed($db,$actor,$id);$v=api_input();$preset=$v['preset']??'DEFAULT';if(!in_array($preset,['DEFAULT','JUNGLE','CUSTOM'],true))api_error('VALIDATION_ERROR','Choose a supported appearance.',422);
 $file=(int)($v['artworkFileId']??0);if($file){$q=$db->prepare("SELECT id FROM event_source_files WHERE id=? AND event_id=? AND mime_type IN ('image/png','image/jpeg','image/webp')");$q->execute([$file,$id]);if(!$q->fetchColumn())api_error('VALIDATION_ERROR','Upload image artwork belonging to this event.',422);}
 $palette=$preset==='CUSTOM'?event_palette($v['palette']??null):($preset==='JUNGLE'?event_default_palette():null);
 $past=in_array(event_lifecycle($event),['ARCHIVED','COMPLETED'],true);
 $db->prepare('INSERT INTO event_appearances(event_id,preset,enabled,apply_dashboard,preserve_after,palette_json,artwork_file_id,artwork_url,updated_by) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE preset=VALUES(preset),enabled=VALUES(enabled),apply_dashboard=VALUES(apply_dashboard),preserve_after=VALUES(preserve_after),palette_json=VALUES(palette_json),artwork_file_id=VALUES(artwork_file_id),artwork_url=VALUES(artwork_url),updated_by=VALUES(updated_by)')->execute([$id,$preset,(int)!empty($v['enabled']),$past?0:(int)!empty($v['applyDashboard']),(int)!empty($v['preserveAfter']),$palette?json_encode($palette):null,$file?:null,event_url($v['artworkUrl']??null),$actor['id']]);
 api_audit($db,$actor,'EVENT_APPEARANCE_UPDATED','Event',$id);api_ok(['id'=>$id]);
}
function api_staff_appearance(PDO $db):never{
 $actor=api_actor($db);$scope=$actor['access_level']==='EVENT_VOLUNTEER'?"EXISTS (SELECT 1 FROM event_volunteers v WHERE v.event_id=e.id AND v.staff_user_id=? AND v.membership_status='ACTIVE')":'e.campus_id=?';
 $q=$db->prepare("SELECT e.*,a.preset,a.preserve_after,a.apply_dashboard,a.palette_json,a.artwork_url,a.artwork_file_id FROM ministry_events e JOIN event_appearances a ON a.event_id=e.id WHERE $scope AND a.enabled=1 AND a.preset<>'DEFAULT' ORDER BY e.starts_on DESC,e.id DESC");$q->execute([$actor['access_level']==='EVENT_VOLUNTEER'?$actor['id']:$actor['campus_id']]);$events=array_values(array_filter($q->fetchAll(),'event_theme_available'));
 if(api_method()==='PATCH'){$v=api_input();$p=$v['preference']??'';$selected=(int)($v['selectedEventId']??0);if(!in_array($p,['DEFAULT','EVENT'],true))api_error('VALIDATION_ERROR','Choose default TPK or an event appearance.',422);if($selected&&!array_filter($events,fn($e)=>(int)$e['id']===$selected))api_error('FORBIDDEN','This event appearance is not available for your account.',403);$db->prepare('INSERT INTO staff_appearance_preferences(staff_user_id,preference,selected_event_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE preference=VALUES(preference),selected_event_id=VALUES(selected_event_id)')->execute([$actor['id'],$p,$p==='EVENT'&&$selected?$selected:null]);}
 $q=$db->prepare('SELECT preference,selected_event_id FROM staff_appearance_preferences WHERE staff_user_id=?');$q->execute([$actor['id']]);$pref=$q->fetch()?:['preference'=>'DEFAULT','selected_event_id'=>null];$active=null;$available=[];
 foreach($events as $e){$value=event_appearance_value($e);$theme=['eventId'=>(int)$e['id'],'name'=>$e['name'],'preset'=>$e['preset'],'palette'=>$value['palette'],'artworkUrl'=>$e['artwork_url'],'artworkFileId'=>$e['artwork_file_id']];$phase=event_lifecycle($e);$available[]=$theme+['lifecycle'=>$phase];if($pref['preference']!=='EVENT')continue;
  if($pref['selected_event_id']){if((int)$pref['selected_event_id']===(int)$e['id']&&$phase!=='UPCOMING')$active=$theme;}
  elseif(!$active&&$e['apply_dashboard']&&($phase==='LIVE'||($phase==='COMPLETED'&&$e['preserve_after'])))$active=$theme;
 }
 api_ok(['preference'=>$pref['preference'],'selectedEventId'=>$pref['selected_event_id'],'active'=>$active,'available'=>$available]);
}
