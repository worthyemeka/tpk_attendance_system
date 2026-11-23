<?php
declare(strict_types=1);

/* Shared notification policy, outbox and official Meta Cloud API adapter.
 * This file performs no network work while a ministry action is being saved.
 */

final class TpkWhatsappProviderException extends RuntimeException {
    public int $httpStatus;
    public bool $retryable;
    public function __construct(int $httpStatus, bool $retryable, string $safeMessage) {
        $this->httpStatus = $httpStatus;
        $this->retryable = $retryable;
        parent::__construct($safeMessage);
    }
}

function tpk_notification_global_enabled(string $name): bool {
    return in_array(strtolower(trim((string)getenv($name))), ['1','true','yes','on'], true);
}

function tpk_notification_category(string $type, string $severity = 'MEDIUM'): array {
    $map = [
        'SUNDAY_SIGNIN_REMINDER' => ['SUNDAY_REMINDERS','OPTIONAL'],
        'TEACHER_BIRTHDAY' => ['BIRTHDAYS','OPTIONAL'], 'BIRTHDAY_GREETING' => ['BIRTHDAYS','OPTIONAL'],
        'FOLLOW_UP_ASSIGNED' => ['WELFARE','ESSENTIAL'],
        'ROSTER_PUBLISHED' => ['ROSTER_UPDATES','ESSENTIAL'], 'ROSTER_REMINDER' => ['ROSTER_UPDATES','OPTIONAL'],
        'DUTY_ASSIGNED' => ['DUTY_CHANGES','ESSENTIAL'], 'DUTY_CHANGED' => ['DUTY_CHANGES','ESSENTIAL'], 'DUTY_REMOVED' => ['DUTY_CHANGES','ESSENTIAL'],
        'SUNDAY_SERVICE_REMINDER' => ['SUNDAY_REMINDERS','OPTIONAL'], 'MDWK_SERVICE_REMINDER' => ['MDWK_REMINDERS','OPTIONAL'],
        'TEACHER_CHECKIN_REMINDER' => ['TEACHER_CHECKIN','OPTIONAL'], 'WELFARE_FOLLOWUP_ASSIGNED' => ['WELFARE','ESSENTIAL'],
        'WELFARE_FOLLOWUP_ESCALATED' => ['WELFARE','ESSENTIAL'], 'PROBATION_UPDATE' => ['PROBATION','OPTIONAL'],
        'EVENT_ASSIGNMENT' => ['EVENTS','OPTIONAL'], 'VBS_VOLUNTEER_ASSIGNMENT' => ['EVENTS','OPTIONAL'],
        'SYSTEM_NOTICE' => [strtoupper($severity)==='URGENT'?'SYSTEM_URGENT':'SYSTEM',strtoupper($severity)==='URGENT'?'ESSENTIAL':'OPTIONAL'],
    ];
    return $map[$type] ?? ['SYSTEM','INFO'];
}

function tpk_notification_preferences(PDO $db, int $staffId): array {
    $q=$db->prepare('SELECT whatsapp_enabled AS whatsappEnabled,push_enabled AS pushEnabled,email_enabled AS emailEnabled,whatsapp_consent AS whatsappConsent,whatsapp_consent_at AS consentAt,whatsapp_withdrawn_at AS withdrawnAt FROM staff_notification_preferences WHERE staff_user_id=?');
    $q->execute([$staffId]);
    $row=$q->fetch(PDO::FETCH_ASSOC) ?: ['whatsappEnabled'=>0,'pushEnabled'=>0,'emailEnabled'=>0,'whatsappConsent'=>0,'consentAt'=>null,'withdrawnAt'=>null];
    foreach(['whatsappEnabled','pushEnabled','emailEnabled','whatsappConsent'] as $key)$row[$key]=(bool)$row[$key];
    return $row;
}

function tpk_notification_category_preferences(PDO $db, int $staffId): array {
    $q=$db->prepare('SELECT category,whatsapp_enabled AS whatsappEnabled,push_enabled AS pushEnabled,email_enabled AS emailEnabled FROM staff_notification_category_preferences WHERE staff_user_id=?');
    $q->execute([$staffId]);$out=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row)$out[$row['category']]=['whatsapp'=>(bool)$row['whatsappEnabled'],'push'=>(bool)$row['pushEnabled'],'email'=>(bool)$row['emailEnabled']];
    return $out;
}

function tpk_notification_channel_allowed(PDO $db, int $staffId, string $category, string $channel, string $importance): bool {
    if($channel==='IN_APP')return true;
    $prefs=tpk_notification_preferences($db,$staffId);$field=strtolower($channel).'Enabled';
    if(empty($prefs[$field]))return false;
    $categoryPrefs=tpk_notification_category_preferences($db,$staffId);
    if(array_key_exists($category,$categoryPrefs))return $categoryPrefs[$category][strtolower($channel)] ?? false;
    // Category defaults remain conservative. Opt-in is never a blanket opt-in
    // to every reminder category.
    return $importance==='ESSENTIAL' && in_array($category,['ROSTER_UPDATES','DUTY_CHANGES','WELFARE','SYSTEM_URGENT'],true);
}

