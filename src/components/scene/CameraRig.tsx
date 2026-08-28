"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const AZIMUTH_LIMIT = Math.PI * 0.14; // faixa curta — só um balanço suave
const ROTATE_SPEED = 0.22; // bem devagar

// ângulo vertical travado (min === max) — só gira pros lados. Ângulos
// rasantes de cima/baixo causavam flicker de sombra em certas posições.
const POLAR_ANGLE = Math.PI * 0.47;

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const direction = useRef(1);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // enquanto a pessoa não mexe no mouse, balança suave entre os limites
    // (em vez de girar sem parar) — inverte a direção ao bater na borda.
    const angle = controls.getAzimuthalAngle();
    if (angle >= AZIMUTH_LIMIT) direction.current = -1;
    else if (angle <= -AZIMUTH_LIMIT) direction.current = 1;

    controls.autoRotateSpeed = ROTATE_SPEED * direction.current;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom={false}
      minPolarAngle={POLAR_ANGLE}
      maxPolarAngle={POLAR_ANGLE}
      minAzimuthAngle={-AZIMUTH_LIMIT}
      maxAzimuthAngle={AZIMUTH_LIMIT}
      autoRotate
      autoRotateSpeed={ROTATE_SPEED}
      enableDamping
      dampingFactor={0.06}
      target={[0, 1.9, 0]}
    />
  );
}
