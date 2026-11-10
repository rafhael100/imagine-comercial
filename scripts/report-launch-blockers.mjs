#!/usr/bin/env node
/**
 * F43: strictly offline launch-blockers report. This script cannot receive
 * asserted gate approvals, download evidence, or enable deployment.
 */
import {evaluateLaunchReadiness} from '../src/lib/launch-readiness.mjs';

function requestedTarget(argv){
  if(argv.length===0) return 'production';
  if(argv.length!==1||!['--target=production','--target=staging'].includes(argv[0]))
    throw new Error('readiness report: expected only --target=staging|production');
  return argv[0].slice('--target='.length);
}
export function renderReadinessReport(argv=[]){
  const report=evaluateLaunchReadiness({requestedTarget:requestedTarget(argv)});
  return JSON.stringify({
    schema:'imagine.comercial.offline-blocker-report.v1',
    target:report.target,
    status:report.state,
    blockers:report.unresolved,
    count:report.unresolved.length,
    checkedAgainst:'F42_STATIC_GATES_NOT_RUNTIME_VERIFICATION',
    approval:'NOT_AUTHORIZED',
    deploymentPerformed:false
  },null,2);
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    console.log(renderReadinessReport(process.argv.slice(2)));
  }catch(error){
    console.error('Readiness report rejected:',error.message);
    process.exitCode=2;
  }
}
