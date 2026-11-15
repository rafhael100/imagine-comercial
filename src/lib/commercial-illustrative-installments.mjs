/**
 * F329 — informative display only, NEVER a payment instruction or PSP split.
 *
 * The current private DEMO-V2 combines setup and advertising activations into
 * three simulated installments, while the production-bound Portal V5 still
 * quotes separate obligations. This cent-safe breakdown MUST NOT be used to
 * authorize a real combined invoice or change Portal due dates.
 *
 * Follow the existing DEMO-V2 rule exactly: installments 1 and 2 use
 * floor(total/3) and the 3rd receives the remaining cents.
 */
export function splitThreeIllustrativeInstallments(totalCents){
  if(!Number.isSafeInteger(totalCents)||totalCents<0||totalCents>100000000)
    throw new TypeError('Invalid three-installment illustration');
  const first=Math.floor(totalCents/3);
  const last=totalCents-2*first;
  return Object.freeze({
    totalCents,
    firstCents:first,
    secondCents:first,
    thirdCents:last,
    lastCentAdjustmentCents:last-first,
    installmentCount:3,
    realCheckoutAuthorized:false,
    realCombinedPaymentAuthorized:false
  });
}
