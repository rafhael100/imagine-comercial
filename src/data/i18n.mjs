/**
 * Human-reviewed editorial starting point for international public marketing.
 * No automatic translation API, visitor profiling or language cookies.
 * All URLs are static, canonical, allowlisted and safe without JavaScript.
 * Service slugs and product/checkout IDs intentionally remain unchanged.
 */
export const INTERNATIONAL_LANGUAGES=Object.freeze(['en','es']);
export const INTERNATIONAL_SECTIONS=Object.freeze([
  '','services','compare','how-it-works','faq','about','contact',
  'services/criacao-de-sites','services/landing-pages','services/onepage',
  'services/sites-por-assinatura','services/gestao-google-ads','services/gestao-meta-ads'
]);
const PT_TO_INTERNATIONAL=Object.freeze({
  '/':'', '/servicos/':'services','/comparar-solucoes/':'compare',
  '/como-funciona/':'how-it-works','/perguntas-frequentes/':'faq',
  '/sobre/':'about','/contato/':'contact',
  '/servicos/criacao-de-sites/':'services/criacao-de-sites',
  '/servicos/landing-pages/':'services/landing-pages',
  '/servicos/onepage/':'services/onepage',
  '/servicos/sites-por-assinatura/':'services/sites-por-assinatura',
  '/servicos/gestao-google-ads/':'services/gestao-google-ads',
  '/servicos/gestao-meta-ads/':'services/gestao-meta-ads'
});
const INTERNATIONAL_TO_PT=Object.freeze(Object.fromEntries(
  Object.entries(PT_TO_INTERNATIONAL).map(([pt,section])=>[section,pt])
));
export const intlPath=(lang,section='')=>{
  if(!INTERNATIONAL_LANGUAGES.includes(lang)||!INTERNATIONAL_SECTIONS.includes(section))
    throw new Error('Unreviewed language or international route');
  return '/'+lang+'/'+(section?section+'/':'');
};
export const internationalPagePaths=Object.freeze(
  INTERNATIONAL_LANGUAGES.flatMap(lang=>INTERNATIONAL_SECTIONS.map(section=>intlPath(lang,section)))
);
export const sectionForPortuguesePath=path=>PT_TO_INTERNATIONAL[path]??null;
export const portuguesePathForSection=section=>INTERNATIONAL_TO_PT[section]??null;
export function languageAlternates(pathname){
  const section=pathname.startsWith('/en/')||pathname.startsWith('/es/')
    ? pathname.split('/').slice(2).filter(Boolean).join('/')
    :sectionForPortuguesePath(pathname);
  if(section===null||!INTERNATIONAL_SECTIONS.includes(section))return null;
  return Object.freeze({
    'pt-BR':INTERNATIONAL_TO_PT[section],
    'en':intlPath('en',section),
    'es':intlPath('es',section),
    'x-default':INTERNATIONAL_TO_PT[section]
  });
}
export function languageSwitchTargets(pathname){
  const matched=languageAlternates(pathname);
  return Object.freeze({
    'pt-BR':matched?.['pt-BR']??'/',
    'en':matched?.en??'/en/',
    'es':matched?.es??'/es/'
  });
}

