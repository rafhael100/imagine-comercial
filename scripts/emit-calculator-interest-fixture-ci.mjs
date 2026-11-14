/**
 * CI-ONLY cross-repository vector emitted by the Commercial Node producer.
 * No secret, no customer data, no network and no browser use.
 * This script is not an API handler. The key below is openly disposable.
 */
import {createSyntheticCalculatorIntent} from '../src/lib/synthetic-calculator-interest-interop-lab.mjs';

if(process.argv.length!==2 ||
  (process.env.IMAGINE_RELEASE_TARGET && process.env.IMAGINE_RELEASE_TARGET!=='review')){
  process.exitCode=2;
}else{
  const payload={
    schema:'imagine.calculator.synthetic-interest.v1',
    source:'imagine_comercial_calculadora_performance',
    submission_id:'123e4567-e89b-42d3-a456-426614174000',
    channel_ids:['chatgpt_ads','google_ads','meta_ads'],
    currency:'BRL',
    media_total_cents:430000,
    report_requested:true,
    marketing_requested:false,
    notice_version:'lab-notice-v1',
    issued_at:1794672000,
    expires_at:1794672300,
    nonce:'f2e67d4e-39c1-43ba-a304-7db5477a2e66'
  };
  const disposable='IMAGINE_CALCULATOR_CI_ONLY_KEY_2026_NOT_FOR_PRODUCTION_ABC123';
  process.stdout.write(JSON.stringify(createSyntheticCalculatorIntent(payload,disposable))+'\n');
}
