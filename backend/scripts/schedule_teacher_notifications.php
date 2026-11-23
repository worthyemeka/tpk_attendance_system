<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__).'/config.php';
require dirname(__DIR__).'/public/notification-delivery.php';
require dirname(__DIR__).'/public/notification-schedule.php';
$enqueue=in_array('--enqueue',$argv,true);
echo json_encode(tpk_schedule_notifications(db(),null,!$enqueue),JSON_THROW_ON_ERROR).PHP_EOL;
