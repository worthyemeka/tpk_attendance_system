<?php
declare(strict_types=1);

require dirname(__DIR__) . '/public/notification-delivery.php';

$checks=0;
function check(bool $ok,string $message): void { global $checks; if(!$ok)throw new RuntimeException('FAIL: '.$message);$checks++; }

check(tpk_notification_category('DUTY_CHANGED')===['DUTY_CHANGES','ESSENTIAL'],'duty changes are essential');
check(tpk_notification_category('ROSTER_REMINDER')===['ROSTER_UPDATES','OPTIONAL'],'roster reminders are optional');
check(tpk_notification_category('SYSTEM_NOTICE','URGENT')===['SYSTEM_URGENT','ESSENTIAL'],'urgent notices are essential');
foreach(['ROSTER_PUBLISHED','ROSTER_REMINDER','DUTY_ASSIGNED','DUTY_CHANGED','DUTY_REMOVED','SUNDAY_SERVICE_REMINDER','MDWK_SERVICE_REMINDER','TEACHER_CHECKIN_REMINDER','WELFARE_FOLLOWUP_ASSIGNED','WELFARE_FOLLOWUP_ESCALATED','PROBATION_UPDATE','EVENT_ASSIGNMENT','VBS_VOLUNTEER_ASSIGNMENT','SYSTEM_NOTICE'] as $type){$template=tpk_whatsapp_template_config($type);check((bool)preg_match('/^[a-z0-9_]+$/',$template['name']),'template name maps for '.$type);check(count($template['variables'])>0,'template has parameters for '.$type);}
check(tpk_meta_delivery_state('delivered')==='DELIVERED','delivery status maps');
check(tpk_meta_delivery_state('unknown')===null,'unsupported provider status ignored');
$raw='{"object":"whatsapp_business_account"}';$secret='local-test-secret';$signature='sha256='.hash_hmac('sha256',$raw,$secret);
check(tpk_meta_signature_is_valid($raw,$signature,$secret),'Meta signature accepts valid HMAC');
check(!tpk_meta_signature_is_valid($raw,$signature,'wrong-secret'),'Meta signature rejects wrong secret');

putenv('WHATSAPP_ENABLED=true');putenv('META_WHATSAPP_ACCESS_TOKEN=local-dummy-token');putenv('META_WHATSAPP_PHONE_NUMBER_ID=123456789');putenv('META_WHATSAPP_GRAPH_API_VERSION=v25.0');
$captured=null;$GLOBALS['TPK_WHATSAPP_HTTP_TRANSPORT']=static function(string $url,array $headers,string $body)use(&$captured):array{$captured=[$url,$headers,json_decode($body,true)];return ['status'=>200,'body'=>'{"messages":[{"id":"wamid.local-test"}]}'];};
$id=tpk_send_meta_template('+2348012345678','tpk_roster_published','en',['Teacher','October 2026','Tribe A','First Service','https://example.invalid/account/roster']);
check($id==='wamid.local-test','provider stores Meta message id');
check(str_starts_with($captured[0],'https://graph.facebook.com/v25.0/'),'only the official Meta Graph host is used');
check(($captured[2]['template']['name']??'')==='tpk_roster_published','template request uses approved template mapping');
check(($captured[2]['template']['components'][0]['parameters'][0]['text']??'')==='Teacher','template variables are passed in order');
check(str_contains($captured[1][0],'Bearer local-dummy-token'),'provider authentication is attached only by the server adapter');

$GLOBALS['TPK_WHATSAPP_HTTP_TRANSPORT']=static fn(string $url,array $headers,string $body):array=>['status'=>503,'body'=>'{"error":{"message":"private provider detail"}}'];
try{tpk_send_meta_template('+2348012345678','tpk_roster_published','en',['A','B','C','D','E']);check(false,'provider failure throws');}catch(TpkWhatsappProviderException $e){check($e->retryable,'server failures are retryable');check($e->getMessage()==='META_HTTP_503','failure is logged with a safe code');check(!str_contains($e->getMessage(),'private provider detail'),'provider body is not exposed');}
$GLOBALS['TPK_WHATSAPP_HTTP_TRANSPORT']=static fn(string $url,array $headers,string $body):array=>['status'=>400,'body'=>'{}'];
try{tpk_send_meta_template('+2348012345678','tpk_roster_published','en',['A','B','C','D','E']);check(false,'client provider failure throws');}catch(TpkWhatsappProviderException $e){check(!$e->retryable,'permanent provider failures are not retried');}
putenv('WHATSAPP_TEST_MODE=true');putenv('WHATSAPP_ALLOW_TEST_SEND=false');
check(!tpk_notification_global_enabled('WHATSAPP_ALLOW_TEST_SEND'),'test mode requires explicit send permission');
putenv('WHATSAPP_ENABLED=false');
try{tpk_send_meta_template('+2348012345678','tpk_roster_published','en',['A','B','C','D','E']);check(false,'disabled provider must not call transport');}catch(RuntimeException $e){check($e->getMessage()==='WhatsApp delivery is disabled.','global channel-off switch blocks sends');}

fwrite(STDOUT,"{$checks} notification policy/provider checks passed. No network request or live message was sent.\n");
