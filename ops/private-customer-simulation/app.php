<?php
declare(strict_types=1);

// Dedicated, fictional customer journey. Never imports a PSP, CRM or production database.
const BASE = '/simulacao/compra/';
date_default_timezone_set('America/Sao_Paulo');
if (getenv('IMAGINE_CUSTOMER_SIMULATION') !== 'private-demo-v1'
    || strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]) !== 'comercial-dev.imaginecomunica.com.br') {
    http_response_code(404); exit;
}
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; connect-src 'none'");
$path = parse_url($_SERVER['REQUEST_URI'] ?? BASE, PHP_URL_PATH);
if (in_array($path, [BASE.'style.css', BASE.'app.js', BASE.'commercial-demo-link.js'], true)) {
    header('Content-Type: '.(str_ends_with($path, '.css') ? 'text/css' : 'text/javascript').'; charset=utf-8');
    readfile(__DIR__.'/'.basename($path)); exit;
}
if ($path !== BASE && $path !== rtrim(BASE, '/')) { http_response_code(404); exit; }
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', '14400');
session_name('imagine_customer_demo');
session_save_path(getenv('SIMULATION_SESSION_PATH') ?: '/data/sessions');
session_set_cookie_params(['lifetime'=>0, 'path'=>BASE, 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$_SESSION['flow'] ??= ['selection'=>['site'=>'onepage','channels'=>[],'tier'=>'recommended'], 'customer'=>null,'order'=>null];
$flow =& $_SESSION['flow'];
function h(mixed $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function money(int $c): string { return 'R$ '.number_format($c/100, 2, ',', '.'); }
function go(string $step): never { header('Location: '.BASE.'?step='.$step, true, 303); exit; }
function dateAfter(int $days): string { return (new DateTimeImmutable('today'))->modify('+'.$days.' days')->format('d/m/Y'); }
function selection(array $input): array {
    foreach (['site','tier'] as $k) if (!isset($input[$k]) || !is_string($input[$k])) throw new DomainException('Seleção inválida. Escolha novamente.');
    if (!in_array($input['site'], ['none','onepage','landing-pages'], true) || !in_array($input['tier'], ['minimum','recommended'], true)) throw new DomainException('Serviço ou faixa de investimento inválidos.');
    $channels = $input['channels'] ?? [];
    if (is_string($channels)) $channels = $channels === '' ? [] : explode(',', $channels);
    if (!is_array($channels) || count($channels)>3 || count(array_unique($channels, SORT_REGULAR))!==count($channels)) throw new DomainException('Canais inválidos.');
    foreach ($channels as $channel) if (!is_string($channel) || !in_array($channel, ['google_ads','meta_ads','chatgpt_ads'], true)) throw new DomainException('Este canal não está disponível para simulação.');
    sort($channels);
    if ($input['site']==='none' && !$channels) throw new DomainException('Escolha um site ou pelo menos um canal de anúncios.');
    return ['site'=>$input['site'],'channels'=>$channels,'tier'=>$input['tier']];
}
function quote(array $s): array {
    $setup = match($s['site']) { 'onepage'=>99000, 'landing-pages'=>129000, default=>0 };
    $ads=[];
    foreach ($s['channels'] as $ch) {
        $media = match($ch){'google_ads'=>$s['tier']==='minimum'?100000:150000,'meta_ads'=>$s['tier']==='minimum'?70000:100000,'chatgpt_ads'=>$s['tier']==='minimum'?120000:180000};
        $ads[]=['channel'=>$ch,'label'=>match($ch){'google_ads'=>'Google Ads','meta_ads'=>'Instagram + Facebook','chatgpt_ads'=>'ChatGPT Ads'},'media'=>$media,'management'=>max(17000, intdiv($media,5)),'activation'=>49000];
    }
    return ['policy'=>'DEMO-V1-2026-11-14','site'=>$s['site'], 'siteLabel'=>match($s['site']){'onepage'=>'Onepage','landing-pages'=>'Landing Page',default=>'Sem site'},'setup'=>$setup,'installment'=>intdiv($setup,3),'monthly'=>$setup?7990:0,'ads'=>$ads,'activation'=>count($ads)*49000,'media'=>array_sum(array_column($ads,'media')),'management'=>array_sum(array_column($ads,'management')),'now'=>intdiv($setup,3)+count($ads)*49000];
}
$step = $_GET['step'] ?? 'choose';
if (!is_string($step) || !in_array($step,['choose','summary','account','review','payment','success','briefing','panel'],true)) $step='choose';
$error = '';
if ($_SERVER['REQUEST_METHOD']==='GET' && isset($_GET['site']) && $flow['order']===null) {
    try { $flow['selection']=selection($_GET); $step='summary'; } catch (DomainException $e) { $error=$e->getMessage(); $step='choose'; }
}
if ($_SERVER['REQUEST_METHOD']==='POST') {
    if (!is_string($_POST['csrf'] ?? null) || !hash_equals($_SESSION['csrf'], $_POST['csrf'])) { http_response_code(419); echo 'A sessão expirou. Atualize a página e tente novamente.'; exit; }
    $action = $_POST['action'] ?? '';
    try {
        if ($action==='new') {
            session_regenerate_id(true);
            $_SESSION['flow']=['selection'=>['site'=>'onepage','channels'=>[],'tier'=>'recommended'],'customer'=>null,'order'=>null];
            $_SESSION['csrf']=bin2hex(random_bytes(32)); go('choose');
        }
        if ($action==='choose') {
            if ($flow['order']!==null) throw new DomainException('Este pedido já foi criado. Inicie outra simulação para alterar os serviços.');
            $flow['selection']=selection($_POST); go('summary');
        }
        if ($action==='account') {
            if (!in_array($_POST['mode']??'', ['login','register'], true)) throw new DomainException('Escolha como deseja acessar.');
            if ($flow['order']!==null) throw new DomainException('Não é possível trocar o cliente de um pedido criado.');
            session_regenerate_id(true);
            $flow['customer']=['name'=>'Cliente Demonstração','company'=>'Empresa Exemplo','account_mode'=>$_POST['mode']];
            $_SESSION['csrf']=bin2hex(random_bytes(32)); go('review');
        }
        if ($action==='order') {
            if (!$flow['customer']) throw new DomainException('Identifique-se na conta de demonstração antes de continuar.');
            if (($flow['order']??null)!==null) go($flow['order']['status']==='approved'?'success':'payment');
            if (($_POST['ack']??'')!=='yes') throw new DomainException('Confirme que leu o resumo da simulação.');
            $flow['order']=['id'=>'DEMO-'.strtoupper(bin2hex(random_bytes(5))),'status'=>'pending','quote'=>quote($flow['selection']),'created'=>date(DATE_ATOM),'dates'=>[dateAfter(0),dateAfter(30),dateAfter(60),dateAfter(90)],'revision'=>1,'method'=>null,'briefing'=>null];
            go('payment');
        }
        if ($action==='pay') {
            if (!$flow['customer'] || !$flow['order']) throw new DomainException('Crie um pedido de demonstração antes de continuar.');
            if (!hash_equals($flow['order']['id'], (string)($_POST['order_id']??''))) throw new DomainException('O pedido não pertence a esta sessão.');
            if ($flow['order']['status']==='approved') go('success');
            if ((string)$flow['order']['revision']!==($_POST['revision']??null)) throw new DomainException('O pedido foi atualizado em outra aba. Atualize esta página.');
            if (!in_array($_POST['method']??'', ['pix','card','boleto'],true) || !in_array($_POST['outcome']??'', ['approved','pending','declined'],true)) throw new DomainException('Opção de pagamento inválida.');
            $flow['order']['status']=$_POST['outcome']; $flow['order']['method']=$_POST['method']; $flow['order']['revision']++;
            if ($_POST['outcome']==='approved') $flow['order']['paid_at']=date(DATE_ATOM);
            go($_POST['outcome']==='approved'?'success':'payment');
        }
        if ($action==='briefing') {
            if (!$flow['customer'] || ($flow['order']['status']??'')!=='approved') throw new DomainException('O briefing só é liberado após o pagamento fictício aprovado.');
            $goal=$_POST['goal']??''; $style=$_POST['style']??'';
            if (!in_array($goal,['leads','sales','brand'],true) || !in_array($style,['modern','classic','bold'],true)) throw new DomainException('Preencha o objetivo e a preferência visual.');
            $flow['order']['briefing']=['goal'=>$goal,'style'=>$style,'sample_materials'=>true,'saved'=>date(DATE_ATOM)]; go('panel');
        }
        throw new DomainException('Ação inválida.');
    } catch (DomainException $e) { $error=$e->getMessage(); }
}
$q=$flow['order']['quote'] ?? quote($flow['selection']);
if (in_array($step,['review','payment','success','briefing','panel'],true) && !$flow['customer']) $step='account';
if (in_array($step,['payment','success','briefing','panel'],true) && !$flow['order']) $step='review';
if (in_array($step,['success','briefing'],true) && ($flow['order']['status']??'')!=='approved') $step='payment';
header('Content-Type: text/html; charset=utf-8');
require __DIR__.'/view.php';
