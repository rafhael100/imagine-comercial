/**
 * F36 — Canais de atendimento APENAS PÚBLICOS de um único catálogo curado.
 * Evidência de leitura pública: página Contato + rodapé do domínio legado
 * imaginecomunicacao.com.br em 09/11/2026.
 *
 * Esta evidência NÃO comprova que as linhas estão ativas ou que constituem
 * aprovação para publicação. O responsável deve reconfirmar antes do deploy.
 */
export const contactChannels=Object.freeze({
  email:'imagine@imaginecomunicacao.com.br',
  phoneE164:'+558530329525',
  phoneDisplay:'(85) 3032-9525',
  whatsappE164:'5585996632689',
  whatsappDisplay:'(85) 9 9663-2689',
  whatsappBaseHref:'https://wa.me/5585996632689',
  reference:'https://www.imaginecomunicacao.com.br/fale-conosco.html',
  observedOn:'2026-11-09'
});

const defaultMessage='Olá, gostaria de conhecer os serviços da Imagine.';
const defaultSubject='Contato Imagine';

function rejectUnsafeText(value,maxLength,context) {
  if(typeof value!=='string' || !value || value.length>maxLength ||
     /[\u0000-\u001f\u007f]/.test(value))
    throw new Error('F36: invalid public '+context);
}

export function contactWhatsAppUrl(message=defaultMessage) {
  rejectUnsafeText(message,280,'WhatsApp message');
  if(!message.startsWith('Olá,') || !message.includes('Imagine'))
    throw new Error('F36: WhatsApp message outside curated intent');
  return contactChannels.whatsappBaseHref+'?text='+encodeURIComponent(message);
}

export function contactEmailUrl(subject=defaultSubject,body) {
  rejectUnsafeText(subject,120,'email subject');
  if(!subject.startsWith('Contato Imagine') &&
     !subject.startsWith('Proposta Imagine'))
    throw new Error('F36: email subject outside curated intent');
  // F142: corpo opcional, preenchido somente pelo clique do visitante.
  // Não aceitar textos livres, dados pessoais ou mensagens além do catálogo.
  if(body!==undefined){
    rejectUnsafeText(body,280,'email body');
    if(!body.startsWith('Olá,')||!body.includes('Imagine'))
      throw new Error('F142: email body outside curated intent');
  }
  return 'mailto:'+contactChannels.email+'?subject='+encodeURIComponent(subject)+
    (body===undefined?'':'&body='+encodeURIComponent(body));
}
