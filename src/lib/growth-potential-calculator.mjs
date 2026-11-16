/**
 * F331 — educational, deterministic growth funnel (never a forecast).
 *
 * These are HYPOTHETICAL arithmetic assumptions, NOT market benchmarks or
 * proven sector conversion rates. Sector changes guidance ONLY, never rates.
 * No PII, source of actual traffic, cookies, CRM, payment or side effects.
 */
export const GROWTH_SCENARIOS=Object.freeze({
 conservative:Object.freeze({leadBasisPoints:200,closeBasisPoints:1000}),
 reference:Object.freeze({leadBasisPoints:400,closeBasisPoints:2000}),
 optimistic:Object.freeze({leadBasisPoints:600,closeBasisPoints:3000})
});
export const GROWTH_SECTORS=Object.freeze([
 'services','retail','ecommerce','education','healthcare','food','other'
]);
export const GROWTH_WEEKS_PER_MONTH=4;
export const MAX_WEEKLY_VISITS=100000;
export const MAX_MONTHLY_CUSTOMER_GOAL=10000;
const allowed=new Set(GROWTH_SECTORS);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

/**
 * Whole-number illustration: 400 monthly visits => 8/16/24 leads, 1/3/7
 * customers under conservative/reference/optimistic assumptions.
 * 4 weeks/month is intentionally a planning approximation, not an official
 * calendar month. Visitors may enter a weekly estimate without identifying
 * themselves. Values are rounded for presentation, not a sales guarantee.
 */
export function buildGrowthPotential({weeklyVisits,sector='other',scenario='reference'}={}){
 if(!Number.isSafeInteger(weeklyVisits)||weeklyVisits<0||weeklyVisits>MAX_WEEKLY_VISITS)
   throw new RangeError('Weekly visits must be a whole number from 0 to 100000');
 if(typeof sector!=='string'||!allowed.has(sector))
   throw new TypeError('Unreviewed sector');
 if(typeof scenario!=='string'||!own(GROWTH_SCENARIOS,scenario))
   throw new TypeError('Unreviewed growth scenario');
 const monthlyVisits=weeklyVisits*GROWTH_WEEKS_PER_MONTH;
 const estimates=Object.fromEntries(Object.entries(GROWTH_SCENARIOS).map(([name,assumptions])=>{
   const expectedLeads=monthlyVisits*assumptions.leadBasisPoints/10000;
   const expectedCustomers=expectedLeads*assumptions.closeBasisPoints/10000;
   return [name,Object.freeze({
     leadRatePercent:assumptions.leadBasisPoints/100,
     closeRatePercent:assumptions.closeBasisPoints/100,
     leads:Math.round(expectedLeads),
     customers:Math.round(expectedCustomers)
   })];
 }));
 const chosen=estimates[scenario];
 return Object.freeze({
   sector,scenario,weeklyVisits,monthlyVisits,
   scenarios:Object.freeze(estimates),
   leads:chosen.leads,customers:chosen.customers,
   leadsRange:Object.freeze([estimates.conservative.leads,estimates.optimistic.leads]),
   customersRange:Object.freeze([estimates.conservative.customers,estimates.optimistic.customers]),
   assumptionOnly:true,
   actualPerformanceData:false,
   visitorIdentityCaptured:false,
   customerDataStored:false,
   realResultsGuaranteed:false
 });
}

/**
 * F336: reverse the same hypothetical model to show the smallest whole
 * weekly traffic volume whose ROUNDED illustration meets the stated goal.
 * Monotone binary search keeps the existing public traffic ceiling; it is
 * deliberately not an industry benchmark, acquisition plan or SLA.
 * No network, PII, storage or external calls.
 */
export function planVisitsForCustomerGoal({monthlyCustomerGoal,scenario='reference'}={}){
 if(!Number.isSafeInteger(monthlyCustomerGoal)||monthlyCustomerGoal<0||
    monthlyCustomerGoal>MAX_MONTHLY_CUSTOMER_GOAL)
   throw new RangeError('Monthly customer goal out of reviewed simulation range');
 if(typeof scenario!=='string'||!own(GROWTH_SCENARIOS,scenario))
   throw new TypeError('Unreviewed growth scenario');
 const max=buildGrowthPotential({weeklyVisits:MAX_WEEKLY_VISITS,scenario});
 if(max.customers<monthlyCustomerGoal)
   return Object.freeze({reachable:false,scenario,monthlyCustomerGoal,
    weeklyCap:MAX_WEEKLY_VISITS,maxIllustratedCustomers:max.customers,
    assumptionOnly:true,realResultsGuaranteed:false});
 let low=0,high=MAX_WEEKLY_VISITS;
 while(low<high){
   const mid=Math.floor((low+high)/2);
   const estimate=buildGrowthPotential({weeklyVisits:mid,scenario});
   if(estimate.customers>=monthlyCustomerGoal)high=mid;
   else low=mid+1;
 }
 const estimate=buildGrowthPotential({weeklyVisits:low,scenario});
 return Object.freeze({
   reachable:true,scenario,monthlyCustomerGoal,
   weeklyVisits:low,monthlyVisits:estimate.monthlyVisits,
   leads:estimate.leads,customers:estimate.customers,
   assumptionOnly:true,realResultsGuaranteed:false
 });
}
