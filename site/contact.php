<?php
/* Family Observatory: the Contact me form.
   Receives the form, checks it, and sends it by e-mail through your own mail server (SMTP).
   The mail server settings and password live in a separate file, fo-contact-config.php, kept
   OUTSIDE the public web folder, so they can never be downloaded. See contact-config-sample.php. */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply($ok, $error = '', $code = 200) {
  http_response_code($code);
  echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(false, 'Send the form to use this address.', 405);

/* ---------- settings ---------- */
$cfg = null;
$homeDir = getenv('HOME') ?: (function_exists('posix_getpwuid') && function_exists('posix_geteuid') ? (posix_getpwuid(posix_geteuid())['dir'] ?? '') : '');
foreach (array_filter([
  $homeDir ? $homeDir . '/fo-contact-config.php' : null,     // your hosting home folder, above public_html (best)
  dirname(__DIR__) . '/fo-contact-config.php',              // the folder above the site
  dirname(__DIR__, 2) . '/fo-contact-config.php',           // two folders up, if the site is in a sub-folder
]) as $path) {
  if (is_readable($path)) { $cfg = include $path; break; }
}
if (!is_array($cfg) || empty($cfg['to'])) reply(false, 'The message form is not set up yet.', 503);
$cfg += ['smtp_host' => '', 'smtp_port' => 465, 'smtp_secure' => 'ssl', 'smtp_user' => '', 'smtp_pass' => '',
         'from' => $cfg['to'], 'from_name' => 'Cognitive Overload', 'subject_prefix' => '[cognitiveoverload.com]',
         'max_per_hour' => 5];

/* ---------- the form ---------- */
$field = function ($k, $max) { $v = isset($_POST[$k]) ? trim((string)$_POST[$k]) : ''; return mb_substr($v, 0, $max, 'UTF-8'); };
$name = $field('name', 100); $email = $field('email', 200); $subject = $field('subject', 150); $message = $field('message', 5000);
$oneLine = function ($s) { return trim(preg_replace('/[\r\n\t]+/', ' ', $s)); };   // nothing can sneak extra mail headers in
$name = $oneLine($name); $subject = $oneLine($subject); $email = $oneLine($email);

// robots: the hidden field must stay empty, and a person takes more than a few seconds to write
if (!empty($_POST['website'])) reply(true);
$t = isset($_POST['t']) ? (int)$_POST['t'] : 0;
if ($t && (round(microtime(true) * 1000) - $t) < 3000) reply(true);

if ($name === '') reply(false, 'Please add your name.', 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) reply(false, 'Please check your e-mail address.', 422);
if (mb_strlen($message, 'UTF-8') < 5) reply(false, 'Please write a message.', 422);

// only from this site's own pages
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) reply(false, 'This form can only be used from its own page.', 403);

// at most a few messages an hour from one address
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$log = rtrim(sys_get_temp_dir(), '/\\') . '/fo-contact-' . substr(hash('sha256', $ip . __DIR__), 0, 20);
$times = array_filter(array_map('intval', is_readable($log) ? explode(',', (string)file_get_contents($log)) : []), function ($x) { return $x > time() - 3600; });
if (count($times) >= (int)$cfg['max_per_hour']) reply(false, 'Too many messages in a short time. Please try again later.', 429);

