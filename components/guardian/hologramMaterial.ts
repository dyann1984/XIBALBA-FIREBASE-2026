import * as THREE from "three";

/**
 * Material holográfico compartido por el jaguar 3D y su capa de wireframe.
 * Sin UV ni normales en el GLB de origen (ver docs/holograma-3d-jaguar.md),
 * así que el "glifo" viene de bandas de energía en función de la posición
 * del vértice, no de una textura — limitación documentada, no simulada.
 *
 * Fase 4 (Bojak): el material anterior usaba Fresnel puro + additive blending
 * como ÚNICA fuente de alpha y color, por eso el cuerpo quedaba casi
 * transparente salvo en los bordes (lectura de "esqueleto de rayos X"). Este
 * material separa ambas cosas:
 *  - Un volumen base opaco-translúcido (alpha ~0.55-0.8, blending normal, con
 *    depthWrite activado para que el cuerpo se auto-oculte como un sólido),
 *    iluminado con tres luces direccionales fijas (cian/acento, azul, dorado)
 *    en vez de un solo tono plano — esto es lo que da "detalle superficial".
 *  - Fresnel reducido a un refuerzo de contorno (suma, no reemplaza) y las
 *    bandas de escaneo como textura procedural adicional sobre ese volumen.
 *
 * El GLB sí trae `COLOR_0` (la pintura original de la pantera): las zonas
 * pintadas más claras —ojos, dientes, garras en este tipo de malla— se usan
 * como pista real para un resplandor localizado ("ojos luminosos"). Para que
 * no se encienda cualquier mancha clara (p. ej. una garra), el brillo se
 * limita además a la mitad superior del cuerpo según la caja delimitadora
 * real de la malla (uBoundsMinY/uBoundsMaxY, inspeccionada en
 * GuardianHologram3D.tsx) — nunca una coordenada fija adivinada.
 */
export function createHologramMaterial(accent: string, gold = "#f4b942", eyeColor = "#eafffb", blue = "#4f93ff") {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(accent) },
      uColorBlue: { value: new THREE.Color(blue) },
      uColorGold: { value: new THREE.Color(gold) },
      uEyeColor: { value: new THREE.Color(eyeColor) },
      uOpacity: { value: 0.92 },
      uFresnelPower: { value: 2.0 },
      uScanSpeed: { value: 0.6 },
      uBoundsMinY: { value: -1 },
      uBoundsMaxY: { value: 1 },
    },
    vertexShader: `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vNormalW;
      varying vec3 vPos;
      varying vec3 vVertexColor;
      void main() {
        vNormalV = normalize(normalMatrix * normal);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        vPos = position;
        vVertexColor = color;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uColorBlue;
      uniform vec3 uColorGold;
      uniform vec3 uEyeColor;
      uniform float uOpacity;
      uniform float uFresnelPower;
      uniform float uScanSpeed;
      uniform float uBoundsMinY;
      uniform float uBoundsMaxY;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vNormalW;
      varying vec3 vPos;
      varying vec3 vVertexColor;
      void main() {
        vec3 n = normalize(vNormalV);
        vec3 v = normalize(vViewDir);
        float facing = clamp(dot(n, v), 0.0, 1.0);
        float rim = pow(1.0 - facing, uFresnelPower);

        // Tres luces direccionales fijas (no dependen de la cámara, a
        // diferencia del Fresnel): cian/acento como luz clave, azul como
        // relleno frío, dorado como luz ceremonial desde abajo.
        vec3 keyDir = normalize(vec3(0.45, 0.65, 0.78));
        vec3 fillDir = normalize(vec3(-0.6, 0.25, -0.55));
        vec3 rimGoldDir = normalize(vec3(0.0, -0.85, 0.35));
        float diffKey = max(dot(vNormalW, keyDir), 0.0);
        float diffFill = max(dot(vNormalW, fillDir), 0.0);
        float diffGold = max(dot(vNormalW, rimGoldDir), 0.0);

        float scan = sin(vPos.y * 7.0 - uTime * uScanSpeed * 6.0) * 0.5 + 0.5;
        float band = smoothstep(0.78, 1.0, scan);

        // Pintura original clara (ojos/dientes/garras) -> punto de luz real.
        // Restringido a la mitad superior real de la malla (caja delimitadora
        // inspeccionada, no una coordenada inventada) para no encender garras.
        float heightT = clamp((vPos.y - uBoundsMinY) / max(uBoundsMaxY - uBoundsMinY, 0.0001), 0.0, 1.0);
        float upperBody = smoothstep(0.52, 0.72, heightT);
        float paintBright = smoothstep(0.62, 0.95, (vVertexColor.r + vVertexColor.g + vVertexColor.b) / 3.0);
        float brightSpot = paintBright * upperBody;

        // Volumen base: ya no depende del Fresnel para existir. El Fresnel
        // se SUMA como refuerzo de contorno, nunca reemplaza el color base.
        vec3 base = uColor * (0.22 + diffKey * 0.62) + uColorBlue * diffFill * 0.4 + uColorGold * diffGold * 0.32;
        vec3 color = base + uColor * rim * 0.55 + uColorGold * band * 0.22;
        color += uEyeColor * brightSpot * (0.75 + rim * 0.5);

        float alpha = clamp(0.52 + rim * 0.3 + band * 0.08 + brightSpot * 0.3, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function createHologramWireMaterial(accent: string) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent),
    wireframe: true,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
