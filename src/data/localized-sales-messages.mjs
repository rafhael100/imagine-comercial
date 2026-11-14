/** Reviewed fixed international WhatsApp prompts; never insert visitor input. */
import {services} from './services.mjs';
const messages=Object.freeze({
 en:Object.freeze({
  onepage:'Hello Imagine, I would like to discuss a Onepage website for my business.',
  'landing-pages':'Hello Imagine, I would like to discuss a Landing Page for my business.',
  'criacao-de-sites':'Hello Imagine, I would like to discuss a complete business website.',
  'gestao-google-ads':'Hello Imagine, I would like to discuss Google Ads management.',
  'gestao-meta-ads':'Hello Imagine, I would like to discuss Instagram and Facebook ads management.',
  'sites-por-assinatura':'Hello Imagine, I would like to learn about subscription websites.',
  'gestao-chatgpt-ads':'Hello Imagine, I would like information about ChatGPT Ads pilot eligibility.'
 }),
 es:Object.freeze({
  onepage:'Hola Imagine, quisiera consultar sobre una página Onepage para mi empresa.',
  'landing-pages':'Hola Imagine, quisiera consultar sobre una Landing Page para mi empresa.',
  'criacao-de-sites':'Hola Imagine, quisiera consultar sobre un sitio web completo para mi empresa.',
  'gestao-google-ads':'Hola Imagine, quisiera consultar sobre la gestión de anuncios en Google Ads.',
  'gestao-meta-ads':'Hola Imagine, quisiera consultar sobre anuncios en Instagram y Facebook.',
  'sites-por-assinatura':'Hola Imagine, quisiera conocer los sitios web por suscripción.',
  'gestao-chatgpt-ads':'Hola Imagine, quisiera consultar sobre la elegibilidad de un piloto de ChatGPT Ads.'
 })
});
const approved=new Set(services.map(s=>s.slug));
for(const locale of ['en','es']){
 const entries=Object.entries(messages[locale]);
 if(entries.length!==approved.size||entries.some(([slug,msg])=>!approved.has(slug)||msg.length>280||/\r|\n/.test(msg)))
   throw Error('Invalid localized public sales messages');
}
export const localizedSalesMessages=messages;
