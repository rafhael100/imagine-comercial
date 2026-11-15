/**
 * F324: static, opt-in WhatsApp URL for reviewed, anonymous quote selections.
 * The phone number is the existing public Imagine WhatsApp; tests assert
 * parity with contactChannels, and the HTML/DOM outbound allowlists enumerate
 * every permitted URL. No arbitrary string or URL parameter is accepted.
 */
import {reviewedQuoteChoiceMessage} from './reviewed-quote-choice-messages.mjs';
const PUBLIC_WHATSAPP='https://wa.me/5585996632689';
export function reviewedQuoteChoiceHref(locale,selection){
 return PUBLIC_WHATSAPP+'?text='+encodeURIComponent(reviewedQuoteChoiceMessage(locale,selection));
}
