"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { BillboardDoc } from "@/lib/firebase/types";
import { useDayNight } from "@/hooks/useDayNight";
import { Billboard } from "./Billboard";
import { Ground } from "./Ground";
import { Grass } from "./Grass";
import { Rocks } from "./Rocks";
import { Backdrop } from "./Backdrop";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";

// paletas de luz/ceu pro sistema dia-noite — de noite tudo fica bem mais
// frio, escuro e com menos exposicao (luz de lua), e as luzes do outdoor
// (VolumetricLights) acendem. hemiLight liga a cor da luz ambiente as
// cores do skybox (Backdrop), pra o chao/grama reagirem de verdade.
const DAY_LIGHT = {
  bg: "#f8ecd4",
  fog: ["#efdab3", 10, 22] as const,
  exposure: 1.05,
  ambient: { color: "#ffe6c2", intensity: 0.5 },
  hemi: { sky: "#fff3da", ground: "#d9c79a", intensity: 0.45 },
  sun: { color: "#fff1da", intensity: 1.1 },
  fill: { color: "#c9d8ff", intensity: 0.25 },
};

const NIGHT_LIGHT = {
  bg: "#080b22",
  fog: ["#0a0e26", 7, 17] as const,
  exposure: 0.72,
  ambient: { color: "#2c3970", intensity: 0.1 },
  hemi: { sky: "#222c5c", ground: "#07070f", intensity: 0.28 },
  sun: { color: "#7f95d6", intensity: 0.08 },
  fill: { color: "#4d5fae", intensity: 0.14 },
};

export function BillboardScene({ billboard }: { billboard: BillboardDoc }) {
  const isNight = useDayNight();
  const light = isNight ? NIGHT_LIGHT : DAY_LIGHT;

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [0.4, 2.9, 11.8], fov: 32, near: 2, far: 30 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: light.exposure,
      }}
    >
      <color attach="background" args={[light.bg]} />
      <fog attach="fog" args={light.fog} />

      <ambientLight
        intensity={light.ambient.intensity}
        color={light.ambient.color}
      />
      <hemisphereLight
        args={[light.hemi.sky, light.hemi.ground, light.hemi.intensity]}
      />
      <directionalLight
        position={[4, 6, 4]}
        intensity={light.sun.intensity}
        color={light.sun.color}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-bias={-0.0015}
      />
      <directionalLight
        position={[-5, 3, -2]}
        intensity={light.fill.intensity}
        color={light.fill.color}
      />

      <Backdrop isNight={isNight} />

      <Suspense fallback={null}>
        <Ground isNight={isNight} />
        <Grass />
        <Rocks />
        <Billboard billboard={billboard} isNight={isNight} />
        <Effects />
      </Suspense>

      <CameraRig />
    </Canvas>
  );
}
