export { default, alt, size, contentType } from "./opengraph-image";

// runtime/revalidate precisam ser declarados aqui direto — o Next não
// consegue analisar esses dois campos estaticamente se vierem de um
// re-export (mesmo que default/alt/size/contentType possam).
export const runtime = "nodejs";
export const revalidate = 60;
