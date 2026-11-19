<?php
/* Family Observatory: a small relay to the WikiTree API.

   WikiTree's API does not always answer a browser on another site directly, so the "From WikiTree"
   panel can send its questions here and this script passes them on to api.wikitree.com.

   Kept deliberately narrow:
   - only the site's own pages may use it (same-site check), and only by POST
   - only the getPeople question, with checked WikiTree IDs, generation counts and the brothers-and-
     sisters switch; the list of
     fields is fixed here (no biographies, no photos)
   - a limit per visitor and an overall limit, so WikiTree's own limits are respected
   - nothing WikiTree sends is cached or stored (WikiTree's App Policies); only request counts are
     kept, for an hour at most, to apply the limits */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function fail($msg, $code) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('This address is used by the site itself.', 405);
if (!function_exists('curl_init')) fail('This web host cannot make outside requests (PHP curl is missing).', 501);

/* ---------- only from this site's own pages ---------- */
$host = strtolower((string)parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST));
$from = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($from === '' || strtolower((string)parse_url($from, PHP_URL_HOST)) !== $host) fail('This helper only answers the site\'s own pages.', 403);

/* ---------- the question ---------- */
$p = function ($k) { return isset($_POST[$k]) ? trim((string)$_POST[$k]) : ''; };
if ($p('action') !== 'getPeople') fail('Only family trees can be fetched here.', 400);

$keys = $p('keys');
if ($keys === '' || strlen($keys) > 3000) fail('Please give a WikiTree ID.', 400);
$list = explode(',', $keys);
if (count($list) > 100) fail('Too many profiles in one request.', 400);
foreach ($list as $k) {
  if (!preg_match('/^(\d{1,12}|[^\s,\/?#&=<>"\'\\\\]{1,80}-\d{1,9})$/u', $k)) fail('That is not a WikiTree ID.', 400);
}
$int = function ($k, $min, $max, $def) use ($p) {
  $v = $p($k);
  if ($v === '') return $def;
  if (!preg_match('/^\d{1,7}$/', $v)) fail('A number was not understood.', 400);
  return max($min, min($max, (int)$v));
};
$query = [
  'action'      => 'getPeople',
  'keys'        => $keys,
  'ancestors'   => $int('ancestors', 0, 25, 0),
  'descendants' => $int('descendants', 0, 10, 0),
  'siblings'    => $int('siblings', 0, 1, 0),
  'limit'       => $int('limit', 1, 1000, 1000),
  'start'       => $int('start', 0, 1000000, 0),
  'fields'      => 'Id,Name,FirstName,MiddleName,RealName,LastNameAtBirth,LastNameCurrent,Gender,'
                 . 'BirthDate,DeathDate,BirthLocation,DeathLocation,Father,Mother,Spouses,IsLiving,DataStatus',
  'appId'       => 'FamilyObservatory',
];

/* ---------- limits: per visitor, and for the whole site ---------- */
function within_limit($name, $max, $window) {
  $file = rtrim(sys_get_temp_dir(), '/\\') . '/fo-wt-' . substr(hash('sha256', $name . __DIR__), 0, 24);
  $fh = @fopen($file, 'c+');
  if (!$fh) return true;            // cannot count: do not block the visitor
  flock($fh, LOCK_EX);
  $now = time();
  $times = array_filter(array_map('intval', explode(',', (string)stream_get_contents($fh))), function ($t) use ($now, $window) { return $t > $now - $window; });
  $ok = count($times) < $max;
  if ($ok) $times[] = $now;
  ftruncate($fh, 0); rewind($fh); fwrite($fh, implode(',', $times));
  flock($fh, LOCK_UN); fclose($fh);
  return $ok;
}
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!within_limit('ip:' . $ip, 120, 600)) fail('That is a lot of trees in a short time. Please wait a few minutes and try again.', 429);
if (!within_limit('site-minute', 150, 60)) fail('WikiTree is being asked for many trees right now. Please try again in a minute.', 429);
if (!within_limit('site-hour', 3500, 3600)) fail('This site has reached its hourly allowance from WikiTree. Please try again later.', 429);

/* ---------- ask WikiTree ---------- */
$ch = curl_init('https://api.wikitree.com/api.php');
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => http_build_query($query),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_TIMEOUT        => 50,
  CURLOPT_FOLLOWLOCATION => false,
  CURLOPT_USERAGENT      => 'FamilyObservatory/1.0 (+https://' . $host . '/)',
  CURLOPT_HTTPHEADER     => ['Accept: application/json'],
]);
$body = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($body === false || $code === 0) fail('WikiTree could not be reached. Please try again shortly.', 502);
if ($code === 429) fail('WikiTree is limiting how fast it answers. Please wait a minute and try again.', 429);
if ($code !== 200) fail('WikiTree answered with an error (' . $code . '). Please try again later.', 502);
$first = ltrim($body)[0] ?? '';
if ($first !== '[' && $first !== '{') fail('WikiTree sent an unexpected answer. It may be busy; please try again shortly.', 502);
echo $body;