export const translations=Object.freeze({
  en:{
    name:'English',htmlLang:'en',ogLocale:'en_US',
    nav:{home:'Home',services:'Services',compare:'Compare',how:'How it works',faq:'FAQ',about:'About',contact:'Contact',portal:'Client portal',menu:'Menu'},
    accessibility:{skip:'Skip to content',langLabel:'Choose website language',home:'Imagine Comunicação Digital — home page',contact:'Contact Imagine',external:'Opens an external channel'},
    footer:{intro:'Websites, technology and digital marketing guided by clear goals for your business.',services:'Services',all:'Explore services',about:'Company',help:'Information',contact:'Talk to us',note:'Contact details must be reconfirmed before publication.',terms:'Services and proposals are subject to current commercial terms.'},
    hero:{eyebrow:'Technology + digital communication',title:'Build a stronger digital presence with a clear strategy.',intro:'Professional websites, conversion-focused pages and campaign management to help your business reach customers with confidence.',primary:'Discuss your project',secondary:'Explore our services',support:'Clear planning · Responsive experience · Organized follow-up'},
    headings:{services:'Digital services for different business goals',servicesIntro:'Choose a format that fits your offer, your audience and your growth stage. Deliverables and terms are confirmed in a proposal.',process:'From your first idea to ongoing improvement',processIntro:'Each project follows a reviewed proposal. The steps below are guidance, not a fixed delivery schedule.',contact:'Tell us about your project',about:'Technology and communication connected to business goals',compare:'Compare website and campaign formats',faq:'Common questions',note:'Service details and commercial terms must be confirmed before signing. No website or campaign can guarantee sales or search rankings.'},
    actions:{learn:'Explore details',contact:'Request a proposal',all:'See all services',back:'Back to services',contactByEmail:'Send an email',contactWhatsApp:'Talk on WhatsApp',more:'See options',full:'Portuguese articles'},
    stages:[
      ['Discover','Understand your business, audience and commercial objectives.'],
      ['Plan','Agree on the format, messaging, scope and approval steps.'],
      ['Build','Create pages or configure campaigns under the agreed proposal.'],
      ['Improve','Review progress and opportunities based on the available evidence.']
    ],
    about:{intro:'Imagine Comunicação Digital works across web development and digital communication, combining technology, planning and ongoing collaboration.',values:[['Understand','Learn about your customers, services and challenges.'],['Structure','Organize information for a clear, accessible user experience.'],['Follow up','Keep milestones, revisions and next steps transparent.']]},
    contact:{intro:'Choose how you would like to speak with Imagine. The integrated customer form is not active until approved for production.',noSend:'These links open your email application or WhatsApp. Nothing is sent automatically by this website.',safety:'Please do not send passwords, account access or sensitive personal documents through unverified channels.'},
    compare:{intro:'Choose a solution based on your audience, amount of content and the action you want visitors to take.',pairs:[['Onepage','An essential company presentation on a single page.'],['Landing Page','A focused page built around one campaign or offer.'],['Multi-page website','A broader information structure for your company and services.'],['Ad management','Planning and monitoring campaigns across approved advertising channels.']]},
    faq:[
      ['Can a professional website guarantee leads or sales?','No. Outcomes depend on your market, offer, audience and communication. We organize your digital presence to help people understand and contact your business.'],
      ['Is advertising budget included in Imagine management fees?','No. Media spend is paid directly to Google or Meta. Management fees are separate and are confirmed in the commercial proposal.'],
      ['Can I purchase a service directly from this website?','Contact Imagine first to review scope, proposal, contract and payment terms. A production checkout is not active on these international pages.'],
      ['How are project timelines and revisions defined?','Scope, responsibilities, delivery schedule and revisions are established in the specific accepted proposal.']
    ],
    services:{
      'criacao-de-sites':{label:'Website design & development',eyebrow:'Professional digital presence',intro:'A clear, responsive website that introduces your company, presents its services and gives visitors a straightforward next step.',approach:'We plan content hierarchy, usability and the pages most relevant to your audience.',details:[['Content and structure','Present key information and services in an understandable way.'],['Responsive experience','Build for comfortable reading and navigation across devices.'],['SEO foundations','Use descriptive URLs and accessible, searchable content.']],question:['Will a website automatically rank first on Google?','No ranking position is guaranteed. Technical structure and meaningful content provide a foundation for ongoing improvements.']},
      'landing-pages':{label:'Landing Pages',eyebrow:'Campaign and offer pages',intro:'Focused pages that introduce a specific offer and help visitors understand the intended next action.',approach:'We prioritize the message, audience, conversion path and supporting evidence for each campaign.',details:[['Clear offer','Explain benefits without unnecessary distractions.'],['Action-oriented layout','Design relevant calls to action and an intuitive page flow.'],['Technical quality','Consider responsive layout, accessibility and loading performance.']],question:['Is a Landing Page the same as a website?','No. A Landing Page typically focuses on one offer and action, while a website usually covers broader company information.']},
      onepage:{label:'Onepage websites',eyebrow:'A complete introduction on one page',intro:'Present your company, services and contact channels in one organized, easy-to-navigate page.',approach:'Ideal when the essential information can be communicated clearly in a single experience.',details:[['Simple presentation','Explain what your business does and whom it helps.'],['Easy navigation','Make essential sections easy to find.'],['Solid foundations','Plan responsiveness, SEO basics and accessibility from the start.']],question:['When is a Onepage appropriate?','When your business can be presented clearly on a single page. More complex information may benefit from separate pages.']},
      'sites-por-assinatura':{label:'Subscription websites',eyebrow:'Ongoing service model',intro:'A website delivery model with a defined initial setup and recurring services, managed through an organized customer relationship.',approach:'Scope, installments, subscription, term and cancellation conditions must be provided in the specific official proposal.',details:[['Defined scope','Know which activities and deliverables are included.'],['Centralized follow-up','Track project steps and approval requests as the customer portal is enabled.'],['Transparent terms','Review setup, recurring fees and conditions before acceptance.']],question:['Is the monthly fee separate from setup?','The specific proposal defines setup and recurring amounts and when they become due.']},
      'gestao-google-ads':{label:'Google Ads management',eyebrow:'Search and advertising campaigns',intro:'Campaign planning and follow-up to connect relevant searches with your company and its offer.',approach:'Objectives, advertising budget, landing pages and performance indicators guide campaign decisions.',details:[['Media planning','Align search intent, audience and budget.'],['Performance review','Monitor metrics and opportunities for improvement.'],['Separate billing','The advertising budget is paid to Google, separate from Imagine management fees.']],question:['Does the Google Ads budget go to Imagine?','No. You pay Google directly for media; Imagine management fees are a separate service cost.']},
      'gestao-meta-ads':{label:'Meta Ads management',eyebrow:'Instagram and Facebook campaigns',intro:'Plan and manage advertising across Meta channels with relevant messages, audiences and creative formats.',approach:'We consider your campaign goal, target audience, creative strategy, landing experience and observed results.',details:[['Campaign strategy','Match objectives to suitable audiences.'],['Creative and messaging','Develop and review relevant campaign formats.'],['Measurement','Follow results and make evidence-informed adjustments.']],question:['Are Instagram and Facebook separate channels for this service?','Instagram and Facebook belong to the Meta advertising channel; scope and commercial terms are confirmed in the proposal.']}
    }
  },
  es:{
    name:'Español',htmlLang:'es',ogLocale:'es_ES',
    nav:{home:'Inicio',services:'Servicios',compare:'Comparar',how:'Cómo trabajamos',faq:'Preguntas frecuentes',about:'Nosotros',contact:'Contacto',portal:'Portal del cliente',menu:'Menú'},
    accessibility:{skip:'Ir al contenido',langLabel:'Elegir el idioma del sitio',home:'Imagine Comunicação Digital — página de inicio',contact:'Contactar con Imagine',external:'Abre un canal externo'},
    footer:{intro:'Sitios web, tecnología y marketing digital con objetivos claros para tu empresa.',services:'Servicios',all:'Ver servicios',about:'Empresa',help:'Información',contact:'Hablemos',note:'Los datos de contacto deben confirmarse antes de la publicación.',terms:'Los servicios y las propuestas están sujetos a las condiciones comerciales vigentes.'},
    hero:{eyebrow:'Tecnología + comunicación digital',title:'Una presencia digital más fuerte empieza con una estrategia clara.',intro:'Sitios web profesionales, páginas comerciales y gestión de campañas para presentar tu negocio con confianza y generar nuevas oportunidades.',primary:'Hablemos de tu proyecto',secondary:'Conoce los servicios',support:'Planificación clara · Diseño adaptable · Seguimiento organizado'},
    headings:{services:'Soluciones digitales para diferentes objetivos',servicesIntro:'Elige el formato adecuado para tu propuesta, público y etapa de crecimiento. Las entregas y condiciones se confirman en una propuesta.',process:'De la primera idea a la mejora continua',processIntro:'Cada proyecto sigue una propuesta revisada. Estas etapas son orientativas, no representan plazos fijos.',contact:'Cuéntanos sobre tu proyecto',about:'Tecnología y comunicación conectadas a los objetivos de tu empresa',compare:'Compara formatos web y campañas',faq:'Preguntas frecuentes',note:'Los detalles y condiciones se confirman antes de la contratación. Ningún sitio ni campaña garantiza ventas o posiciones en buscadores.'},
    actions:{learn:'Conocer detalles',contact:'Solicitar una propuesta',all:'Ver todos los servicios',back:'Volver a servicios',contactByEmail:'Enviar correo',contactWhatsApp:'Hablar por WhatsApp',more:'Ver opciones',full:'Artículos en portugués'},
    stages:[
      ['Diagnóstico','Conocer tu empresa, clientes y objetivos comerciales.'],
      ['Planificación','Acordar formato, mensaje, alcance y aprobaciones.'],
      ['Implementación','Crear páginas o configurar campañas según la propuesta.'],
      ['Evolución','Revisar avances y oportunidades con la información disponible.']
    ],
    about:{intro:'Imagine Comunicação Digital desarrolla soluciones web y estrategias de comunicación, combinando tecnología, planificación y acompañamiento de proyectos.',values:[['Comprensión','Conocer clientes, servicios y desafíos.'],['Estructura','Organizar la información para una experiencia clara y accesible.'],['Seguimiento','Mantener visibles las etapas, revisiones y próximos pasos.']]},
    contact:{intro:'Elige cómo deseas hablar con Imagine. El formulario integrado todavía no está habilitado para el público.',noSend:'Estos enlaces abren tu correo o WhatsApp. El sitio no envía mensajes automáticamente.',safety:'No envíes contraseñas, accesos ni documentos personales sensibles por canales sin verificar.'},
    compare:{intro:'Elige según el público, la cantidad de información y la acción que esperas de tus visitantes.',pairs:[['Onepage','Presentación esencial de la empresa en una sola página.'],['Landing Page','Página enfocada en una campaña u oferta concreta.'],['Sitio de varias páginas','Estructura más amplia para presentar la empresa y sus servicios.'],['Gestión de anuncios','Planificación y seguimiento de campañas en canales publicitarios autorizados.']]},
    faq:[
      ['¿Un sitio profesional garantiza contactos o ventas?','No. Los resultados dependen del mercado, la oferta, el público y la comunicación. Una buena estructura facilita que las personas entiendan y contacten a tu empresa.'],
      ['¿El presupuesto de anuncios está incluido en los honorarios?','No. La inversión en publicidad se paga directamente a Google o Meta. Los honorarios de gestión se confirman por separado en la propuesta.'],
      ['¿Puedo contratar directamente desde este sitio?','Primero consulta con Imagine el alcance, la propuesta, el contrato y las condiciones de pago. Estas páginas internacionales no activan cobros.'],
      ['¿Cómo se establecen los plazos y las revisiones?','Las entregas, responsabilidades, fechas y revisiones se definen en la propuesta aceptada.']
    ],
    services:{
      'criacao-de-sites':{label:'Creación de sitios web',eyebrow:'Presencia digital profesional',intro:'Un sitio claro y adaptable que presenta tu empresa, sus servicios y los próximos pasos para los visitantes.',approach:'Planificamos los contenidos, la navegación y las páginas relevantes para tu público.',details:[['Contenido y estructura','Organiza y presenta la información esencial del negocio.'],['Experiencia adaptable','Ofrece lectura y navegación cómodas en varios dispositivos.'],['Bases para SEO','Utiliza direcciones claras y contenidos accesibles para los buscadores.']],question:['¿Un sitio garantiza la primera posición en Google?','No se garantizan posiciones. Una buena estructura técnica y el contenido relevante permiten mejorar continuamente.']},
      'landing-pages':{label:'Landing Pages',eyebrow:'Páginas para campañas y ofertas',intro:'Páginas enfocadas en explicar una oferta y facilitar una acción concreta.',approach:'Priorizamos el mensaje, el público, la conversión y el contenido de apoyo de cada campaña.',details:[['Oferta clara','Presenta los beneficios sin distracciones innecesarias.'],['Diseño orientado a la acción','Organiza llamadas a la acción y una navegación sencilla.'],['Calidad técnica','Considera diseño adaptable, accesibilidad y velocidad.']],question:['¿Una Landing Page es lo mismo que un sitio web?','No. Una Landing Page suele concentrarse en una oferta, mientras que un sitio web contiene información más amplia.']},
      onepage:{label:'Sitios Onepage',eyebrow:'Tu empresa en una sola página',intro:'Presenta tu negocio, servicios y canales de contacto en una única página organizada.',approach:'Una alternativa cuando la información esencial puede comunicarse claramente en una sola experiencia.',details:[['Presentación sencilla','Explica lo que ofrece tu empresa y a quién ayuda.'],['Navegación intuitiva','Facilita el acceso a las secciones más importantes.'],['Estructura sólida','Contempla SEO básico, accesibilidad y diseño adaptable.']],question:['¿Cuándo elegir una Onepage?','Cuando la información se puede presentar claramente en una página. Para negocios más complejos pueden convenir varias páginas.']},
      'sites-por-assinatura':{label:'Sitios por suscripción',eyebrow:'Servicio continuo',intro:'Un modelo de creación y mantenimiento de sitios con implantación y servicios recurrentes definidos.',approach:'El alcance, las cuotas, la mensualidad, la vigencia y la cancelación deben constar en la propuesta oficial.',details:[['Alcance definido','Conoce las actividades y entregas incluidas.'],['Seguimiento centralizado','Acompaña etapas y aprobaciones cuando se habilite el portal.'],['Condiciones transparentes','Revisa la implantación, las cuotas y otras condiciones antes de aceptar.']],question:['¿La mensualidad es independiente de la implantación?','La propuesta específica define los importes, los vencimientos y las condiciones.']},
      'gestao-google-ads':{label:'Gestión de Google Ads',eyebrow:'Campañas de búsqueda y anuncios',intro:'Planificación y seguimiento de campañas para conectar búsquedas relevantes con tu empresa.',approach:'Los objetivos, el presupuesto, las páginas de destino y los indicadores guían las decisiones.',details:[['Planificación de medios','Alinea intención de búsqueda, público y presupuesto.'],['Seguimiento','Analiza métricas y oportunidades de optimización.'],['Cobro separado','La publicidad se paga a Google, separada de los honorarios de Imagine.']],question:['¿El presupuesto de Google Ads se paga a Imagine?','No. Pagas los anuncios directamente a Google; la gestión de Imagine es un servicio independiente.']},
      'gestao-meta-ads':{label:'Gestión de Meta Ads',eyebrow:'Campañas en Instagram y Facebook',intro:'Planifica campañas en canales Meta con mensajes, públicos y formatos creativos relevantes.',approach:'Consideramos objetivos, audiencia, contenido creativo, página de destino y resultados observados.',details:[['Estrategia de campañas','Define objetivos y públicos relevantes.'],['Creatividad y mensajes','Revisa formatos y argumentos para tu oferta.'],['Medición','Evalúa resultados y oportunidades de mejora.']],question:['¿Instagram y Facebook son dos canales diferentes?','Ambos pertenecen al canal publicitario Meta. El alcance se confirma en la propuesta.']}
    }
  }
});
