import * as THREE from "three";

/**
 * Material holográfico compartido por el jaguar 3D y su capa de wireframe.
 * Sin UV ni normales en el GLB de origen (ver docs/holograma-3d-jaguar.md),
 * así que el "glifo" viene de bandas de energía en función de la posición
 * del vértice, no de una textura — limitación documentada, no simulada.
 */
export function createHologramMaterial(accent: string, gold = "#f4b942") {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(accent) },
      uColorAccent: { value: new THREE.Color(gold) },
      uOpacity: { value: 0.92 },
      uFresnelPower: { value: 2.1 },
      uScanSpeed: { value: 0.6 },
    },
    vertexShader: `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vPos;
      void main() {
        vNormalV = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        vPos = position;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uColorAccent;
      uniform float uOpacity;
      uniform float uFresnelPower;
      uniform float uScanSpeed;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vPos;
      void main() {
        vec3 n = normalize(vNormalV);
        vec3 v = normalize(vViewDir);
        float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), uFresnelPower);
        float scan = sin(vPos.y * 7.0 - uTime * uScanSpeed * 6.0) * 0.5 + 0.5;
        float band = smoothstep(0.78, 1.0, scan);
        vec3 base = mix(uColor, uColorAccent, band * 0.65);
        vec3 color = base * (0.3 + fresnel * 1.7) + uColorAccent * band * 0.35;
        float alpha = clamp(fresnel * 1.05 + band * 0.25 + 0.14, 0.0, 1.0) * uOpacity;
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
