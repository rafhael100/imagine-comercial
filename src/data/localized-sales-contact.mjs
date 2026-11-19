/** Build URLs only for reviewed locale and approved service; no user content. */
import {contactWhatsAppUrl} from './contact-channels.mjs';
import {localizedSalesMessages as messages} from './localized-sales-messages.mjs';
export function localizedSalesWhatsAppUrl(locale,slug){
 if(!Object.hasOwn(messages,locale)||!Object.hasOwn(messages[locale],slug))
   throw Error('Unreviewed localized service contact');
 return contactWhatsAppUrl(messages[locale][slug]);
}
