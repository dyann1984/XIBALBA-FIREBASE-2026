// Catálogo de señales financieras (VUCUB CAMÉ).
//
// Complementa `contentPatterns` y las comprobaciones aritméticas de
// `finance.ts`. Aquí van los patrones de depósito, crédito e inversión que no
// se pueden validar con un cálculo.
//
// Lo que NO está aquí, a propósito:
//   · Afirmar que una empresa no está registrada ante la CNBV o la CONDUSEF.
//     Eso exige consultar su padrón, no está implementado, e inventarlo sería
//     fabricar un dato. Se recomienda a la persona consultarlo, con el nombre
//     del padrón, y nada más.
//   · Cualquier conclusión sobre si un comprobante fue editado.

import type { ContentPattern } from './patterns.ts';

export const financePatterns: ContentPattern[] = [
  // --- Depósitos ----------------------------------------------------------
  {
    id: 'fin-deposito-cuenta-tercero',
    label: 'Pide depositar a una cuenta personal en nombre de una empresa',
    category: 'financiero',
    severity: 'alto',
    all: [/\b(deposit\w*|transfier\w*|transferir|abon\w*|pag\w*)\b/],
    any: [
      /\b(cuenta|clabe|tarjeta)\b[^.;!?\n]{0,40}\b(a nombre de|titular)\b[^.;!?\n]{0,40}\b(mi|un|una|el|la)\b[^.;!?\n]{0,25}\b(hermano|hermana|primo|prima|socio|socia|esposa|esposo|empleado|contador|familiar|amigo)\b/,
      /\b(la cuenta (esta|va) a nombre de|aparece a nombre de otra persona|no te preocupes por el nombre)\b/,
    ],
    evidence:
      'El texto pide pagar a una cuenta cuyo titular es una persona distinta de quien vende o cobra.',
    recommendation:
      'Si compras a una empresa, el pago va a nombre de la empresa. Una cuenta personal impide reclamar y es el patrón habitual de la tienda falsa.',
    limitation:
      'Hay negocios pequeños y vendedores legítimos que cobran así. Es señal de alerta, no prueba de fraude.',
  },
  {
    id: 'fin-pago-irreversible-exigido',
    label: 'Exige un medio de pago irreversible',
    category: 'financiero',
    severity: 'alto',
    any: [
      /\b(solo|unicamente|exclusivamente|tiene que ser|debe ser)\b[^.;!?\n]{0,35}\b(tarjeta[s]? de regalo|gift ?card|codigo[s]? de (itunes|google play|steam|amazon)|tiempo aire|recarga telefonica|saldo|oxxo|deposito en efectivo|bitcoin|criptomoneda|usdt)\b/,
      /\b(pag\w*|deposit\w*)\b[^.;!?\n]{0,30}\b(con|en|mediante|por)\b[^.;!?\n]{0,20}\b(tarjeta[s]? de regalo|gift ?card|tiempo aire|criptomoneda|bitcoin|usdt)\b/,
    ],
    evidence: 'El texto exige pagar por un medio que no admite reclamación ni devolución.',
    recommendation:
      'Tarjetas de regalo, tiempo aire y criptomonedas no tienen marcha atrás ni intermediario a quien reclamar. Ninguna institución cobra así.',
    limitation:
      'Algunos servicios legítimos aceptan estos medios; el indicio está en que sea el único aceptado.',
  },
  {
    id: 'fin-presion-transferir',
    label: 'Presión para transferir el dinero de inmediato',
    category: 'financiero',
    severity: 'medio',
    all: [/\b(transfier\w*|transferir|deposit\w*|envi\w* el dinero|mueve\w* el dinero|pag\w*)\b/],
    any: [
      /\b(ahora|ya|inmediatamente|de inmediato|en este momento|antes de que|cuanto antes|hoy mismo)\b/,
      /\b(mientras (hablamos|estamos)|sin colgar|en la linea)\b/,
      /\b(cuenta (segura|espejo|de resguardo|de proteccion)|resguardar (tu|su) dinero|proteger (tus|sus) fondos)\b/,
    ],
    evidence: 'El texto presiona para mover dinero de inmediato.',
    recommendation:
      'No existen las «cuentas seguras» ni las «cuentas espejo»: nadie te pide mover tu dinero para protegerlo. Detente y verifica por el canal oficial.',
    limitation:
      'La urgencia aparece también en cobros legítimos. Pesa cuando se combina con una cuenta que no puedes verificar.',
  },

  // --- Inversión y crédito -----------------------------------------------
  {
    id: 'fin-rendimiento-cifra',
    label: 'Rendimiento garantizado con cifra concreta',
    category: 'financiero',
    severity: 'alto',
    any: [
      /\b(garantiz\w*|asegurad\w*|seguro|sin riesgo|cero riesgo|100 ?% seguro)\b[^.;!?\n]{0,45}\b(\d{1,4}\s?%|\d{1,3}\s?por ciento|rendimiento|ganancia|utilidad|retorno)\b/,
      /\b(\d{1,4}\s?%|\d{1,3}\s?por ciento)\b[^.;!?\n]{0,35}\b(diario|diarios|semanal|semanales|mensual|mensuales|al mes|a la semana|al dia)\b/,
      /\b(duplic\w*|triplic\w*|multiplic\w*)\b[^.;!?\n]{0,30}\b(tu|su)\b[^.;!?\n]{0,20}\b(dinero|inversion|capital)\b/,
    ],
    evidence: 'El texto promete un rendimiento garantizado o una cifra de ganancia concreta.',
    recommendation:
      'Ninguna inversión legítima garantiza rendimientos: por ley deben advertir del riesgo. Una cifra garantizada es la señal más clara de un esquema fraudulento.',
    limitation:
      'Un instrumento de renta fija sí ofrece una tasa conocida, pero se expresa como tasa anual y con riesgo declarado, no como ganancia garantizada.',
  },
  {
    id: 'fin-estructura-referidos',
    label: 'Ganancia por reclutar a otras personas',
    category: 'financiero',
    severity: 'alto',
    any: [
      /\b(invita|invitas|refiere|refieres|recluta|reclutas|trae|traes)\b[^.;!?\n]{0,40}\b(amigos|personas|gente|conocidos|familiares|miembros)\b[^.;!?\n]{0,40}\b(gana\w*|cobra\w*|recib\w*|comision|bono)\b/,
      /\b(por cada (persona|referido|invitado|miembro))\b[^.;!?\n]{0,30}\b(gana\w*|recib\w*|te damos|comision)\b/,
      /\b(red de (mercadeo|referidos)|multinivel|piramide|matriz de (ganancia|inversion))\b/,
    ],
    evidence: 'El texto condiciona la ganancia a reclutar a otras personas.',
    recommendation:
      'Si el dinero viene de quienes entran después y no de una actividad real, es un esquema piramidal: colapsa siempre y los últimos lo pierden todo.',
    limitation:
      'Existen programas de referidos legítimos como complemento; la señal está en que el reclutamiento sea la fuente de la ganancia.',
  },
  {
    id: 'fin-regulado-sin-registro',
    label: 'Afirma estar regulado sin dar registro verificable',
    category: 'financiero',
    severity: 'medio',
    any: [
      /\b(regulad\w*|autorizad\w*|supervisad\w*|avalad\w*|certificad\w*|registrad\w*)\b[^.;!?\n]{0,35}\b(cnbv|condusef|banxico|banco de mexico|shcp|sat|gobierno)\b/,
      /\b(empresa|institucion|plataforma|fintech)\b[^.;!?\n]{0,30}\b(100 ?% )?(legal|legalmente constituida|regulada)\b/,
    ],
    evidence: 'El texto afirma estar regulado o autorizado por una autoridad financiera.',
    recommendation:
      'Compruébalo tú: el registro se consulta en el padrón público de la CNBV y en el SIPRES de la CONDUSEF. Esta herramienta no consultó ningún padrón y no puede confirmarlo ni desmentirlo.',
    limitation:
      'La afirmación puede ser cierta. Aquí solo se detecta que se afirma, no si es verdad: el padrón no se consultó.',
  },
  {
    id: 'fin-credito-con-anticipo',
    label: 'Oferta de crédito que exige un pago previo',
    category: 'financiero',
    severity: 'alto',
    all: [/\b(credito|prestamo|financiamiento|linea de credito)\b/],
    any: [
      /\b(sin (consultar|revisar) (el )?buro|sin buro|no importa (tu|su) buro|aunque estes en buro)\b/,
      /\b(deposit\w*|pag\w*|cubr\w*|envi\w*)\b[^.;!?\n]{0,45}\b(apertura|aval|seguro|poliza|gastos de (investigacion|administracion|apertura)|primera (mensualidad|cuota)|comision)\b/,
      /\b(preautorizad\w*|aprobad\w* (ya|automaticamente)|sin requisitos|sin checar)\b/,
    ],
    evidence: 'El texto ofrece un crédito y condiciona su entrega a un pago, depósito o comisión previa.',
    recommendation:
      'Una institución legítima descuenta sus comisiones del crédito; nunca te pide depositar antes de recibirlo. Y ninguna otorga crédito sin revisar tu historial.',
    limitation:
      'Existen comisiones de apertura legítimas, pero se cobran del crédito entregado, no por adelantado.',
  },
  {
    id: 'fin-cupo-limitado-inversion',
    label: 'Cupo limitado o cierre inminente de la oportunidad',
    category: 'financiero',
    severity: 'medio',
    all: [/\b(invers\w*|invertir|rendimiento|crypto|criptomoneda|trading|forex|fondo)\b/],
    any: [
      /\b(ultimos? (lugares|cupos|espacios)|cupo limitado|solo (hoy|por hoy)|cierra (hoy|esta noche|manana)|quedan \d{1,2} (lugares|cupos))\b/,
      /\b(no le digas a nadie|informacion privilegiada|dato confidencial|solo para pocos)\b/,
    ],
    evidence: 'El texto presenta la oportunidad de inversión como limitada o a punto de cerrar.',
    recommendation:
      'La escasez artificial sirve para que inviertas sin analizar. Una oportunidad real sigue ahí mañana.',
    limitation: 'Hay ofertas comerciales legítimas con plazo. Por sí sola es una señal débil.',
  },

  // --- Comprobantes -------------------------------------------------------
  {
    id: 'fin-comprobante-como-prueba',
    label: 'Presenta un comprobante como prueba de pago',
    category: 'financiero',
    severity: 'medio',
    any: [
      /\b(te (envio|mando|paso|comparto)|aqui (esta|va|te dejo)|adjunto|ya te)\b[^.;!?\n]{0,30}\b(el )?(comprobante|voucher|ficha de deposito|captura del pago|recibo|transferencia)\b/,
      /\b(ya (te )?(deposite|transferi|pague|hice el pago|realice la transferencia))\b/,
    ],
    evidence: 'El texto afirma haber pagado y presenta o anuncia un comprobante.',
    recommendation:
      'No tomes un comprobante como pago recibido. Confirma el abono en tu propia cuenta, en tu aplicación bancaria, antes de entregar nada.',
    limitation:
      'Esta herramienta no puede verificar si la transferencia ocurrió, ni si el comprobante es auténtico. Solo detecta que se afirma.',
  },
  {
    id: 'fin-solicita-datos-bancarios-completos',
    label: 'Pide los datos completos de una tarjeta',
    category: 'credenciales',
    severity: 'critico',
    any: [
      /\b(los (16|dieciseis) digitos|numero completo de (la|tu|su) tarjeta)\b/,
      /\b(tarjeta)\b[^.;!?\n]{0,50}\b(fecha de (vencimiento|expiracion)|cvv|codigo de seguridad|los (3|tres) digitos (de atras|del reverso))\b/,
      /\b(foto|fotografia|imagen|captura)\b[^.;!?\n]{0,30}\b(de (tu|su) tarjeta|por ambos lados|del frente y reverso)\b/,
    ],
    evidence: 'El texto solicita el número completo de la tarjeta, su vigencia, el código de seguridad o una fotografía de ella.',
    recommendation:
      'Con esos tres datos se puede comprar en tu nombre. Nadie legítimo los necesita juntos, y menos en una fotografía.',
    limitation:
      'Un comercio legítimo pide estos datos en su propia pasarela de pago cifrada, nunca por mensaje ni por teléfono.',
  },
];
