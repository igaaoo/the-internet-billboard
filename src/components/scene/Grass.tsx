"use client";

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";

type Clump = {
  x: number;
  z: number;
  count: number;
  spread: number;
  scale: number;
};

// Touceiras compactas — folhas nascem juntas de um mesmo centro e
// abrem em leque pra fora, como agave/yucca, e nao pra dentro.
const CLUMPS: Clump[] = [
  { x: -2.05, z: 0.55, count: 10, spread: 0.13, scale: 0.5 },
  { x: 0.05, z: 1.35, count: 7, spread: 0.12, scale: 0.48 },
  { x: 2.1, z: 0.65, count: 10, spread: 0.13, scale: 0.5 },
];

const BLADE_COLORS = ["#7f9257", "#8ea565", "#6e814a", "#889c5c"];

const BLADE_HEIGHT = 1.0;
const BLADE_SEGMENTS = 5;
const BLADE_BASE_WIDTH = 0.12;
const BLADE_CURVE = 0.22;

function buildBladeGeometry() {
  // Folha larga e encorpada (nao uma agulha fina): afunila aos poucos,
  // com uma leve barriga no meio pra dar volume, e fecha num bico
  // arredondado/rombudo em vez de um ponto agudo.
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseShade = new THREE.Color(0.55, 0.58, 0.5);
  const tipShade = new THREE.Color(1, 1, 1);
  const mixed = new THREE.Color();

  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS;
    const y = t * BLADE_HEIGHT;
    const curve = BLADE_CURVE * t * t;
    const bulge = 1 + 0.18 * Math.sin(Math.PI * t);
    const width = BLADE_BASE_WIDTH * (1 - 0.62 * t) * bulge;

    positions.push(-width, y, curve, width, y, curve);

    mixed.copy(baseShade).lerp(tipShade, t);
    colors.push(mixed.r, mixed.g, mixed.b, mixed.r, mixed.g, mixed.b);
  }

  for (let i = 0; i < BLADE_SEGMENTS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  // Bico rombudo: como a ultima faixa ja termina com largura > 0, o
  // fechamento vira uma pontinha curta e arredondada, nao uma agulha.
  const tipIndex = positions.length / 3;
  positions.push(0, BLADE_HEIGHT + 0.05, BLADE_CURVE * 1.08);
  mixed.copy(tipShade);
  colors.push(mixed.r, mixed.g, mixed.b);

  const lastA = BLADE_SEGMENTS * 2;
  const lastB = lastA + 1;
  indices.push(lastA, tipIndex, lastB);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function Grass() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => buildBladeGeometry(), []);

  const total = useMemo(() => CLUMPS.reduce((sum, c) => sum + c.count, 0), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let i = 0;

    for (const clump of CLUMPS) {
      for (let b = 0; b < clump.count; b++) {
        const angle =
          (b / clump.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const radius = Math.random() * clump.spread;
        const x = clump.x + Math.cos(angle) * radius;
        const z = clump.z + Math.sin(angle) * radius;

        // A folha "nasce" reta pra cima e a curva/dobra dela aponta em
        // +Z local. Inclinamos primeiro em torno do eixo local X
        // (lean, abre a folha) e SO DEPOIS giramos em Y pelo angulo da
        // touceira (rotY) — por isso a ordem "YXZ" abaixo. Se a
        // inclinacao fosse aplicada depois do giro em Y (ordem padrao
        // "XYZ"), toda folha se inclinaria sempre pro mesmo lado do
        // mundo, nao pra fora da touceira — era isso que fazia a grama
        // parecer "convergindo" pro centro em vez de abrir em leque.
        const rotY = Math.PI / 2 - angle;
        const lean = 0.14 + Math.random() * 0.24;
        const twist = (Math.random() - 0.5) * 0.15;

        const height = clump.scale * (0.82 + Math.random() * 0.4);
        const width = 0.8 + Math.random() * 0.3;

        dummy.position.set(x, 0, z);
        dummy.rotation.set(lean, rotY, twist, "YXZ");
        dummy.scale.set(width, height, width);
        dummy.updateMatrix();

        mesh.setMatrixAt(i, dummy.matrix);
        color.set(BLADE_COLORS[Math.floor(Math.random() * BLADE_COLORS.length)]);
        mesh.setColorAt(i, color);
        i++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, total]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.8}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
