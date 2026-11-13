export type Agent = { id: string; name: string; role: string; description: string; icon: string; color: string };
export const agents: Agent[] = [
  { id: "camazotz", name: "CAMAZOTZ", role: "Voz y llamadas", description: "Detecta señales sospechosas en transcripciones de llamadas.", icon: "voice", color: "purple" },
  { id: "ixbalanque", name: "IXBALANQUÉ", role: "Mensajes y empleos", description: "Examina mensajes, ofertas de empleo y conversaciones.", icon: "message", color: "cyan" },
  { id: "vucub", name: "VUCUB CAMÉ", role: "Fraude financiero", description: "Identifica alertas en solicitudes de pago y depósitos.", icon: "wallet", color: "gold" },
  { id: "hun", name: "HUN CAMÉ", role: "Tiendas y enlaces", description: "Revisa señales de riesgo en ventas, tiendas y enlaces.", icon: "link", color: "blue" },
  { id: "guardian", name: "EL GUARDIÁN", role: "Coordinación y riesgo", description: "Coordina a los agentes y presenta recomendaciones.", icon: "shield", color: "green" },
];
