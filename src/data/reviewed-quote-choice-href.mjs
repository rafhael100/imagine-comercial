/**
 * F324: static, opt-in WhatsApp URL for reviewed, anonymous quote selections.
 * The phone number is the existing public Imagine WhatsApp; tests assert
 * parity with contactChannels, and the HTML/DOM outbound allowlists enumerate
 * every permitted URL. No arbitrary string or URL parameter is accepted.
 */
import {reviewedQuoteChoiceMessage} from './reviewed-quote-choice-messages.mjs';
import {contactWhatsAppUrl} from './contact-channels.mjs';
export function reviewedQuoteChoiceHref(locale,selection){
 return contactWhatsAppUrl(reviewedQuoteChoiceMessage(locale,selection));
}
