import * as THREE from "three";

/**
 * Material holográfico compartido por el jaguar 3D y su capa de wireframe.
 * Sin UV ni normales en el GLB de origen (ver docs/holograma-3d-jaguar.md),
 * así que el "glifo" viene de bandas de energía en función de la posición
 * del vértice, no de una textura — limitación documentada, no simulada.
 *
 * El GLB sí trae `COLOR_0` (la pintura original de la pantera): las zonas
 * pintadas más claras —ojos, dientes, garras en este tipo de malla— se usan
 * como pista real para un resplandor localizado ("ojos luminosos"), en vez
 * de adivinar una coordenada 3D fija que podría no coincidir con la postura.
 */
export function createHologramMaterial(accent: string, gold = "#f4b942", eyeColor = "#eafffb") {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(accent) },
      uColorAccent: { value: new THREE.Color(gold) },
      uEyeColor: { value: new THREE.Color(eyeColor) },
      uOpacity: { value: 0.94 },
      uFresnelPower: { value: 2.0 },
      uScanSpeed: { value: 0.6 },
    },
    vertexShader: `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vPos;
      varying vec3 vVertexColor;
      void main() {
        vNormalV = normalize(normalMatrix * normal);
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
      uniform vec3 uColorAccent;
      uniform vec3 uEyeColor;
      uniform float uOpacity;
      uniform float uFresnelPower;
      uniform float uScanSpeed;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vPos;
      varying vec3 vVertexColor;
      void main() {
        vec3 n = normalize(vNormalV);
        vec3 v = normalize(vViewDir);
        float facing = clamp(dot(n, v), 0.0, 1.0);
        float rim = pow(1.0 - facing, uFresnelPower);
        float core = pow(1.0 - facing, uFresnelPower * 2.8) * 0.5;

        float scan = sin(vPos.y * 7.0 - uTime * uScanSpeed * 6.0) * 0.5 + 0.5;
        float band = smoothstep(0.78, 1.0, scan);

        // Pintura original clara (ojos/dientes/garras) -> punto de luz real,
        // no decorativo: su brillo depende del propio dato del modelo.
        float brightSpot = smoothstep(0.62, 0.95, (vVertexColor.r + vVertexColor.g + vVertexColor.b) / 3.0);

        vec3 base = mix(uColor, uColorAccent, band * 0.6);
        vec3 color = base * (0.28 + rim * 1.6 + core) + uColorAccent * band * 0.3;
        color += uEyeColor * brightSpot * (0.6 + rim * 0.8);

        float alpha = clamp(rim * 1.0 + core * 0.6 + band * 0.22 + brightSpot * 0.5 + 0.12, 0.0, 1.0) * uOpacity;
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
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
