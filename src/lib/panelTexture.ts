import * as THREE from "three";
import type { BillboardDoc } from "@/lib/firebase/types";

const DEFAULT_CANVAS_W = 1024;
const DEFAULT_CANVAS_H = 608;

export type CanvasSize = { w: number; h: number };

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const clipped = wrapLines(ctx, text, maxWidth, maxLines);
  const startY = y - ((clipped.length - 1) * lineHeight) / 2;
  clipped.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function hostnameOf(url: string): string {
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Desenha `image` cobrindo todo o retangulo [dx,dy,dw,dh], recortando o
 * excesso (equivalente a CSS `object-fit: cover`), sem distorcer. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const imgRatio = iw / ih;
  const boxRatio = dw / dh;

  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;
  if (imgRatio > boxRatio) {
    // imagem mais "larga" que o painel -> corta as laterais
    sh = ih;
    sw = sh * boxRatio;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    // imagem mais "alta" que o painel -> corta topo/base
    sw = iw;
    sh = sw / boxRatio;
    sx = 0;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

function newTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Canvas nao tem dimensoes potencia-de-2 (1024x608). Com filtro de mipmap
  // (o default de Texture), isso pode deixar a textura "incompleta" em
  // certos contextos WebGL e ela e amostrada como preto solido, sem warning
  // nenhum no console. LinearFilter nao precisa de mipmap, entao funciona
  // com qualquer tamanho de canvas.
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Camada de base do painel: a imagem OG cobrindo o outdoor inteiro. Sem
 * anuncio (ou sem imagem), cai num fundo colorido com o nome/tagline
 * sempre visiveis — é o unico caso em que ha texto sem precisar de hover,
 * porque nao ha imagem nenhuma pra mostrar.
 */
export function drawPanelBaseTexture(
  canvas: HTMLCanvasElement,
  billboard: BillboardDoc,
  image: HTMLImageElement | null,
  size: CanvasSize = { w: DEFAULT_CANVAS_W, h: DEFAULT_CANVAS_H },
): THREE.CanvasTexture {
  const { w: CANVAS_W, h: CANVAS_H } = size;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const hasImage = Boolean(image && image.complete && image.naturalWidth > 0);

  if (hasImage) {
    try {
      drawImageCover(ctx, image!, 0, 0, CANVAS_W, CANVAS_H);
    } catch {
      // imagem de outro dominio sem CORS liberado — cai pro fundo solido
      drawFallback(ctx, billboard, size);
    }
  } else {
    drawFallback(ctx, billboard, size);
  }

  // vinheta bem sutil pra dar profundidade, mesmo com a imagem
  const vignette = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.4,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_W * 0.62,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  return newTexture(canvas);
}

function drawFallback(ctx: CanvasRenderingContext2D, billboard: BillboardDoc, size: CanvasSize) {
  const { w: CANVAS_W, h: CANVAS_H } = size;
  const bg = billboard.bgColor || "#f2601a";
  const fg = billboard.textColor || "#fff6e8";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // glow quente vindo de baixo, pra casar com as luzes volumetricas da cena
  const glow = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H * 1.05,
    CANVAS_H * 0.1,
    CANVAS_W / 2,
    CANVAS_H * 1.05,
    CANVAS_W * 0.75,
  );
  glow.addColorStop(0, "rgba(255,214,140,0.35)");
  glow.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const padX = 72;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;

  ctx.font = "700 76px Georgia, 'Times New Roman', serif";
  const brand = billboard.brandName?.trim() || "the internet billboard";
  wrapText(ctx, brand, CANVAS_W / 2, CANVAS_H / 2 - (billboard.tagline ? 32 : 0), CANVAS_W - padX * 2, 82, 2);

  if (billboard.tagline) {
    ctx.font = "500 34px 'Segoe UI', system-ui, sans-serif";
    ctx.globalAlpha = 0.88;
    wrapText(ctx, billboard.tagline, CANVAS_W / 2, CANVAS_H / 2 + 62, CANVAS_W - padX * 2, 42, 2);
    ctx.globalAlpha = 1;
  }
}

/**
 * Camada de overlay: nome, tagline e link, com um véu escuro embaixo pra
 * garantir legibilidade sobre a imagem. Fica invisível (opacity 0) até o
 * hover — controlado em Billboard.tsx, não aqui. Quando não há imagem, essa
 * camada não é usada (o texto já está sempre visível na camada de base).
 */
export function drawPanelOverlayTexture(
  canvas: HTMLCanvasElement,
  billboard: BillboardDoc,
  size: CanvasSize = { w: DEFAULT_CANVAS_W, h: DEFAULT_CANVAS_H },
): THREE.CanvasTexture {
  const { w: CANVAS_W, h: CANVAS_H } = size;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const padX = 56;
  const padBottom = 40;
  const brand = billboard.brandName?.trim() || "the internet billboard";
  const domain = billboard.linkUrl ? hostnameOf(billboard.linkUrl) : "";
  const maxTextWidth = CANVAS_W - padX * 2;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Blocos de texto, do topo pro fundo: marca, tagline (opcional), dominio
  // (opcional). Cada um sabe sua propria fonte/cor/altura de linha; o
  // layout so soma alturas, sem matematica de baseline espalhada.
  type Block = { lines: string[]; lineHeight: number; font: string; color: string; gapBefore: number };
  const blocks: Block[] = [];

  ctx.font = "700 52px Georgia, 'Times New Roman', serif";
  blocks.push({
    lines: wrapLines(ctx, brand, maxTextWidth, 2),
    lineHeight: 56,
    font: ctx.font,
    color: "#fff6e8",
    gapBefore: 0,
  });

  if (billboard.tagline) {
    ctx.font = "500 28px 'Segoe UI', system-ui, sans-serif";
    const taglineLines = wrapLines(ctx, billboard.tagline, maxTextWidth, 2);
    if (taglineLines.length) {
      blocks.push({
        lines: taglineLines,
        lineHeight: 36,
        font: ctx.font,
        color: "rgba(255,246,232,0.92)",
        gapBefore: 10,
      });
    }
  }

  if (domain) {
    blocks.push({
      lines: [`${domain} →`],
      lineHeight: 34,
      font: "600 24px 'Segoe UI', system-ui, sans-serif",
      color: "rgba(255,246,232,0.82)",
      gapBefore: 16,
    });
  }

  const totalH = blocks.reduce((sum, b) => sum + b.gapBefore + b.lines.length * b.lineHeight, 0);
  const scrimTop = Math.max(CANVAS_H * 0.38, CANVAS_H - padBottom - totalH - 28);

  const scrim = ctx.createLinearGradient(0, scrimTop, 0, CANVAS_H);
  scrim.addColorStop(0, "rgba(20,12,4,0)");
  scrim.addColorStop(0.55, "rgba(20,12,4,0.6)");
  scrim.addColorStop(1, "rgba(20,12,4,0.88)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, CANVAS_W, CANVAS_H - scrimTop);

  // Desenha de cima pra baixo; a soma das alturas bate exatamente com
  // padBottom no final (ver totalH acima), sem acumulo de arredondamento.
  let cursorY = CANVAS_H - padBottom - totalH;
  for (const block of blocks) {
    cursorY += block.gapBefore;
    ctx.font = block.font;
    ctx.fillStyle = block.color;
    for (const line of block.lines) {
      cursorY += block.lineHeight;
      ctx.fillText(line, padX, cursorY);
    }
  }

  return newTexture(canvas);
}
