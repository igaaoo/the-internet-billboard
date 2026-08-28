"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

// haste que liga a moldura ao bloco de luz, e o proprio bloco inclinado
// "olhando" pra baixo — como um refletor de outdoor de verdade, montado
// acima e um pouco a frente do painel, nao rente ao chao.
const ROD_TILT = 1;
const ROD_LEN = 0.5;
const HOUSING_EXTRA_TILT = 2.6;
const HOUSING_COLOR = "#3b3a38";

// Quanto o feixe sera achatado na profundidade.
//
// 1 = cone completamente redondo
// 0.1 = camada bem fina
//
// Esse valor evita que a luz se espalhe para tras do billboard.
const BEAM_DEPTH_SCALE = 0.12;

// direcao (no mundo) que o eixo local +Y de um cilindro/objeto assume
// depois de rotacionar `tilt` radianos em torno do eixo X.
function armDirection(tilt: number): [number, number, number] {
  return [0, Math.cos(tilt), Math.sin(tilt)];
}

type BeamProps = {
  origin: [number, number, number];
  rotationX: number;
  height?: number;
  radiusTop?: number;
  radiusBottom?: number;
  depthScale?: number;
  color?: string;
  phase?: number;
  active?: boolean;
};

function useBeamGradientTexture() {
  return useMemo(() => {
    const w = 8;
    const h = 256;

    const canvas = document.createElement("canvas");

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d")!;

    // gradiente vertical do feixe
    const grad = ctx.createLinearGradient(0, h, 0, 0);

    grad.addColorStop(0, "rgba(255,255,255,0.95)");

    grad.addColorStop(0.18, "rgba(255,255,255,0.55)");

    grad.addColorStop(0.55, "rgba(255,255,255,0.18)");

    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = grad;

    ctx.fillRect(0, 0, w, h);

    const tex = new THREE.CanvasTexture(canvas);

    tex.wrapS = THREE.ClampToEdgeWrapping;

    tex.wrapT = THREE.ClampToEdgeWrapping;

    tex.colorSpace = THREE.SRGBColorSpace;

    return tex;
  }, []);
}

function Beam({
  origin,
  rotationX,
  height = 1.5,
  radiusTop = 0.85,
  radiusBottom = 0.05,
  depthScale = BEAM_DEPTH_SCALE,
  color = "#ffffff",
  phase = 0,
  active = false,
}: BeamProps) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const map = useBeamGradientTexture();

  // comeca apagado
  const activeAmountRef = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!materialRef.current) {
      return;
    }

    activeAmountRef.current +=
      ((active ? 1 : 0) - activeAmountRef.current) * Math.min(1, delta * 3);

    const t = clock.getElapsedTime();

    // flicker bem sutil
    const flicker = 0.1 + Math.sin(t * 0.6 + phase) * 0.08;

    materialRef.current.opacity = flicker * activeAmountRef.current;
  });

  // Mantemos exatamente a mesma direcao original.
  const dir = armDirection(rotationX);

  const center: [number, number, number] = [
    origin[0] + dir[0] * (height / 2),

    origin[1] + dir[1] * (height / 2),

    origin[2] + dir[2] * (height / 2),
  ];

  return (
    <mesh
      position={center}
      rotation={[rotationX, 0, 0]}
      /*
       * Achata o cone apenas no eixo Z local.
       *
       * X continua largo.
       * Y continua com o comprimento normal.
       * Z fica extremamente fino.
       *
       * Resultado:
       *
       *      X → ← largo
       *      Y ↑ ↓ comprimento
       *      Z ▌ fino
       */
      scale={[1, 1, depthScale]}
    >
      <cylinderGeometry args={[radiusTop, radiusBottom, height, 24, 1, true]} />

      <meshBasicMaterial
        ref={materialRef}
        map={map}
        color={color}
        transparent
        opacity={0.55}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// luz de verdade para iluminar a estrutura
function FixtureLight({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) {
  const lightRef = useRef<THREE.PointLight>(null);

  const activeAmountRef = useRef(0);

  useFrame((_, delta) => {
    activeAmountRef.current +=
      ((active ? 1 : 0) - activeAmountRef.current) * Math.min(1, delta * 3);

    if (lightRef.current) {
      lightRef.current.intensity = activeAmountRef.current * 2.4;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      position={position}
      color="#ffffff"
      intensity={0}
      distance={10}
      decay={2}
    />
  );
}

// bloco da luminaria
function LampHousing({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const activeAmountRef = useRef(0);

  useFrame((_, delta) => {
    activeAmountRef.current +=
      ((active ? 1 : 0) - activeAmountRef.current) * Math.min(1, delta * 3);

    if (matRef.current) {
      matRef.current.emissiveIntensity = activeAmountRef.current * 1.1;
    }
  });

  return (
    <group position={position} rotation={[ROD_TILT + HOUSING_EXTRA_TILT, 0, 0]}>
      <RoundedBox
        args={[0.24, 0.13, 0.16]}
        radius={0.025}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          ref={matRef}
          color={HOUSING_COLOR}
          roughness={0.45}
          metalness={0.35}
          emissive="#fff2d8"
          emissiveIntensity={0}
        />
      </RoundedBox>
    </group>
  );
}

function SpotFixture({
  x,
  topY,
  frontZ,
  active,
  phase,
  big,
}: {
  x: number;
  topY: number;
  frontZ: number;
  active: boolean;
  phase: number;
  big?: boolean;
}) {
  // Mantemos exatamente a direcao original.
  const dir = armDirection(ROD_TILT);

  // ponto conectado ao topo do billboard
  const anchor: [number, number, number] = [x, topY, frontZ];

  const lampPos: [number, number, number] = [
    anchor[0] + dir[0] * ROD_LEN,

    anchor[1] + dir[1] * ROD_LEN,

    anchor[2] + dir[2] * ROD_LEN,
  ];

  const rodCenter: [number, number, number] = [
    anchor[0] + dir[0] * (ROD_LEN / 2),

    anchor[1] + dir[1] * (ROD_LEN / 2),

    anchor[2] + dir[2] * (ROD_LEN / 2),
  ];

  return (
    <group>
      {/* haste conectando a moldura ao bloco */}
      <mesh position={rodCenter} rotation={[ROD_TILT, 0, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.024, ROD_LEN, 8]} />

        <meshStandardMaterial
          color={HOUSING_COLOR}
          roughness={0.5}
          metalness={0.4}
        />
      </mesh>

      <LampHousing position={lampPos} active={active} />

      {/* FEIXE ACHATADO */}
      <Beam
        origin={lampPos}
        rotationX={286}
        phase={phase}
        radiusTop={big ? 0.95 : 0.8}
        radiusBottom={0.05}
        height={2}
        depthScale={0.2}
        active={active}
      />

      <FixtureLight position={lampPos} active={active} />
    </group>
  );
}

const DEFAULT_FIXTURE_X = [-1.15, 0, 1.15];

export function VolumetricLights({
  topY = 1.9,
  frontZ = 0.1,
  active = false,
  fixtureX = DEFAULT_FIXTURE_X,
}: {
  topY?: number;
  frontZ?: number;
  active?: boolean;
  fixtureX?: number[];
}) {
  return (
    <group>
      {fixtureX.map((x, i) => (
        <SpotFixture
          key={x}
          x={x}
          topY={topY}
          frontZ={frontZ}
          phase={i * 2.1}
          big={i === 1}
          active={active}
        />
      ))}
    </group>
  );
}