/* ---------- the e-mail ---------- */
$enc = function ($s) { return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; };
$quoteName = function ($s) use ($enc) { $s = str_replace(['"', '\\'], '', $s); return preg_match('/[^\x20-\x7E]/', $s) ? $enc($s) : '"' . $s . '"'; };
$host = preg_replace('/[^a-z0-9.-]/i', '', preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
$subj = trim($cfg['subject_prefix'] . ' ' . ($subject !== '' ? $subject : 'Message from ' . $name));
$body = "From: $name <$email>\n"
      . "Sent from the Contact me page on $host, " . gmdate('Y-m-d H:i') . " UTC\n"
      . str_repeat('-', 60) . "\n\n" . str_replace(["\r\n", "\r"], "\n", $message) . "\n";
$headers = [
  'Date: ' . date('r'),
  'From: ' . $quoteName($cfg['from_name']) . ' <' . $cfg['from'] . '>',
  'Reply-To: ' . $quoteName($name) . ' <' . $email . '>',
  'To: <' . $cfg['to'] . '>',
  'Subject: ' . $enc($subj),
  'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $host . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  'X-Mailer: Family Observatory contact form',
];
$data = implode("\r\n", $headers) . "\r\n\r\n" . rtrim(chunk_split(base64_encode($body), 76, "\r\n")) . "\r\n";

/* ---------- send ---------- */
function smtp_send($cfg, $from, $to, $data) {
  $secure = strtolower((string)$cfg['smtp_secure']);
  $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $cfg['smtp_host'] . ':' . (int)$cfg['smtp_port'];
  $ssl = ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $cfg['smtp_host']];
  if (!empty($cfg['smtp_cafile'])) $ssl['cafile'] = $cfg['smtp_cafile'];   // only if the mail server's certificate needs a specific authority
  $ctx = stream_context_create(['ssl' => $ssl]);
  $s = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
  if (!$s) throw new Exception("connect: $errstr ($errno)");
  stream_set_timeout($s, 20);
  $read = function () use ($s) {
    $out = '';
    while (($line = fgets($s, 1024)) !== false) { $out .= $line; if (strlen($line) < 4 || $line[3] === ' ') break; }
    return $out;
  };
  // $label is what goes in the error log; sign-in lines are never logged
  $cmd = function ($line, $want, $label = null) use ($s, $read) {
    if ($line !== null) fwrite($s, $line . "\r\n");
    $r = $read();
    if (!in_array((int)substr($r, 0, 3), (array)$want, true)) throw new Exception(trim(($label ?? ($line === null ? 'greeting' : (strlen($line) > 60 ? 'message' : $line))) . ' -> ' . $r));
    return $r;
  };
  $me = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost';
  $cmd(null, 220);
  $ehlo = $cmd("EHLO $me", 250);
  if ($secure === 'tls') {
    $cmd('STARTTLS', 220);
    if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0))) throw new Exception('STARTTLS failed');
    $ehlo = $cmd("EHLO $me", 250);
  }
  if ($cfg['smtp_user'] !== '') {
    if (preg_match('/AUTH[ =][^\r\n]*PLAIN/i', $ehlo)) $cmd('AUTH PLAIN ' . base64_encode("\0" . $cfg['smtp_user'] . "\0" . $cfg['smtp_pass']), 235, 'sign-in');
    else { $cmd('AUTH LOGIN', 334); $cmd(base64_encode($cfg['smtp_user']), 334, 'sign-in (user)'); $cmd(base64_encode($cfg['smtp_pass']), 235, 'sign-in (password)'); }
  }
  $cmd("MAIL FROM:<$from>", 250);
  $cmd("RCPT TO:<$to>", [250, 251]);
  $cmd('DATA', 354);
  $cmd(preg_replace('/^\./m', '..', $data) . "\r\n.", 250, 'message');   // a line starting with a dot gets a second dot
  fwrite($s, "QUIT\r\n"); fclose($s);
}

try {
  if ($cfg['smtp_host'] !== '') smtp_send($cfg, $cfg['from'], $cfg['to'], $data);
  else {
    // no mail server given: use the web host's own mail()
    $h = array_values(array_filter($headers, function ($x) { return stripos($x, 'To:') !== 0 && stripos($x, 'Subject:') !== 0; }));
    if (!mail($cfg['to'], $enc($subj), rtrim(chunk_split(base64_encode($body), 76, "\r\n")), implode("\r\n", $h), '-f' . $cfg['from'])) throw new Exception('mail() failed');
  }
} catch (Exception $e) {
  error_log('Family Observatory contact form: ' . $e->getMessage());
  reply(false, 'The message could not be sent just now. Please try again later.', 502);
}

$times[] = time();
@file_put_contents($log, implode(',', $times), LOCK_EX);
reply(true);
