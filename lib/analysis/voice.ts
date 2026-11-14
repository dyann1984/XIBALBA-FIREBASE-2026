// Catálogo de señales propias de una llamada (CAMAZOTZ).
//
// Complementa `contentPatterns`, no lo sustituye: una transcripción se analiza
// con los dos catálogos. Los patrones de aquí son los que solo tienen sentido
// hablando por teléfono — aislar a la víctima, pasar la llamada a «seguridad»,
// pedir que instale una aplicación mientras habla.
//
// Reutiliza el mismo contrato `ContentPattern`, así que el motor de auditoría
// no cambia: solo recorre un catálogo más.
//
// Cada patrón describe una propiedad observable del texto. Ninguno concluye
// que la llamada sea un fraude, y todos declaran su limitación.

import type { ContentPattern } from './patterns.ts';

const INSTITUTION =
  '(banco|banca|bancomer|bbva|banamex|citibanamex|santander|banorte|hsbc|scotiabank|azteca|nu|nubank|mercado pago|' +
  'sat|cfe|telmex|infonavit|imss|issste|fonacot|condusef|buro de credito|fiscalia|policia|ministerio publico)';

const CALLER =
  '(le (habla|llama)|te (habla|llama)|hablo|llamo|soy|me comunico|nos comunicamos|esta es una llamada)';

