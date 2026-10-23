<?php
declare(strict_types=1);

/**
 * 风屿书房 · 留言信箱 API
 * GET  /api/guestbook  返回已公开的留言
 * POST /api/guestbook  投递一封信（公开留言直接上墙，悄悄话仅存服务器）
 *
 * 数据文件放在 web 根目录之外，由 www-data 读写。
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const DATA_DIR = '/var/lib/xiaoquanzi';
const STORE_FILE = DATA_DIR . '/guestbook.json';
const RATE_FILE = DATA_DIR . '/ratelimit.json';

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ensure_dir(): void
{
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0775, true);
    }
}

function read_store(): array
{
    ensure_dir();
    if (!is_file(STORE_FILE)) {
        return [];
    }
    $raw = @file_get_contents(STORE_FILE);
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function clean_text(string $value, int $max): string
{
    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    return substr($value, 0, $max);
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function rate_limited(string $ip): bool
{
    ensure_dir();
    $now = time();
    $map = [];
    if (is_file(RATE_FILE)) {
        $raw = @file_get_contents(RATE_FILE);
        $decoded = $raw === false ? null : json_decode($raw, true);
        if (is_array($decoded)) {
            $map = $decoded;
        }
    }
    $last = isset($map[$ip]) ? (int) $map[$ip] : 0;
    if ($now - $last < 60) {
        return true;
    }
    $map[$ip] = $now;
    // 顺手清理超过一天没出现的 IP
    foreach ($map as $key => $ts) {
        if ($now - (int) $ts > 86400) {
            unset($map[$key]);
        }
    }
    @file_put_contents(RATE_FILE, json_encode($map), LOCK_EX);
    return false;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $all = read_store();
    $public = array_values(array_filter($all, static fn ($item) => is_array($item) && !empty($item['approved'])));
    // 新的在前
    usort($public, static fn ($a, $b) => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));
    $public = array_map(static fn ($item) => [
        'id' => (string) ($item['id'] ?? ''),
        'name' => (string) ($item['name'] ?? '匿名旅人'),
        'station' => (string) ($item['station'] ?? ''),
        'message' => (string) ($item['message'] ?? ''),
        'tag' => (string) ($item['tag'] ?? '网文同好'),
        'created_at' => (string) ($item['created_at'] ?? ''),
    ], $public);
    respond(200, ['ok' => true, 'messages' => array_slice($public, 0, 60), 'total' => count($public)]);
}

if ($method !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);
if (!is_array($input)) {
    $input = $_POST;
}

// 蜜罐：正常用户不会填这个隐藏字段
if (!empty($input['website'])) {
    respond(200, ['ok' => true]);
}

$name = clean_text((string) ($input['name'] ?? ''), 40);
$station = clean_text((string) ($input['station'] ?? ''), 100);
$message = clean_text((string) ($input['message'] ?? ''), 800);
$tag = clean_text((string) ($input['tag'] ?? '网文同好'), 20);
$private = !empty($input['private']);

if ($name === '' || $message === '') {
    respond(422, ['ok' => false, 'error' => 'missing_fields', 'message' => '昵称和正文都要写一点。']);
}

$ip = client_ip();
if (rate_limited($ip)) {
    respond(429, ['ok' => false, 'error' => 'rate_limited', 'message' => '投递得太快了，歇一会儿再写吧。']);
}

$entry = [
    'id' => bin2hex(random_bytes(6)),
    'name' => $name,
    'station' => $station,
    'message' => $message,
    'tag' => $tag === '' ? '网文同好' : $tag,
    'private' => $private,
    'approved' => !$private,
    'created_at' => gmdate('c'),
    'ip_hash' => substr(hash('sha256', $ip), 0, 12),
];

ensure_dir();
$handle = @fopen(STORE_FILE, 'c+');
if ($handle === false) {
    respond(500, ['ok' => false, 'error' => 'store_unavailable']);
}
flock($handle, LOCK_EX);
$contents = stream_get_contents($handle);
$store = json_decode($contents ?: '[]', true);
if (!is_array($store)) {
    $store = [];
}
$store[] = $entry;
ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($store, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

respond(200, [
    'ok' => true,
    'private' => $private,
    'message' => $private
        ? '悄悄话已经收妥，只有房主会在夜里拆封。'
        : '信笺已上墙，谢谢你让这间书房多了一盏灯。',
]);
