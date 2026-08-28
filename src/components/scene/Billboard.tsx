"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { BillboardDoc } from "@/lib/firebase/types";
import {
  drawPanelBaseTexture,
  drawPanelOverlayTexture,
} from "@/lib/panelTexture";
import { VolumetricLights } from "./VolumetricLight";

const FRAME_COLOR = "#f3e6cf";
const FRAME_COLOR_DARK = "#e4d3b3";
const PANEL_BOTTOM_Y = 0.72;

// O outdoor se ajusta à proporção real da imagem OG.
// Limitamos o range para ele não virar um quadrado gigante
// nem uma faixa fina demais.
const MIN_ASPECT = 1.1;
const MAX_ASPECT = 2.2;
const DEFAULT_ASPECT = 1024 / 608;

const MAX_PANEL_W = 4.5;
const MAX_PANEL_H = 2.9;
const MIN_PANEL_W = 3.4;

// Razões fixas para pernas/presilhas acompanharem
// proporcionalmente a largura do painel.
const LEG_X_RATIO = 1.35 / 4.5;
const CLIP_X_RATIO = 1.15 / 4.5;

function clampAspect(aspect: number) {
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
}

function computePanelSize(aspect: number) {
  let w = MAX_PANEL_W;
  let h = w / aspect;

  if (h > MAX_PANEL_H) {
    h = MAX_PANEL_H;
    w = h * aspect;
  }

  if (w < MIN_PANEL_W) {
    w = MIN_PANEL_W;
    h = w / aspect;
  }

  return { w, h };
}

