// Recebe a lista enviada pelo site e guarda como uma encomenda separada.
import { getStore } from "@netlify/blobs";

const MIN_CAMISAS = 10;
const txt = (v, n) => String(v ?? "").trim().slice(0, n);
const resp = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return resp({ erro: "Método não permitido." }, 405);

  let d;
  try { d = await req.json(); } catch { return resp({ erro: "Dados inválidos." }, 400); }

  const representante = txt(d.representante, 100);
  if (!representante) return resp({ erro: "Informe o nome do representante." }, 400);
  if (!Array.isArray(d.itens) || d.itens.length === 0 || d.itens.length > 500)
    return resp({ erro: "Lista inválida." }, 400);

  const itens = d.itens
    .map((i) => ({
      nome: txt(i.nome, 80), numero: txt(i.numero, 10),
      tamCamisa: txt(i.tamCamisa, 20), tamShort: txt(i.tamShort, 20), obs: txt(i.obs, 200),
    }))
    .filter((i) => i.nome && i.numero && (i.tamCamisa || i.tamShort));

  const camisas = itens.filter((i) => i.tamCamisa).length;
  const shorts = itens.filter((i) => i.tamShort).length;
  if (camisas < MIN_CAMISAS)
    return resp({ erro: `O pedido precisa ter no mínimo ${MIN_CAMISAS} camisas (recebemos ${camisas}).` }, 400);

  const agora = new Date();
  const sp = agora.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }); // 2026-10-03 14:22:11
  const ym = sp.slice(0, 7);
  const id = crypto.randomUUID();
  const key = `${ym}/${id}`;

  await getStore({ name: "encomendas", consistency: "strong" }).setJSON(key, {
    id, key, representante, criadoEm: agora.toISOString(),
    ano: Number(ym.slice(0, 4)), mes: Number(ym.slice(5, 7)),
    status: "Pendente", entrega: "", itens,
  });
  return resp({ ok: true, camisas, shorts });
};

export const config = { path: "/api/enviar" };
