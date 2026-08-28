"use client";

import { useEffect, useState } from "react";

function computeIsNight(date: Date) {
  const hour = date.getHours();
  return hour < 6 || hour >= 18;
}

// pra testar o visual noturno sem esperar o relogio virar: ?tod=night ou
// ?tod=day na URL forca o modo, ignorando a hora real.
function readForcedOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  const tod = new URLSearchParams(window.location.search).get("tod");
  if (tod === "night") return true;
  if (tod === "day") return false;
  return null;
}

// Le o horario local do dispositivo do usuario e diz se e "noite" (18h-6h).
// Reavalia a cada minuto pra a cena virar dia/noite sozinha se a aba ficar
// aberta atravessando o horario de transicao.
export function useDayNight() {
  const [isNight, setIsNight] = useState(
    () => readForcedOverride() ?? computeIsNight(new Date()),
  );

  useEffect(() => {
    if (readForcedOverride() !== null) {
      // já veio certo do inicializador do useState acima — sem relógio
      // pra reavaliar enquanto o override estiver forçado.
      return;
    }
    const id = setInterval(() => {
      setIsNight(computeIsNight(new Date()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return isNight;
}