function Legs({ legX }: { legX: number }) {
  const legMat = (
    <meshStandardMaterial
      color={FRAME_COLOR_DARK}
      roughness={0.55}
      metalness={0.05}
    />
  );

  return (
    <group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * legX, 0, 0]}
          rotation={[0, 0, side * -0.05]}
        >
          <mesh position={[0, PANEL_BOTTOM_Y / 2, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.13, PANEL_BOTTOM_Y, 16]} />

            {legMat}
          </mesh>

          {/* Pé cônico, tipo base de tripé */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.1, 16]} />

            {legMat}
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Billboard({
  billboard,
  isNight = false,
}: {
  billboard: BillboardDoc;
  isNight?: boolean;
}) {
  // canvases criados uma única vez via inicializador preguiçoso do
  // useState — mutar um ref durante o render (o padrão antigo aqui) não é
  // mais seguro nas regras novas do React.
  const [baseCanvas] = useState<HTMLCanvasElement | null>(() =>
    typeof document !== "undefined" ? document.createElement("canvas") : null,
  );
  const [overlayCanvas] = useState<HTMLCanvasElement | null>(() =>
    typeof document !== "undefined" ? document.createElement("canvas") : null,
  );

  const [baseTexture, setBaseTexture] = useState<THREE.CanvasTexture | null>(
    null,
  );

  const [overlayTexture, setOverlayTexture] =
    useState<THREE.CanvasTexture | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const panelGroupRef = useRef<THREE.Group>(null);

  const popRef = useRef(0);

  const imageReady = Boolean(image && image.complete && image.naturalWidth > 0);

  const aspect = clampAspect(
    imageReady ? image!.naturalWidth / image!.naturalHeight : DEFAULT_ASPECT,
  );

  const { w: panelW, h: panelH } = useMemo(
    () => computePanelSize(aspect),
    [aspect],
  );

  const canvasSize = useMemo(
    () => ({
      w: 1024,
      h: Math.round(1024 / aspect),
    }),
    [aspect],
  );

  /** Centro vertical do painel. */
  const panelCenterY = PANEL_BOTTOM_Y + panelH / 2;

  /** Altura total da moldura. */
  const frameHeight = panelH + 0.36;

  /**
   * Topo real da moldura. As luminárias acompanham automaticamente o
   * tamanho do outdoor.
   */
  const frameTopY = panelCenterY + frameHeight / 2;

  const legX = panelW * LEG_X_RATIO;

  const clipXs = useMemo(
    () => [-panelW * CLIP_X_RATIO, 0, panelW * CLIP_X_RATIO],
    [panelW],
  );

  /** Recarrega a imagem do anunciante quando a URL mudar. */
  useEffect(() => {
    if (!billboard.imageUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset síncrono e intencional: sem imageUrl não há o que buscar.
      setImage(null);
      return;
    }

    let cancelled = false;

    let objectUrl: string | null = null;

    fetch(billboard.imageUrl, {
      mode: "cors",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }

        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);

        const img = new Image();

        img.onload = () => {
          if (!cancelled) {
            setImage(img);
          }
        };

        img.onerror = () => {
          if (!cancelled) {
            setImage(null);
          }
        };

        img.src = objectUrl;
      })
      .catch(() => {
        // Sem CORS, 404, offline etc.
        // Cai para o texto sem quebrar nada.
        if (!cancelled) {
          setImage(null);
        }
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [billboard.imageUrl]);

  /** Redesenha as duas camadas do painel sempre que o anúncio atual mudar. */
  useEffect(() => {
    if (!baseCanvas || !overlayCanvas) {
      return;
    }

    const base = drawPanelBaseTexture(baseCanvas, billboard, image, canvasSize);

    const overlay = drawPanelOverlayTexture(overlayCanvas, billboard, canvasSize);

    // Pequena animação de troca de anúncio.
    popRef.current = 1;

    // sincroniza as texturas recém-desenhadas com o estado — legítimo,
    // é o próprio propósito desse effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBaseTexture((prev) => {
      prev?.dispose();
      return base;
    });

    setOverlayTexture((prev) => {
      prev?.dispose();
      return overlay;
    });
  }, [billboard, image, canvasSize, baseCanvas, overlayCanvas]);

  /** Libera as últimas texturas quando o componente desmonta. */
  useEffect(() => {
    return () => {
      baseTexture?.dispose();
      overlayTexture?.dispose();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mantém apenas a animação de pop do outdoor. */
  useFrame((_, delta) => {
    if (popRef.current > 0 && panelGroupRef.current) {
      popRef.current = Math.max(0, popRef.current - delta * 2.2);

      const s = 1 + Math.sin(popRef.current * Math.PI) * 0.035;

      panelGroupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* PERNAS */} <Legs legX={legX} />
      {/* MOLDURA */}
      <RoundedBox
        args={[panelW + 0.36, panelH + 0.36, 0.2]}
        radius={0.09}
        smoothness={4}
        position={[0, panelCenterY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={FRAME_COLOR}
          roughness={0.6}
          metalness={0.04}
        />
      </RoundedBox>
      {/* PAINEL DO ANÚNCIO */}
      <group ref={panelGroupRef} position={[0, panelCenterY, 0.115]}>
        {/* IMAGEM / FUNDO DO ANÚNCIO */}
        <mesh
          onClick={() => {
            if (billboard.linkUrl) {
              window.open(billboard.linkUrl, "_blank");
            }
          }}
          onPointerEnter={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerLeave={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <planeGeometry args={[panelW, panelH]} />

          <meshBasicMaterial
            map={baseTexture ?? undefined}
            color={baseTexture ? "#ffffff" : "#e2c393"}
            toneMapped={false}
          />
        </mesh>

        {/*
      INFORMAÇÕES DO APP

      Sempre visíveis.
      Não dependem mais de hover.
    */}
        <mesh position={[0, 0, 0.001]} raycast={() => null}>
          <planeGeometry args={[panelW, panelH]} />

          <meshBasicMaterial
            map={overlayTexture ?? undefined}
            transparent
            opacity={1}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* LUZES DO OUTDOOR */}
      <VolumetricLights
        topY={frameTopY}
        frontZ={0.1}
        active={isNight}
        fixtureX={clipXs}
      />
    </group>
  );
}