function tpk_notification_delivery_row(PDO $db,int $notificationId,?int $staffId,string $channel,?string $recipient,string $provider,string $status,?string $reason=null): void {
    $db->prepare('INSERT INTO notification_deliveries(notification_id,staff_user_id,channel,recipient,provider,status,attempted_at,sent_at,failed_at,failure_reason) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)')
        ->execute([$notificationId,$staffId,$channel,$recipient,$provider,$status,$status==='SENT'?date('Y-m-d H:i:s'):null,$status==='SENT'?date('Y-m-d H:i:s'):null,$status==='FAILED'?date('Y-m-d H:i:s'):null,$reason]);
}

function tpk_notification_url(string $path): string {
    $origin=rtrim((string)(getenv('TPK_FRONTEND_URL') ?: getenv('FRONTEND_ORIGIN') ?: ''),'/');
    if(!filter_var($origin,FILTER_VALIDATE_URL) || parse_url($origin,PHP_URL_SCHEME)!=='https')throw new RuntimeException('Notification site URL is not configured.');
    if(!str_starts_with($path,'/account/') || str_starts_with($path,'//'))$path='/account/overview';
    return $origin.$path;
}

/** Persist an in-app notification and its channel decisions. Never calls a provider. */
function tpk_create_notification(PDO $db,array $notice): array {
    $type=strtoupper(trim((string)($notice['type']??'')));$staffId=(int)($notice['staffUserId']??0);$campusId=(int)($notice['campusId']??0);
    if(!$type||!$staffId||!$campusId)throw new InvalidArgumentException('Notification recipient and type are required.');
    [$defaultCategory,$defaultImportance]=tpk_notification_category($type,(string)($notice['severity']??'MEDIUM'));
    $category=(string)($notice['category']??$defaultCategory);$importance=(string)($notice['importance']??$defaultImportance);
    $payload=is_array($notice['payload']??null)?$notice['payload']:[];
    $dedupe=trim((string)($notice['dedupeKey']??''));
    $s=$db->prepare('INSERT INTO notifications(campus_id,staff_user_id,type,category,importance,title,body,target_path,dedupe_key,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?)');
    try{$s->execute([$campusId,$staffId,$type,$category,$importance,mb_substr((string)($notice['title']??'TPK update'),0,180),mb_substr((string)($notice['body']??''),0,500),(string)($notice['targetPath']??'/account/overview'),$dedupe!==''?$dedupe:null,$payload?json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR):null]);$id=(int)$db->lastInsertId();$created=true;}
    catch(PDOException $e){if($e->getCode()!=='23000'||$dedupe==='')throw $e;$q=$db->prepare('SELECT id FROM notifications WHERE dedupe_key=?');$q->execute([$dedupe]);$id=(int)$q->fetchColumn();if(!$id)throw $e;$created=false;}
    if(!$created)return ['id'=>$id,'created'=>false];
    tpk_notification_delivery_row($db,$id,$staffId,'IN_APP',null,'TPK','SENT');
    $person=$db->prepare("SELECT s.email,s.is_active,s.team_status,s.account_status,s.access_level,p.whatsapp_number_normalized AS whatsappNumber FROM staff_users s LEFT JOIN teacher_profiles p ON p.staff_user_id=s.id WHERE s.id=? AND s.campus_id=?");$person->execute([$staffId,$campusId]);$recipient=$person->fetch(PDO::FETCH_ASSOC)?:[];
    foreach(['WHATSAPP','PUSH','EMAIL'] as $channel){
        $provider=$channel==='WHATSAPP'?'META':($channel==='EMAIL'?'TPK_MAIL':'TPK_PUSH');$enabled=$channel==='WHATSAPP'?tpk_notification_global_enabled('WHATSAPP_ENABLED'):($channel==='EMAIL'?tpk_notification_global_enabled('TPK_EMAIL_NOTIFICATIONS_ENABLED'):tpk_notification_global_enabled('TPK_PUSH_NOTIFICATIONS_ENABLED'));
        $contact=$channel==='WHATSAPP'?(string)($recipient['whatsappNumber']??''):($channel==='EMAIL'?(string)($recipient['email']??''):'');$status='SKIPPED';$reason='CHANNEL_DISABLED';
        if(!$enabled)$reason='CHANNEL_DISABLED';
        elseif(!$recipient || !(bool)$recipient['is_active'] || $recipient['team_status']==='INACTIVE' || $recipient['account_status']!=='VERIFIED')$reason='RECIPIENT_INACTIVE';
        elseif($channel==='WHATSAPP'&&!tpk_notification_preferences($db,$staffId)['whatsappConsent'])$reason='CONSENT_REQUIRED';
        elseif(!tpk_notification_channel_allowed($db,$staffId,$category,$channel,$importance))$reason='PREFERENCE_DISABLED';
        elseif($channel==='WHATSAPP'){
            $phone=preg_match('/^\+[1-9][0-9]{7,14}$/',$contact)?$contact:'';
            if(!$phone)$reason='WHATSAPP_NUMBER_INVALID';
            elseif(!tpk_whatsapp_is_configured())$reason='PROVIDER_NOT_CONFIGURED';
            else{$status='PENDING';$reason=null;$contact=$phone;}
        }elseif($channel==='EMAIL'){
            if(!filter_var($contact,FILTER_VALIDATE_EMAIL))$reason='EMAIL_ADDRESS_INVALID';
            elseif(!trim((string)getenv('TPK_EMAIL_FROM')))$reason='EMAIL_PROVIDER_NOT_CONFIGURED';
            else{$status='PENDING';$reason=null;}
        }else $reason='PUSH_PROVIDER_NOT_CONFIGURED';
        tpk_notification_delivery_row($db,$id,$staffId,$channel,$contact?:null,$provider,$status,$reason);
    }
    return ['id'=>$id,'created'=>true];
}

