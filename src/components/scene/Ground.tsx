"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ContactShadows } from "@react-three/drei";

/**
 * Chao quase invisivel + sombra de contato suave, so pra "grudar" o
 * billboard no chao sem competir com o fundo em gradiente do CSS.
 */
export function Ground({ isNight = false }: { isNight?: boolean }) {
  // o disco usa material unlit (nao reage as luzes da cena), entao pra ele
  // acompanhar a cena de noite precisa trocar a cor na mao. De noite o
  // disco escuro (quase igual ao fundo) ficava invisivel — trocamos por
  // uma poca de luz clara, como se fosse o brilho branco dos refletores
  // do outdoor batendo no chao, bem mais clara que o ceu ao redor.
  const diskColor = isNight ? "232,236,248" : "210,203,196";
  const diskOpacity = isNight ? 0.3 : 0.55;

  const diskTexture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    grad.addColorStop(0, `rgba(${diskColor},${diskOpacity})`);
    grad.addColorStop(0.6, `rgba(${diskColor},${diskOpacity * 0.33})`);
    grad.addColorStop(1, `rgba(${diskColor},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [diskColor, diskOpacity]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshBasicMaterial
          map={diskTexture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/*
        Plano invisivel que so aparece onde a directionalLight (o "sol")
        projeta sombra — e o que desenha a sombra de verdade do outdoor
        (moldura, pernas, grama) caindo pro chao atras dele. O disco
        acima e o ContactShadows abaixo sao decorativos e nao reagem a
        direcao da luz.
      */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.003, 0]}
        receiveShadow
      >
        <planeGeometry args={[30, 30]} />
        <shadowMaterial
          color={isNight ? "#05050f" : "#3a2a1a"}
          opacity={isNight ? 0.45 : 0.3}
          transparent
          depthWrite={false}
        />
      </mesh>
      {/*
        Blob de contato bem pequeno, so pra "grudar" a base do outdoor —
        antes cobria o cenario inteiro (scale=12) e as pedras espalhadas
        ganhavam essa sombra generica por baixo ALEM da sombra direcional
        de verdade acima, o que lia como "duas sombras" em cada pedra.
      */}
      <ContactShadows
        position={[0, 0.005, 0]}
        opacity={isNight ? 0.5 : 0.4}
        scale={3.2}
        blur={2.4}
        far={2}
        color={isNight ? "#0a0a12" : "#3a2a1a"}
      />
    </group>
  );
}