export const voicePatterns: ContentPattern[] = [
  // --- Suplantación institucional ----------------------------------------
  {
    id: 'voz-suplantacion-institucion',
    label: 'Quien llama dice representar a una institución',
    category: 'phishing',
    severity: 'medio',
    any: [
      new RegExp(`\\b${CALLER}\\b[^.;!?\\n]{0,40}\\b(de|del|de la)\\b[^.;!?\\n]{0,25}\\b${INSTITUTION}\\b`),
      new RegExp(`\\b(departamento|area|equipo|unidad|centro)\\b[^.;!?\\n]{0,30}\\b(de)\\b[^.;!?\\n]{0,20}\\b(seguridad|antifraude|fraudes|prevencion|verificacion)\\b`),
    ],
    evidence:
      'Quien llama se presenta como representante de una institución o de un área de seguridad.',
    recommendation:
      'Cuelga y marca tú al número oficial que aparece en tu tarjeta, tu recibo o el sitio de la institución. Nunca al número que te den en la llamada.',
    limitation:
      'Las instituciones también llaman de verdad. Lo que distingue al fraude es lo que pide después, no cómo se presenta.',
  },
  {
    id: 'voz-asistencia-remota',
    label: 'Pide instalar una aplicación de control remoto',
    category: 'credenciales',
    severity: 'critico',
    any: [
      /\b(instala\w*|descarga\w*|baja\w*|abre\w*)\b[^.;!?\n]{0,50}\b(anydesk|teamviewer|quick ?support|rustdesk|alpemix|airdroid|escritorio remoto|acceso remoto|control remoto|asistencia remota)\b/,
      /\b(comparte|comparta|permite|permitame|dame acceso)\b[^.;!?\n]{0,30}\b(tu|su)\b[^.;!?\n]{0,20}\b(pantalla|telefono|celular|computadora|dispositivo)\b/,
    ],
    evidence:
      'La llamada pide instalar una aplicación de control remoto o compartir la pantalla del dispositivo.',
    recommendation:
      'No la instales. Quien controla tu pantalla puede ver tus claves y mover tu dinero mientras hablas contigo. Ninguna institución legítima lo pide.',
    limitation:
      'El soporte técnico de un servicio contratado por ti sí puede usar estas herramientas; la diferencia es que la llamada la iniciaste tú.',
  },
  {
    id: 'voz-transferir-ejecutivo',
    label: 'Ofrece transferir la llamada a otra área',
    category: 'canal',
    severity: 'medio',
    any: [
      /\b(le|te)\b[^.;!?\n]{0,15}\b(transfier\w*|comunic\w*|pas\w*|deriv\w*|canaliz\w*)\b[^.;!?\n]{0,40}\b(ejecutivo|supervisor|especialista|area|departamento|licenciado|agente)\b/,
      /\bno cuelgue\b[^.;!?\n]{0,40}\b(transfer|comunic|pas)\w*/,
    ],
    evidence: 'La llamada propone transferirte a un ejecutivo, supervisor o área especializada.',
    recommendation:
      'La transferencia sirve para dar apariencia de estructura. Cuelga y verifica por el canal oficial antes de continuar.',
    limitation:
      'Es una práctica normal en centros de atención legítimos. Solo cuenta junto con otras señales.',
  },

  // --- Aislamiento y extorsión -------------------------------------------
  {
    id: 'voz-no-cuelgues',
    label: 'Exige no colgar o no avisar a nadie',
    category: 'extorsion',
    severity: 'critico',
    any: [
      /\bno\b[^.;!?\n]{0,12}\b(cuelgue|cuelgues|corte|cortes|termine|termines)\b/,
      /\bno\b[^.;!?\n]{0,20}\b(le |les )?(avise|avises|digas|diga|comentes|comente|hables|hable)\b[^.;!?\n]{0,30}\b(a nadie|con nadie|a tu familia|a la policia|a las autoridades|al banco)\b/,
      /\b(mantente|mantengase|quedate|quedese|sigue|siga)\b[^.;!?\n]{0,20}\b(en la linea|al telefono|en linea)\b/,
      /\bmantener la linea abierta\b/,
    ],
    evidence:
      'La llamada exige mantener la línea abierta o no avisar a nadie, lo que impide verificar lo que se afirma.',
    recommendation:
      'Esta es la señal más constante del fraude telefónico y la única cuya finalidad es impedirte comprobar. Cuelga y llama tú a quien dicen ser.',
    limitation:
      'Un operador legítimo puede pedir que no cuelgues por motivos de proceso, pero nunca que no avises a nadie.',
  },
  {
    id: 'voz-familiar-retenido',
    label: 'Afirma tener retenido a un familiar',
    category: 'extorsion',
    severity: 'critico',
    any: [
      /\b(tenemos|tengo|esta|tienen)\b[^.;!?\n]{0,30}\b(a tu|a su|al|a la)\b[^.;!?\n]{0,30}\b(hijo|hija|hermano|hermana|madre|padre|mama|papa|esposo|esposa|familiar|sobrino|sobrina|nieto|nieta)\b/,
      /\b(secuestr\w*|levant\w*|detenid\w*|retenid\w*|privad\w* de (su|la) libertad)\b/,
      /\b(si (quieres|quiere) (volver a )?(verlo|verla|escucharlo|escucharla))\b/,
    ],
    evidence: 'La llamada afirma tener retenido o detenido a un familiar.',
    recommendation:
      'Es el patrón del secuestro virtual. Cuelga e intenta contactar directamente a esa persona por otro teléfono. En la mayoría de los casos está bien y nunca estuvo en peligro.',
    limitation:
      'La coincidencia es textual. No determina si la afirmación es cierta, y en una emergencia real la verificación directa sigue siendo el primer paso.',
  },
  {
    id: 'voz-amenaza-dano',
    label: 'Amenaza con daño físico',
    category: 'extorsion',
    severity: 'critico',
    any: [
      /\b(le|te|les|los|las)\b[^.;!?\n]{0,20}\b(vamos a|voy a|van a)\b[^.;!?\n]{0,25}\b(matar|lastimar|golpear|cortar|hacer dano|romper)\b/,
      /\b(sabemos|se|conocemos)\b[^.;!?\n]{0,20}\b(donde (vives|vive|trabajas|trabaja)|tu direccion|su direccion|tu domicilio)\b/,
      /\b(vamos por|van por|ya vamos)\b[^.;!?\n]{0,20}\b(ti|usted|tu familia)\b/,
    ],
    evidence: 'La llamada contiene una amenaza de daño físico o menciona conocer el domicilio.',
    recommendation:
      'No negocies ni pagues. Cuelga, resguárdate y denuncia. Los datos personales que mencionan suelen provenir de una filtración, no de una vigilancia real.',
    limitation:
      'La coincidencia es textual y no mide la capacidad real de quien amenaza.',
  },
  {
    id: 'voz-deposito-dictado',
    label: 'Dicta una cuenta para depositar durante la llamada',
    category: 'financiero',
    severity: 'alto',
    any: [
      /\b(deposit\w*|transfier\w*|transferir|abon\w*|envi\w*)\b[^.;!?\n]{0,50}\b(a (la |esta )?cuenta|a (la |esta )?clabe|al numero de cuenta|a esta tarjeta)\b/,
      /\b(te|le)\b[^.;!?\n]{0,15}\b(dicto|doy|paso|comparto)\b[^.;!?\n]{0,30}\b(la cuenta|la clabe|el numero de cuenta|los datos de la cuenta)\b/,
      /\b(apunta|apunte|anota|anote)\b[^.;!?\n]{0,25}\b(la (cuenta|clabe)|estos datos|este numero)\b/,
    ],
    evidence: 'La llamada dicta datos de una cuenta para que hagas un depósito o transferencia.',
    recommendation:
      'Una transferencia a una cuenta dictada por teléfono es prácticamente irrecuperable. No la hagas sin verificar por el canal oficial de la institución.',
    limitation:
      'También ocurre en cobros legítimos entre particulares. El riesgo está en no poder verificar a quién pertenece la cuenta.',
  },

  // --- Presión y credibilidad --------------------------------------------
  {
    id: 'voz-cargo-no-reconocido',
    label: 'Anuncia un cargo no reconocido o una compra sospechosa',
    category: 'phishing',
    severity: 'medio',
    any: [
      /\b(cargo|compra|movimiento|transaccion|retiro|disposicion)\b[^.;!?\n]{0,30}\b(no reconocid\w*|sospechos\w*|inusual|no autorizad\w*|irregular)\b/,
      /\b(detectamos|identificamos|registramos|se detecto)\b[^.;!?\n]{0,40}\b(cargo|compra|movimiento|intento|actividad)\b/,
    ],
    evidence: 'La llamada anuncia un cargo o movimiento no reconocido en tu cuenta.',
    recommendation:
      'Es la apertura más común del fraude telefónico bancario. No confirmes ni niegues nada: cuelga y revisa tu cuenta en la aplicación oficial o llamando al número de tu tarjeta.',
    limitation:
      'Los bancos sí avisan de cargos sospechosos. La diferencia es que un banco real nunca te pide el NIP, la clave dinámica ni el código que te llega por mensaje.',
  },
  {
    id: 'voz-verificacion-identidad',
    label: 'Pide verificar tu identidad entregando datos completos',
    category: 'credenciales',
    severity: 'alto',
    any: [
      /\b(para (poder )?(verificar|validar|confirmar|corroborar))\b[^.;!?\n]{0,40}\b(identidad|titularidad|sus datos|tus datos)\b/,
      /\b(confirm\w*|verific\w*|valid\w*)\b[^.;!?\n]{0,40}\b(los (16|dieciseis) digitos|numero completo de (su|tu) tarjeta|fecha de vencimiento|los tres digitos|codigo de seguridad)\b/,
    ],
    evidence: 'La llamada pide datos completos de identificación o de la tarjeta para «verificar».',
    recommendation:
      'Quien te llama de verdad desde tu banco ya tiene tus datos: no necesita que se los dictes. Si te los pide, no es tu banco.',
    limitation:
      'Un centro de atención legítimo puede pedir datos parciales de identificación, nunca el número completo, la fecha y el código de seguridad.',
  },
  {
    id: 'voz-urgencia-llamada',
    label: 'Presión para actuar durante la llamada',
    category: 'phishing',
    severity: 'medio',
    any: [
      /\b(tiene|tienes|dispone|disponemos)\b[^.;!?\n]{0,25}\b(\d{1,3}\s*(minutos|segundos|horas)|poco tiempo)\b/,
      /\b(ahora mismo|en este momento|de inmediato|inmediatamente|en seguida)\b[^.;!?\n]{0,40}\b(debe|debes|tiene que|tienes que|hay que|es necesario)\b/,
      /\b(si no|de lo contrario)\b[^.;!?\n]{0,40}\b(se (bloquea|bloqueara|cancela|cancelara|perdera|suspende)|perdera|perderas|no podremos)\b/,
    ],
    evidence: 'La llamada impone un plazo inmediato para decidir o actuar.',
    recommendation:
      'La urgencia existe para que no te detengas a verificar. Ningún trámite legítimo se pierde por colgar y volver a llamar al número oficial.',
    limitation:
      'Hay avisos legítimos con plazo. La señal pesa cuando aparece junto con una petición de datos o de dinero.',
  },
  {
    id: 'voz-datos-personales-credibilidad',
    label: 'Menciona datos personales para generar confianza',
    category: 'phishing',
    severity: 'medio',
    any: [
      /\b(tenemos|contamos con|aparece|me aparece|en el sistema)\b[^.;!?\n]{0,30}\b(sus datos|tus datos|su nombre completo|tu nombre completo|su curp|su rfc|los ultimos (4|cuatro) digitos)\b/,
      /\b(para (demostrarle|demostrarte|que vea|que veas) que (es|soy) (real|verdad|legitimo))\b/,
    ],
    evidence: 'La llamada recita datos personales tuyos como prueba de legitimidad.',
    recommendation:
      'Conocer tus datos no acredita a nadie: circulan en filtraciones y bases vendidas. No lo tomes como prueba de que la llamada sea real.',
    limitation:
      'Un operador legítimo también confirma datos. La señal está en usarlos como argumento de credibilidad.',
  },
  {
    id: 'voz-premio-telefonico',
    label: 'Anuncia un premio por teléfono',
    category: 'tienda',
    severity: 'alto',
    any: [
      /\b(gano|ganaste|ha ganado|has ganado|es (el|la) ganador\w*|fue seleccionad\w*|salio favorecid\w*)\b/,
      /\b(premio|sorteo|rifa|promocion)\b[^.;!?\n]{0,40}\b(felicidades|enhorabuena|le informamos|te informamos)\b/,
    ],
    evidence: 'La llamada anuncia un premio, sorteo o selección que no solicitaste.',
    recommendation:
      'No participaste, no hay premio. Si además piden un pago o tus datos para «liberarlo», es fraude.',
    limitation: 'Existen promociones legítimas; ninguna exige pagar por adelantado para cobrar.',
  },
  {
    id: 'voz-cobranza-amenazante',
    label: 'Cobranza con amenaza de acción legal inmediata',
    category: 'extorsion',
    severity: 'alto',
    any: [
      /\b(embargo|embargar|demanda|demandar|orden de (aprehension|arresto)|buro de credito|carpeta de investigacion)\b[^.;!?\n]{0,50}\b(hoy|inmediato|inmediatamente|en (\d{1,2}) (horas|minutos)|si no paga|si no pagas)\b/,
      /\b(gestor|despacho|abogado|licenciado)\b[^.;!?\n]{0,40}\b(cobranza|juridico|extrajudicial)\b/,
    ],
    evidence: 'La llamada amenaza con embargo, demanda o detención inmediata por un adeudo.',
    recommendation:
      'La cobranza legítima no amenaza con detención ni embarga por teléfono. Pide el número de expediente por escrito y verifica con la institución acreedora.',
    limitation:
      'Puede existir un adeudo real. Lo que no es legítimo es la amenaza inmediata y la exigencia de pago en la misma llamada.',
  },
  {
    id: 'voz-numero-no-verificable',
    label: 'Se niega a dar datos verificables',
    category: 'canal',
    severity: 'medio',
    any: [
      /\bno (puedo|podemos|le puedo|te puedo)\b[^.;!?\n]{0,30}\b(dar|proporcionar|compartir)\b[^.;!?\n]{0,30}\b(mi (numero|nombre)|el numero|un numero|folio|expediente|extension)\b/,
      /\bno\b[^.;!?\n]{0,15}\b(llame|llames|marque|marques)\b[^.;!?\n]{0,30}\b(al banco|a la sucursal|al numero de (la tarjeta|atencion))\b/,
    ],
    evidence: 'La llamada se niega a dar un dato que permita verificarla, o pide no llamar a la institución.',
    recommendation:
      'Una llamada legítima resiste la verificación. Si te piden no comprobarla, ya tienes la respuesta.',
    limitation: 'Algunos operadores legítimos no dan datos personales propios por política interna.',
  },
];
