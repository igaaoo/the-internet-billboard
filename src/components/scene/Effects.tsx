"use client";

import {
  EffectComposer,
  Vignette,
  Noise,
  HueSaturation,
  Bloom,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <HueSaturation saturation={0.06} />
      <Vignette
        eskil={false}
        offset={0.22}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise opacity={0.012} />
      <Bloom luminanceSmoothing={0.3} />
    </EffectComposer>
  );
}
