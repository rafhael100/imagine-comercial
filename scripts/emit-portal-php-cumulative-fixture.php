<?php
declare(strict_types=1);

/**
 * F307 — CI-only PHP issuer for a three-release SYNTHETIC catalog history.
 * Uses the exact Portal PublicCatalogSigner class checked out at a pinned SHA.
 * No Portal API, database, keys on disk, PII or production authorization.
 */
if (getenv('GITHUB_ACTIONS') !== 'true' || count($argv) !== 3 ||
    !extension_loaded('sodium') || !extension_loaded('mbstring')) {
    fwrite(STDERR, "F307: CI-only PHP signature fixture unavailable\n");
    exit(2);
}
$signerFile = realpath(__DIR__.'/../.qa/portal-signer/apps/portal/app/Domain/CommercialPublishing/PublicCatalogSigner.php');
$inputFile = realpath($argv[1]);
$folder = realpath($argv[2]);
if (!$signerFile || !$inputFile || !$folder || !is_dir($folder) ||
    !is_file($inputFile) || filesize($inputFile) > 30000) {
    fwrite(STDERR, "F307: invalid synthetic source\n");
    exit(2);
}
require_once $signerFile;
use App\Domain\CommercialPublishing\PublicCatalogSigner;
try {
    $data = json_decode(file_get_contents($inputFile), true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data) || array_keys($data) !== ['schema','snapshots'] ||
        $data['schema'] !== 'imagine.comercial.php-cumulative-fixture.v1' ||
        !is_array($data['snapshots']) || count($data['snapshots']) !== 3 ||
        !array_is_list($data['snapshots'])) {
        throw new RuntimeException('F307: invalid fixture shape');
    }
    $keypair = sodium_crypto_sign_keypair();
    $secret = sodium_crypto_sign_secretkey($keypair);
    $publicRaw = sodium_crypto_sign_publickey($keypair);
    $releases = [];
    foreach ($data['snapshots'] as $snapshot) {
        $envelope = PublicCatalogSigner::sign($snapshot, 'portal_contract_f307', $secret);
        $releases[] = [
            'envelope' => $envelope,
            'pin' => [
                'expectedReleaseId' => $snapshot['releaseId'],
                'expectedPayloadSha256' => hash('sha256', base64_decode($envelope['payloadBase64'], true))
            ]
        ];
    }
    // RFC8410 SubjectPublicKeyInfo for Ed25519 raw public key.
    $pem = "-----BEGIN PUBLIC KEY-----\n".
        chunk_split(base64_encode(hex2bin('302a300506032b6570032100').$publicRaw),64,"\n").
        "-----END PUBLIC KEY-----\n";
    $history = json_encode([
        'schema' => 'imagine.comercial.signed-history-package.v1',
        'releases' => $releases
    ], JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $latest = json_encode($releases[2]['envelope'], JSON_THROW_ON_ERROR);
    foreach ([
        'f307-history.json' => $history,
        'f307-latest.json' => $latest,
        'f307-public.pem' => $pem
    ] as $name => $contents) {
        $path = $folder.'/'.$name;
        if (file_put_contents($path,$contents,LOCK_EX) === false) {
            throw new RuntimeException('F307: cannot emit test fixture');
        }
        chmod($path,0600);
    }
    sodium_memzero($secret);
    echo "F307: Portal PHP signed three synthetic cumulative releases.\n";
} catch (Throwable $error) {
    // Never reveal payloads or PHP file paths in CI log.
    fwrite(STDERR, "F307: synthetic PHP signature fixture rejected\n");
    exit(2);
}
