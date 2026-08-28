"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Mesmo tom acinzentado/bege do chao (Ground.tsx usa rgb(210,203,196)),
// pra pedrinha nao destoar como se fosse outro material/terreno.
const ROCK_COLORS = ["#d6cec5", "#c9c1b6", "#e0d9d0", "#bcb3a7"];

type RockSpot = {
  x: number;
  z: number;
  size: number;
  // pedras grandes ganham uma companheira pequena do lado, tipo um
  // amontoado natural, em vez de uma pedra sozinha e perfeita.
  cluster?: boolean;
};

// Composicao espalhada pelo cenario: pedras grandes ao fundo (perto de
// onde ficariam as antenas/props distantes), medias soltas pelas
// laterais, e pequenas dando textura geral — nada grudado na grama.
const ROCKS: RockSpot[] = [
  // grandes, ao fundo
  { x: -3.75, z: -1.75, size: 0.24, cluster: true },
  { x: 3.9, z: -1.55, size: 0.27, cluster: true },
  { x: 0.2, z: -2.5, size: 0.19, cluster: true },
  { x: -1.1, z: -2.15, size: 0.15 },

  // medias, espalhadas pelas laterais
  { x: -3.1, z: 1.05, size: 0.12 },
  { x: -1.25, z: -0.85, size: 0.1 },
  { x: 1.55, z: -0.65, size: 0.11 },
  { x: 3.25, z: 1.1, size: 0.13 },
  { x: 2.5, z: 1.9, size: 0.09 },
  { x: -2.6, z: 1.85, size: 0.1 },
  { x: 1.05, z: -1.6, size: 0.1 },

  // pequenas, dando textura geral, mantendo distancia das touceiras
  { x: -2.35, z: -0.15, size: 0.06 },
  { x: -0.55, z: 0.5, size: 0.055 },
  { x: 0.75, z: 0.35, size: 0.05 },
  { x: 2.35, z: -0.1, size: 0.06 },
  { x: -1.65, z: 1.9, size: 0.055 },
  { x: 1.85, z: 1.55, size: 0.05 },
  { x: -3.4, z: -0.55, size: 0.045 },
  { x: 3.55, z: -0.4, size: 0.05 },
  { x: -0.15, z: -1.15, size: 0.045 },
];

export function Rocks() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);

  const total = useMemo(
    () => ROCKS.length + ROCKS.filter((r) => r.cluster).length,
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let i = 0;

    const placeRock = (x: number, z: number, size: number) => {
      dummy.position.set(x, size * 0.32, z);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      dummy.scale.set(
        size * (0.8 + Math.random() * 0.45),
        size * (0.55 + Math.random() * 0.3),
        size * (0.8 + Math.random() * 0.45),
      );
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
      color.set(ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)]);
      mesh.setColorAt(i, color);
      i++;
    };

    for (const rock of ROCKS) {
      const jitterX = (Math.random() - 0.5) * 0.08;
      const jitterZ = (Math.random() - 0.5) * 0.08;
      placeRock(rock.x + jitterX, rock.z + jitterZ, rock.size);

      if (rock.cluster) {
        const angle = Math.random() * Math.PI * 2;
        const dist = rock.size * 1.3;
        placeRock(
          rock.x + Math.cos(angle) * dist,
          rock.z + Math.sin(angle) * dist,
          rock.size * (0.35 + Math.random() * 0.2),
        );
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    // So castShadow: pedras pequenas e convexas recebendo sombra
    // (inclusive a propria) causavam auto-sombreamento/flicker e
    // deixavam a pedra escura mesmo com a cor clara.
    <instancedMesh ref={meshRef} args={[geometry, undefined, total]} castShadow>
      {/*
        Sem vertexColors: essa geometria (IcosahedronGeometry) nao tem
        atributo de cor por vertice, so a cor por instancia
        (instanceColor). Com vertexColors ligado o shader tambem le o
        atributo de cor do geometry, que nao existe e cai pra
        (0,0,0) — multiplicando tudo e deixando a pedra preta mesmo
        com instanceColor certo. A cor por instancia funciona sem
        precisar dessa flag.
      */}
      <meshStandardMaterial roughness={0.95} metalness={0} flatShading />
    </instancedMesh>
  );
}
