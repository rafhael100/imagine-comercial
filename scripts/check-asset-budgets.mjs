import {checkStaticBudgets} from '../src/lib/performance-budgets.mjs';
try{
  const result=await checkStaticBudgets(process.argv[2]||'dist');
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='within_budget')process.exitCode=1;
}catch(error){console.error('Static performance budget failed:',error.message);process.exitCode=1;}
