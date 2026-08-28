import { ImageResponse } from "next/og";
import { getCurrentBillboardForOg } from "@/lib/firebase/serverRead";
import { formatUSD } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/safeUrl";

export const runtime = "nodejs";
export const revalidate = 60;

export const alt = "The Internet Billboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const billboard = await getCurrentBillboardForOg();
  const claimed = billboard.claimCount > 0;
  // defesa extra contra SSRF: mesmo que algo tenha passado da validação na
  // criação do checkout, nunca busca uma imagem de host interno aqui.
  const safeImageUrl =
    billboard.imageUrl && isSafeHttpUrl(billboard.imageUrl)
      ? billboard.imageUrl
      : null;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #fdf6e9 0%, #f8ecd4 45%, #efdab3 100%)",
        padding: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "#ff7a33",
            fontSize: 34,
          }}
        >
          🔶
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 700,
            color: "#3a2a1a",
          }}
        >
          The Internet Billboard
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: 940,
          height: 340,
          borderRadius: 28,
          background: claimed ? billboard.bgColor : "#e2c393",
          border: "10px solid #f3e6cf",
          padding: 48,
        }}
      >
        {claimed ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {safeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- JSX do Satori (next/og), não é DOM real; next/image não se aplica aqui.
              <img
                src={safeImageUrl}
                alt=""
                width={140}
                height={140}
                style={{
                  borderRadius: 20,
                  objectFit: "cover",
                  marginBottom: 26,
                  border: "4px solid rgba(255,255,255,0.6)",
                }}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                fontSize: 58,
                fontWeight: 700,
                color: billboard.textColor,
                textAlign: "center",
              }}
            >
              {billboard.brandName}
            </div>
            {billboard.tagline ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: billboard.textColor,
                  opacity: 0.85,
                  marginTop: 14,
                  textAlign: "center",
                }}
              >
                {billboard.tagline}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: 42,
              fontWeight: 700,
              color: "#5c4630",
            }}
          >
            Nobody has claimed this billboard yet
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: "#8a7157",
          marginTop: 44,
        }}
      >
        {claimed ? `Claimed for ${formatUSD(billboard.priceCents)} · ` : ""}
        pay more, take it over → theinternetbillboard.lol
      </div>
    </div>,
    { ...size },
  );
}
