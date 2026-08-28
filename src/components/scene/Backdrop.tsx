"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * "Ceu" de fundo: uma esfera grande, vista por dentro, com um gradiente
 * vertical pintado em canvas — o mesmo tom do gradiente CSS atras do
 * Canvas (usado como fundo enquanto a cena carrega). Evita depender de
 * fundo transparente + postprocessing, que costuma dar problema de alpha.
 */
export function Backdrop({ isNight = false }: { isNight?: boolean }) {
  const texture = useMemo(() => {
    // textura equiretangular (2:1) em vez de uma tira 2px — precisamos de
    // variacao horizontal pra caber sol/lua e estrelas, nao so um degrade
    // vertical liso. Resolucao alta (2048x1024) pra as estrelas nao
    // aparecerem como blocos gigantes — a esfera e enorme (raio 45) e a
    // camera so ve uma fatia estreita dela, entao poucos texels acabam
    // cobrindo muitos pixels de tela se a textura for pequena.
    const w = 2048;
    const h = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (isNight) {
      grad.addColorStop(0, "#04050f");
      grad.addColorStop(0.4, "#080b22");
      grad.addColorStop(0.72, "#121736");
      grad.addColorStop(1, "#1c2247");
    } else {
      grad.addColorStop(0, "#fdf6e9");
      grad.addColorStop(0.42, "#f8ecd4");
      grad.addColorStop(0.78, "#efdab3");
      grad.addColorStop(1, "#e2c393");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (isNight) {
      // estrelas pequenas — confinadas bem acima do horizonte, sem chegar
      // perto da faixa que fica atras do chao. Raio minimo de ~1.1px
      // garante que sobrevivam a rasterizacao (um raio menor que isso vira
      // uma mancha quase invisivel, some no anti-aliasing do canvas).
      for (let i = 0; i < 180; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h * 0.4;
        const r = Math.random() * 1.4 + 1.1;
        ctx.globalAlpha = Math.random() * 0.5 + 0.4;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // lua com brilho suave
      const moonX = w * 0.62;
      const moonY = h * 0.16;
      const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 190);
      glow.addColorStop(0, "rgba(226,232,255,0.55)");
      glow.addColorStop(1, "rgba(226,232,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(moonX - 190, moonY - 190, 380, 380);

      ctx.fillStyle = "#f2f4ff";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 52, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // sol com brilho suave
      const sunX = w * 0.62;
      const sunY = h * 0.18;
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 260);
      glow.addColorStop(0, "rgba(255,244,214,0.9)");
      glow.addColorStop(0.4, "rgba(255,224,170,0.35)");
      glow.addColorStop(1, "rgba(255,224,170,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 260, sunY - 260, 520, 520);

      ctx.fillStyle = "#fff8e6";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 68, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [isNight]);

  return (
    <mesh renderOrder={-1000}>
      <sphereGeometry args={[45, 24, 24]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        fog={false}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}
