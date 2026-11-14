export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  /**
   * Lo que el agente hace **hoy**, en el código. No se adelanta nada: si una
   * capacidad depende de un servicio externo que no está activo, se dice aquí.
   */
  works: string;
  /** Lo que todavía no puede hacer. Se muestra junto a lo anterior. */
  pending: string;
};

export const agents: Agent[] = [
  {
    id: "camazotz",
    name: "CAMAZOTZ",
    role: "Voz y llamadas",
    description: "Detecta señales sospechosas en transcripciones de llamadas.",
    icon: "voice",
    color: "purple",
    works:
      "Analiza la transcripción de una llamada con un catálogo propio de 14 señales de voz: suplantación de instituciones, extorsión, secuestro virtual, aislamiento de la víctima y petición de NIP, clave dinámica o códigos de un solo uso. Acepta un archivo de audio y comprueba su formato, tamaño y duración.",
    pending:
      "La transcripción automática del audio depende del modelo y solo se intenta con tu consentimiento; si no hay motor disponible, el estado se muestra como pendiente y no se inventa texto. No accede al micrófono, no graba y no puede saber quién llamó ni desde qué número.",
  },
  {
    id: "ixbalanque",
    name: "IXBALANQUÉ",
    role: "Mensajes y empleos",
    description: "Examina mensajes, ofertas de empleo y conversaciones.",
    icon: "message",
    color: "cyan",
    works:
      "Analiza el texto con el catálogo general de patrones de fraude y extrae los enlaces que contenga para pasarlos a HUN CAMÉ.",
    pending:
      "No consulta listas de reputación ni comprueba si un remitente existe realmente.",
  },
  {
    id: "vucub",
    name: "VUCUB CAMÉ",
    role: "Fraude financiero",
    description: "Identifica alertas en solicitudes de pago y depósitos.",
    icon: "wallet",
    color: "gold",
    works:
      "Verifica con aritmética el dígito de control de una CLABE de 18 dígitos y la suma de Luhn de una tarjeta, nombra la institución a la que corresponde el código de la CLABE, avisa cuando la cuenta no pertenece al banco que nombra el mensaje y detecta direcciones de criptomoneda. Añade 10 señales financieras: depósito a un tercero, pago irreversible, presión para transferir, rendimientos imposibles, esquemas de referidos, crédito con anticipo y petición de datos bancarios completos. Los números no se guardan completos: se muestran enmascarados.",
    pending:
      "Un número matemáticamente válido no demuestra que la cuenta sea legítima, segura ni de quien dice ser. El nombre de la institución sale de una tabla incorporada, no de una consulta a Banco de México, y es un subconjunto: un código que no esté en ella se declara no identificado. No puede comprobar a quién pertenece una cuenta, si un pago se recibió, ni si una empresa está registrada ante la CNBV o la CONDUSEF. No se conecta a ninguna cuenta bancaria.",
  },
  {
    id: "hun",
    name: "HUN CAMÉ",
    role: "Tiendas y enlaces",
    description: "Revisa señales de riesgo en ventas, tiendas y enlaces.",
    icon: "link",
    color: "blue",
    works:
      "Analiza la estructura de una URL en el dispositivo: dominio registrable, homoglifos, subdominios que imitan marcas, puertos, credenciales incrustadas y esquemas inseguros. Las auditorías de DNS y RDAP están implementadas y verificadas contra dominios públicos de referencia.",
    pending:
      "Las consultas externas de DNS y RDAP permanecen deshabilitadas para el público general. No visita el sitio, no sigue redirecciones y no consulta listas de amenazas ni certificados: una URL desconocida nunca se califica como segura.",
  },
  {
    id: "guardian",
    name: "EL GUARDIÁN",
    role: "Coordinación y riesgo",
    description: "Coordina a los agentes y presenta recomendaciones.",
    icon: "shield",
    color: "green",
    works:
      "Elige los agentes según lo que encuentra en la entrada, fusiona sus evidencias sin duplicarlas, mantiene separado lo comprobado de lo estimado, emite un solo semáforo y responde preguntas de seguimiento sobre las evidencias.",
    pending:
      "No guarda historial y no decide por ti: el semáforo orienta, no confirma un fraude ni garantiza que algo sea seguro.",
  },
];
