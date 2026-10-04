// Área do dono: lista, atualiza e exclui encomendas. Protegida por senha.
import { getStore } from "@netlify/blobs";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default async (req) => {
  const senha = globalThis.Netlify?.env?.get("PAINEL_SENHA") ?? process.env.PAINEL_SENHA;
  if (!senha) return json({ erro: "senha-nao-configurada" }, 500);
  if (req.headers.get("x-senha") !== senha) return json({ erro: "senha" }, 401);

  const store = getStore({ name: "encomendas", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const lista = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    return json({ encomendas: lista });
  }

  if (req.method === "POST") {
    const d = await req.json().catch(() => ({}));
    const key = String(d.key || "");
    if (!/^\d{4}-\d{2}\/[\w-]+$/.test(key)) return json({ erro: "chave" }, 400);

    if (d.acao === "excluir") { await store.delete(key); return json({ ok: true }); }

    if (d.acao === "atualizar") {
      const e = await store.get(key, { type: "json" });
      if (!e) return json({ erro: "nao-encontrada" }, 404);
      e.status = d.status === "Feita" ? "Feita" : "Pendente";
      e.entrega = /^\d{4}-\d{2}-\d{2}$/.test(d.entrega || "") ? d.entrega : "";
      await store.setJSON(key, e);
      return json({ ok: true });
    }
  }
  return json({ erro: "invalido" }, 400);
};

export const config = { path: "/api/painel" };