function tpk_create_notification_safe(PDO $db,array $notice): ?array {
    try{return tpk_create_notification($db,$notice);}catch(Throwable $e){error_log('[TPK notification queue] '.$e::class);return null;}
}

function tpk_whatsapp_templates(): array {
    return [
        'SUNDAY_SIGNIN_REMINDER'=>['template'=>'tpk_sunday_signin','variables'=>['teacherName','dashboardUrl']],
        'TEACHER_BIRTHDAY'=>['template'=>'tpk_teacher_birthday','variables'=>['teacherName','birthdayName','dashboardUrl']],
        'BIRTHDAY_GREETING'=>['template'=>'tpk_birthday_greeting','variables'=>['teacherName']],
        'FOLLOW_UP_ASSIGNED'=>['template'=>'tpk_followup_assigned','variables'=>['teacherName','followupKind','dashboardUrl']],
        'ROSTER_PUBLISHED'=>['template'=>'tpk_roster_published','variables'=>['teacherName','monthLabel','role','service','dashboardUrl']],
        'ROSTER_REMINDER'=>['template'=>'tpk_roster_reminder','variables'=>['teacherName','monthLabel','role','service','dashboardUrl']],
        'DUTY_ASSIGNED'=>['template'=>'tpk_duty_changed','variables'=>['teacherName','dateLabel','role','service','dashboardUrl']],
        'DUTY_CHANGED'=>['template'=>'tpk_duty_changed','variables'=>['teacherName','dateLabel','role','service','dashboardUrl']],
        'DUTY_REMOVED'=>['template'=>'tpk_duty_changed','variables'=>['teacherName','dateLabel','role','service','dashboardUrl']],
        'SUNDAY_SERVICE_REMINDER'=>['template'=>'tpk_sunday_service_reminder','variables'=>['teacherName','service','dashboardUrl']],
        'MDWK_SERVICE_REMINDER'=>['template'=>'tpk_mdwk_service_reminder','variables'=>['teacherName','service','dashboardUrl']],
        'TEACHER_CHECKIN_REMINDER'=>['template'=>'tpk_teacher_checkin_open','variables'=>['teacherName','service','dashboardUrl']],
        'WELFARE_FOLLOWUP_ASSIGNED'=>['template'=>'tpk_welfare_followup_assigned','variables'=>['teacherName','assigneeName','service','dashboardUrl']],
        'WELFARE_FOLLOWUP_ESCALATED'=>['template'=>'tpk_welfare_followup_assigned','variables'=>['teacherName','assigneeName','service','dashboardUrl']],
        'PROBATION_UPDATE'=>['template'=>'tpk_probation_update','variables'=>['teacherName','updateSummary','dashboardUrl']],
        'EVENT_ASSIGNMENT'=>['template'=>'tpk_event_assignment','variables'=>['teacherName','eventName','role','group','dashboardUrl']],
        'VBS_VOLUNTEER_ASSIGNMENT'=>['template'=>'tpk_vbs_volunteer_assignment','variables'=>['teacherName','eventName','role','group','dashboardUrl']],
        'SYSTEM_NOTICE'=>['template'=>'tpk_system_notice','variables'=>['teacherName','noticeTitle','dashboardUrl']],
    ];
}

function tpk_whatsapp_template_config(string $type): array {
    $map=tpk_whatsapp_templates();if(!isset($map[$type]))throw new RuntimeException('No approved template mapping exists for this notification.');
    $envKey='META_WHATSAPP_TEMPLATE_'.strtoupper($type);$template=trim((string)(getenv($envKey)?:getenv('WHATSAPP_TEMPLATE_'.strtoupper($type))?:$map[$type]['template']));
    if(!preg_match('/^[a-z0-9_]{1,512}$/',$template))throw new RuntimeException('The configured WhatsApp template name is invalid.');
    $lang=trim((string)(getenv('META_WHATSAPP_TEMPLATE_LANGUAGE')?:'en'));
    if(!preg_match('/^[a-z]{2,3}(?:_[A-Z]{2})?$/',$lang))throw new RuntimeException('The configured WhatsApp template language is invalid.');
    return ['name'=>$template,'language'=>$lang,'variables'=>$map[$type]['variables']];
}

/** Test seam for provider tests; production always uses the fixed Graph endpoint. */
function tpk_whatsapp_post(string $url,array $headers,string $body): array {
    if(isset($GLOBALS['TPK_WHATSAPP_HTTP_TRANSPORT'])&&is_callable($GLOBALS['TPK_WHATSAPP_HTTP_TRANSPORT']))return ($GLOBALS['TPK_WHATSAPP_HTTP_TRANSPORT'])($url,$headers,$body);
    $ctx=stream_context_create(['http'=>['method'=>'POST','header'=>implode("\r\n",$headers), 'content'=>$body,'timeout'=>12,'ignore_errors'=>true]]);
    $response=@file_get_contents($url,false,$ctx);$status=(int)preg_replace('/.*\s(\d{3})\s.*/s','$1',$http_response_header[0]??'500');
    return ['status'=>$status,'body'=>$response===false?'':(string)$response];
}

interface TpkWhatsappProvider { public function sendTemplate(string $to,string $template,string $language,array $variables): string; }

final class TpkMetaCloudWhatsappProvider implements TpkWhatsappProvider {
public function sendTemplate(string $to,string $template,string $language,array $variables): string {
    if(!tpk_notification_global_enabled('WHATSAPP_ENABLED'))throw new RuntimeException('WhatsApp delivery is disabled.');
    $token=trim((string)(getenv('META_WHATSAPP_ACCESS_TOKEN')?:getenv('WHATSAPP_ACCESS_TOKEN')?:''));$phoneId=trim((string)(getenv('META_WHATSAPP_PHONE_NUMBER_ID')?:getenv('WHATSAPP_PHONE_NUMBER_ID')?:''));$version=trim((string)(getenv('META_WHATSAPP_GRAPH_API_VERSION')?:'v25.0'));
    if(!$token||!$phoneId||!preg_match('/^v[0-9]{1,3}\.[0-9]{1,2}$/',$version))throw new RuntimeException('WhatsApp provider configuration is incomplete.');
    $params=[];foreach($variables as $value){$text=trim(preg_replace('/\s+/u',' ',(string)$value)??'');if($text==='')$text='TPK dashboard';$params[]=['type'=>'text','text'=>mb_substr($text,0,900)];}
    $payload=json_encode(['messaging_product'=>'whatsapp','to'=>ltrim($to,'+'),'type'=>'template','template'=>['name'=>$template,'language'=>['code'=>$language],'components'=>[['type'=>'body','parameters'=>$params]]]],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $url='https://graph.facebook.com/'.$version.'/'.rawurlencode($phoneId).'/messages';
    $result=tpk_whatsapp_post($url,['Authorization: Bearer '.$token,'Content-Type: application/json'],$payload);$status=(int)($result['status']??0);$decoded=json_decode((string)($result['body']??''),true);
    if($status<200||$status>=300){$retryable=in_array($status,[408,425,429],true)||$status>=500;throw new TpkWhatsappProviderException($status,$retryable,'META_HTTP_'.$status);}
    $messageId=(string)($decoded['messages'][0]['id']??'');if($messageId===''||strlen($messageId)>190)throw new TpkWhatsappProviderException($status,false,'META_MESSAGE_ID_MISSING');
    return $messageId;
}
}

function tpk_whatsapp_provider(): TpkWhatsappProvider {
    $provider=strtoupper(trim((string)(getenv('WHATSAPP_PROVIDER')?:'META')));
    if($provider!=='META')throw new RuntimeException('The configured WhatsApp provider is not available.');
    return new TpkMetaCloudWhatsappProvider();
}

function tpk_send_meta_template(string $to,string $template,string $language,array $variables): string {
    return tpk_whatsapp_provider()->sendTemplate($to,$template,$language,$variables);
}

function tpk_notification_send_whatsapp(PDO $db,array $delivery): string {
    $q=$db->prepare("SELECT n.type,n.category,n.importance,n.title,n.body,n.target_path,n.metadata_json,s.campus_id,s.is_active,s.team_status,s.account_status,s.access_level,p.first_name,p.last_name,p.title AS honorific,p.whatsapp_number_normalized AS whatsappNumber,prefs.whatsapp_enabled AS whatsappEnabled,prefs.whatsapp_consent AS whatsappConsent FROM notifications n JOIN staff_users s ON s.id=n.staff_user_id JOIN teacher_profiles p ON p.staff_user_id=s.id LEFT JOIN staff_notification_preferences prefs ON prefs.staff_user_id=s.id WHERE n.id=? AND s.id=?");$q->execute([(int)$delivery['notification_id'],(int)$delivery['staff_user_id']]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row||!(bool)$row['is_active']||$row['team_status']==='INACTIVE'||$row['account_status']!=='VERIFIED')throw new DomainException('RECIPIENT_INACTIVE');
    if(!(bool)$row['whatsappEnabled']||!(bool)$row['whatsappConsent'])throw new DomainException('CONSENT_OR_CHANNEL_DISABLED');
    if(!tpk_notification_channel_allowed($db,(int)$delivery['staff_user_id'],(string)$row['category'],'WHATSAPP',(string)$row['importance']))throw new DomainException('PREFERENCE_DISABLED');
    $to=(string)$row['whatsappNumber'];if(!preg_match('/^\+[1-9][0-9]{7,14}$/',$to))throw new DomainException('WHATSAPP_NUMBER_INVALID');
    $payload=json_decode((string)($row['metadata_json']??'{}'),true);if(!is_array($payload))$payload=[];
    if(!empty($payload['expiresAt']) && time() >= strtotime((string)$payload['expiresAt']))throw new DomainException('NOTIFICATION_EXPIRED');
    $payload['dashboardUrl']=tpk_notification_url((string)$row['target_path']);
    if($row['type']==='SUNDAY_SIGNIN_REMINDER'){
        $checked=$db->prepare("SELECT 1 FROM teacher_service_attendance a JOIN teacher_services ts ON ts.id=a.service_id WHERE a.staff_user_id=? AND ts.campus_id=? AND ts.kind='SUNDAY' AND DATE(ts.starts_at)=? LIMIT 1");
        $checked->execute([(int)$delivery['staff_user_id'],(int)$row['campus_id'],(string)($payload['serviceDate']??'')]);
        if($checked->fetchColumn())throw new DomainException('ALREADY_CHECKED_IN');
    }
    $template=tpk_whatsapp_template_config((string)$row['type']);$first=trim((string)$row['first_name']);$last=trim((string)$row['last_name']);$name=trim(($row['honorific']?($row['honorific'].' '):'').$first.' '.$last);$vars=[];
    foreach($template['variables'] as $key){$value=$key==='teacherName'?$name:($payload[$key]??'');$vars[]=(string)$value;}
    if(count($vars)!==count($template['variables']))throw new RuntimeException('The WhatsApp template variables are incomplete.');
    if(tpk_notification_global_enabled('WHATSAPP_TEST_MODE')){$test=trim((string)getenv('WHATSAPP_TEST_RECIPIENT'));if(!tpk_notification_global_enabled('WHATSAPP_ALLOW_TEST_SEND')||!preg_match('/^\+[1-9][0-9]{7,14}$/',$test))throw new DomainException('TEST_RECIPIENT_NOT_CONFIGURED');$to=$test;}
    return tpk_send_meta_template($to,$template['name'],$template['language'],$vars);
}

function tpk_notification_send_email(PDO $db,array $delivery): string {
    $from=trim((string)getenv('TPK_EMAIL_FROM'));
    if(!filter_var($from,FILTER_VALIDATE_EMAIL))throw new RuntimeException('Email delivery is not configured.');
    $q=$db->prepare('SELECT d.recipient,n.title,n.body,n.target_path,n.metadata_json,staff.name FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id LEFT JOIN staff_users staff ON staff.id=d.staff_user_id WHERE d.id=? AND d.channel=\'EMAIL\'');
    $q->execute([(int)$delivery['id']]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row||!filter_var((string)$row['recipient'],FILTER_VALIDATE_EMAIL))throw new DomainException('EMAIL_ADDRESS_INVALID');
    $origin=rtrim((string)(getenv('TPK_FRONTEND_URL')?:getenv('FRONTEND_ORIGIN')?:''),'/');
    $url=$origin.(string)$row['target_path'];
    $subject='TribePetra Kids: '.mb_substr((string)$row['title'],0,140);
    $message='Hello '.(string)($row['name']?:'there').",\n\n".(string)$row['body']."\n\nOpen your TPK dashboard: ".$url."\n\nTribePetra Kids";
    $headers=['From: TribePetra Kids <'.$from.'>','Reply-To: '.$from,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8'];
    if(!@mail((string)$row['recipient'],$subject,$message,implode("\r\n",$headers)))throw new RuntimeException('Email delivery failed.');
    return 'accepted';
}

function tpk_meta_signature_is_valid(string $raw,string $signature,string $secret): bool {
    return $secret!==''&&preg_match('/^sha256=[a-f0-9]{64}$/i',$signature)===1&&hash_equals('sha256='.hash_hmac('sha256',$raw,$secret),strtolower($signature));
}

function tpk_meta_delivery_state(string $state): ?string {
    $state=strtoupper(trim($state));
    return in_array($state,['SENT','DELIVERED','READ','FAILED'],true)?$state:null;
}

function tpk_notification_process_batch(PDO $db,int $limit=25): array {
    $limit=max(1,min(100,$limit));$result=['claimed'=>0,'sent'=>0,'failed'=>0,'retried'=>0,'skipped'=>0];
    $select=$db->prepare("SELECT id FROM notification_deliveries WHERE channel IN ('WHATSAPP','EMAIL','PUSH') AND status='PENDING' AND (next_attempt_at IS NULL OR next_attempt_at<=NOW()) AND (locked_at IS NULL OR locked_at<DATE_SUB(NOW(),INTERVAL 3 MINUTE)) ORDER BY created_at,id LIMIT {$limit}");$select->execute();$ids=array_map('intval',$select->fetchAll(PDO::FETCH_COLUMN));
    foreach($ids as $id){$claim=$db->prepare("UPDATE notification_deliveries SET locked_at=NOW(),attempted_at=NOW(),attempts=attempts+1 WHERE id=? AND status='PENDING' AND (locked_at IS NULL OR locked_at<DATE_SUB(NOW(),INTERVAL 3 MINUTE))");$claim->execute([$id]);if(!$claim->rowCount())continue;$result['claimed']++;
        $q=$db->prepare('SELECT * FROM notification_deliveries WHERE id=?');$q->execute([$id]);$delivery=$q->fetch(PDO::FETCH_ASSOC);if(!$delivery)continue;
        try{
            if($delivery['channel']==='WHATSAPP'&&!tpk_notification_global_enabled('WHATSAPP_ENABLED'))throw new DomainException('CHANNEL_DISABLED');
            if($delivery['channel']==='WHATSAPP'){$messageId=tpk_notification_send_whatsapp($db,$delivery);$db->prepare("UPDATE notification_deliveries SET status='SENT',provider='META',provider_message_id=?,sent_at=NOW(),locked_at=NULL,next_attempt_at=NULL,failure_reason=NULL WHERE id=?")->execute([$messageId,$id]);$result['sent']++;}
            elseif($delivery['channel']==='EMAIL'){if(!tpk_notification_global_enabled('TPK_EMAIL_NOTIFICATIONS_ENABLED') || !tpk_notification_channel_allowed($db,(int)$delivery['staff_user_id'],'SYSTEM','EMAIL','OPTIONAL'))throw new DomainException('CHANNEL_DISABLED');$messageId=tpk_notification_send_email($db,$delivery);$db->prepare("UPDATE notification_deliveries SET status='SENT',provider='TPK_MAIL',provider_message_id=?,sent_at=NOW(),locked_at=NULL,next_attempt_at=NULL,failure_reason=NULL WHERE id=?")->execute([$messageId,$id]);$result['sent']++;}
            else{$db->prepare("UPDATE notification_deliveries SET status='SKIPPED',locked_at=NULL,failure_reason='PUSH_ADAPTER_NOT_AVAILABLE' WHERE id=?")->execute([$id]);$result['skipped']++;}
        }catch(DomainException $e){$reason=preg_replace('/[^A-Z0-9_]/','',strtoupper($e->getMessage()));$db->prepare("UPDATE notification_deliveries SET status='SKIPPED',locked_at=NULL,next_attempt_at=NULL,failure_reason=? WHERE id=?")->execute([$reason?:'DELIVERY_NOT_ALLOWED',$id]);$result['skipped']++;}
        catch(TpkWhatsappProviderException $e){$attempts=(int)$delivery['attempts'];if($e->retryable&&$attempts<5){$delay=min(3600,60*(2**($attempts-1)));$db->prepare("UPDATE notification_deliveries SET status='PENDING',locked_at=NULL,next_attempt_at=DATE_ADD(NOW(), INTERVAL {$delay} SECOND),failure_reason=? WHERE id=?")->execute(['RETRY_'.$e->getMessage(),$id]);$result['retried']++;}else{$db->prepare("UPDATE notification_deliveries SET status='FAILED',locked_at=NULL,next_attempt_at=NULL,failed_at=NOW(),failure_reason=? WHERE id=?")->execute([$e->getMessage(),$id]);$result['failed']++;}}
        catch(Throwable $e){$reason=$e instanceof RuntimeException?'PROVIDER_CONFIGURATION_OR_TRANSPORT_ERROR':'DELIVERY_FAILED';$db->prepare("UPDATE notification_deliveries SET status='FAILED',locked_at=NULL,next_attempt_at=NULL,failed_at=NOW(),failure_reason=? WHERE id=?")->execute([$reason,$id]);$result['failed']++;error_log('[TPK notification delivery] '.$reason);}
    }
    return $result;
}

/** Preserve monotonic delivery status even if Meta retries or reorders webhooks. */
function tpk_apply_meta_status(PDO $db, string $messageId, string $state, int $stamp): bool {
    if(tpk_meta_delivery_state($state)===null)return true;
    $db->beginTransaction();
    try {
        $q=$db->prepare("SELECT id,status FROM notification_deliveries WHERE provider='META' AND channel='WHATSAPP' AND provider_message_id=? FOR UPDATE");
        $q->execute([$messageId]);$row=$q->fetch(PDO::FETCH_ASSOC);
        // Meta may report a status before the sender has recorded its message ID.
        if(!$row){$db->rollBack();return false;}
        $key=hash('sha256',$messageId.'|'.$state.'|'.$stamp);
        $insert=$db->prepare("INSERT IGNORE INTO notification_webhook_events(provider,event_key) VALUES('META',?)");$insert->execute([$key]);
        if($insert->rowCount()){
            $rank=['PENDING'=>0,'FAILED'=>0,'SENT'=>1,'DELIVERED'=>2,'READ'=>3];
            $at=gmdate('Y-m-d H:i:s',$stamp);
            $advance=$state==='FAILED'?!in_array($row['status'],['DELIVERED','READ'],true):($rank[$state]>($rank[$row['status']]??0));
            if($advance){$column=['SENT'=>'sent_at','DELIVERED'=>'delivered_at','READ'=>'read_at','FAILED'=>'failed_at'][$state];
                $q=$db->prepare("UPDATE notification_deliveries SET status=?,{$column}=?,failure_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
                $q->execute([$state,$at,$state==='FAILED'?'META_DELIVERY_FAILED':null,$row['id']]);
            }
        }
        $db->commit();return true;
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

function tpk_notification_webhook(PDO $db): never {
    $method=strtoupper($_SERVER['REQUEST_METHOD']??'GET');
    if($method==='GET'){
        $expected=trim((string)getenv('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN'));
        $provided=(string)($_GET['hub_verify_token']??$_GET['hub.verify_token']??'');
        $mode=(string)($_GET['hub_mode']??$_GET['hub.mode']??'');$challenge=(string)($_GET['hub_challenge']??$_GET['hub.challenge']??'');
        if($expected!==''&&$mode==='subscribe'&&$challenge!==''&&hash_equals($expected,$provided)){http_response_code(200);header('Content-Type: text/plain; charset=utf-8');echo $challenge;exit;}
        http_response_code(403);exit;
    }
    if($method!=='POST'){http_response_code(405);header('Allow: GET, POST');exit;}
    $raw=file_get_contents('php://input',false,null,0,1048577)?:'';
    if(strlen($raw)>1048576||!tpk_meta_signature_is_valid($raw,(string)($_SERVER['HTTP_X_HUB_SIGNATURE_256']??''),trim((string)getenv('META_APP_SECRET')))){http_response_code(403);exit;}
    $payload=json_decode($raw,true);$retry=false;
    if(is_array($payload)&&($payload['object']??'')==='whatsapp_business_account'){
        $businessId=trim((string)getenv('META_WHATSAPP_BUSINESS_ACCOUNT_ID'));$phoneId=tpk_whatsapp_env('PHONE_NUMBER_ID');
        foreach(($payload['entry']??[]) as $entry){if($businessId!==''&&(string)($entry['id']??'')!==$businessId)continue;
            foreach(($entry['changes']??[]) as $change){if(($change['field']??'')!=='messages')continue;$value=$change['value']??[];
                if($phoneId!==''&&(string)($value['metadata']['phone_number_id']??'')!==$phoneId)continue;
                foreach(($value['statuses']??[]) as $status){$messageId=(string)($status['id']??'');$state=tpk_meta_delivery_state((string)($status['status']??''));
                    if($messageId===''||strlen($messageId)>190||$state===null)continue;
                    if(!tpk_apply_meta_status($db,$messageId,$state,(int)($status['timestamp']??time())) && time()-(int)($status['timestamp']??time())<600)$retry=true;
                }
            }
        }
    }
    http_response_code($retry?503:200);header('Content-Type: text/plain; charset=utf-8');echo $retry?'RETRY':'EVENT_RECEIVED';exit;
}

function api_notification_preferences(PDO $db): never {
    $actor=api_actor($db);$staffId=(int)$actor['id'];
    if(api_method()==='PATCH'){
        $v=api_input();$allowed=['whatsappEnabled','pushEnabled','emailEnabled'];$set=[];$params=[];foreach($allowed as $key)if(array_key_exists($key,$v)){$set[]=['whatsappEnabled'=>'whatsapp_enabled','pushEnabled'=>'push_enabled','emailEnabled'=>'email_enabled'][$key].'=?';$params[]=(int)(bool)$v[$key];}
        $consent=array_key_exists('whatsappConsent',$v)?(bool)$v['whatsappConsent']:null;
        $db->beginTransaction();try{$db->prepare('INSERT IGNORE INTO staff_notification_preferences(staff_user_id) VALUES(?)')->execute([$staffId]);if($consent!==null){if($consent)$db->prepare('UPDATE staff_notification_preferences SET whatsapp_consent_at=IF(whatsapp_consent=0,NOW(),COALESCE(whatsapp_consent_at,NOW())),whatsapp_consent=1,whatsapp_withdrawn_at=NULL WHERE staff_user_id=?')->execute([$staffId]);else{$db->prepare('UPDATE staff_notification_preferences SET whatsapp_consent=0,whatsapp_withdrawn_at=NOW() WHERE staff_user_id=?')->execute([$staffId]);$db->prepare("UPDATE notification_deliveries SET status='SKIPPED',locked_at=NULL,next_attempt_at=NULL,failure_reason='CONSENT_WITHDRAWN' WHERE staff_user_id=? AND channel='WHATSAPP' AND status='PENDING'")->execute([$staffId]);}}
            if($set){$params[]=$staffId;$db->prepare('UPDATE staff_notification_preferences SET '.implode(',',$set).' WHERE staff_user_id=?')->execute($params);}
            if(isset($v['categories'])&&is_array($v['categories'])){foreach($v['categories'] as $category=>$channels){$category=strtoupper((string)$category);if(!in_array($category,['ROSTER_UPDATES','DUTY_CHANGES','SUNDAY_REMINDERS','MDWK_REMINDERS','TEACHER_CHECKIN','WELFARE','PROBATION','EVENTS','BIRTHDAYS','SYSTEM','SYSTEM_URGENT'],true)||!is_array($channels))continue;$db->prepare('INSERT INTO staff_notification_category_preferences(staff_user_id,category,whatsapp_enabled,push_enabled,email_enabled) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE whatsapp_enabled=VALUES(whatsapp_enabled),push_enabled=VALUES(push_enabled),email_enabled=VALUES(email_enabled)')->execute([$staffId,$category,(int)!empty($channels['whatsapp']),(int)!empty($channels['push']),(int)!empty($channels['email'])]);}}
            $db->commit();
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    }
    $prefs=tpk_notification_preferences($db,$staffId);$cats=tpk_notification_category_preferences($db,$staffId);foreach(['ROSTER_UPDATES','DUTY_CHANGES','SUNDAY_REMINDERS','MDWK_REMINDERS','TEACHER_CHECKIN','WELFARE','PROBATION','EVENTS','BIRTHDAYS','SYSTEM','SYSTEM_URGENT'] as $category){if(!isset($cats[$category]))$cats[$category]=['whatsapp'=>in_array($category,['ROSTER_UPDATES','DUTY_CHANGES','WELFARE','SYSTEM_URGENT'],true),'push'=>false,'email'=>false];}$phone=$db->prepare('SELECT whatsapp_number_normalized FROM teacher_profiles WHERE staff_user_id=?');$phone->execute([$staffId]);$number=(string)$phone->fetchColumn();$valid=(bool)preg_match('/^\+[1-9][0-9]{7,14}$/',$number);$globallyEnabled=tpk_notification_global_enabled('WHATSAPP_ENABLED');$providerReady=tpk_whatsapp_is_configured();$emailReady=tpk_notification_global_enabled('TPK_EMAIL_NOTIFICATIONS_ENABLED')&&filter_var((string)getenv('TPK_EMAIL_FROM'),FILTER_VALIDATE_EMAIL);
    $whatsappStatus=!$globallyEnabled?'WhatsApp is turned off by TPK.':(!$providerReady?'TPK has not finished WhatsApp setup.':(!$valid?'No valid WhatsApp number is saved.':(!$prefs['whatsappConsent']?'Consent is needed before WhatsApp messages can be sent.':(!$prefs['whatsappEnabled']?'WhatsApp delivery is turned off in your preferences.':'Ready'))));
    api_ok(['channels'=>['whatsapp'=>['enabled'=>$prefs['whatsappEnabled'],'available'=>$globallyEnabled&&$providerReady&&$valid&&$prefs['whatsappConsent'],'consent'=>$prefs['whatsappConsent'],'consentAt'=>$prefs['consentAt'],'withdrawnAt'=>$prefs['withdrawnAt'],'status'=>$whatsappStatus],'push'=>['enabled'=>$prefs['pushEnabled'],'available'=>false,'status'=>'A TPK push provider is not configured yet.'],'email'=>['enabled'=>$prefs['emailEnabled'],'available'=>(bool)$emailReady,'status'=>$emailReady?'Ready':'Email delivery is not configured by TPK yet.']],'categories'=>$cats,'categoryNames'=>['ROSTER_UPDATES'=>'Roster updates','DUTY_CHANGES'=>'Duty changes','SUNDAY_REMINDERS'=>'Sunday reminders','MDWK_REMINDERS'=>'MDWK reminders','TEACHER_CHECKIN'=>'Teacher check-in reminders','WELFARE'=>'Welfare follow-up','PROBATION'=>'Probation and onboarding','EVENTS'=>'Events and conferences','BIRTHDAYS'=>'Team birthdays','SYSTEM'=>'System notices','SYSTEM_URGENT'=>'Urgent system notices'],'inAppEssentialLocked'=>true]);
}

function api_notification_deliveries(PDO $db): never {
    $actor=api_actor($db,true);$status=strtoupper(trim((string)($_GET['status']??'')));$where=['n.campus_id=?'];$params=[(int)$actor['campus_id']];if(in_array($status,['PENDING','SENT','DELIVERED','READ','FAILED','SKIPPED'],true)){$where[]='d.status=?';$params[]=$status;}
    $sql="SELECT d.id,d.notification_id AS notificationId,d.staff_user_id AS staffUserId,d.channel,CASE WHEN d.channel='WHATSAPP' THEN CONCAT('+***',RIGHT(REPLACE(d.recipient,'+',''),3)) WHEN d.channel='EMAIL' THEN CONCAT(LEFT(d.recipient,1),'***@',SUBSTRING_INDEX(d.recipient,'@',-1)) ELSE NULL END AS recipient,d.provider,d.provider_message_id AS providerMessageId,d.status,d.attempts,d.attempted_at AS attemptedAt,d.sent_at AS sentAt,d.delivered_at AS deliveredAt,d.read_at AS readAt,d.failed_at AS failedAt,d.failure_reason AS failureReason,d.created_at AS createdAt,n.type,n.category,n.importance,n.title,staff.name AS staffName FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id LEFT JOIN staff_users staff ON staff.id=d.staff_user_id WHERE ".implode(' AND ',$where).' ORDER BY d.created_at DESC LIMIT 200';
    $q=$db->prepare($sql);$q->execute($params);api_ok($q->fetchAll(PDO::FETCH_ASSOC));
}

function api_notification_retry(PDO $db,int $id): never {
    $actor=api_actor($db,true);$s=$db->prepare("UPDATE notification_deliveries d JOIN notifications n ON n.id=d.notification_id SET d.status='PENDING',d.attempts=0,d.next_attempt_at=NULL,d.locked_at=NULL,d.failed_at=NULL,d.failure_reason=NULL WHERE d.id=? AND d.channel='WHATSAPP' AND d.status='FAILED' AND d.staff_user_id IS NOT NULL AND n.campus_id=? AND n.importance='ESSENTIAL'");$s->execute([$id,(int)$actor['campus_id']]);if(!$s->rowCount())api_error('DELIVERY_NOT_RETRYABLE','Only failed essential WhatsApp notices from your campus can be retried.',409);api_ok(['deliveryId'=>$id,'status'=>'PENDING']);
}
