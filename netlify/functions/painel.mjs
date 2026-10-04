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
  const config = getStore({ name: "config", consistency: "strong" });
  const fotos = getStore({ name: "fotos", consistency: "strong" });
  const CHAVE = /^\d{4}-\d{2}\/[\w-]+$/;
  const PADRAO = { camisa: 44.9, camisa_punho: 49.9, camisa_text: 59.9, manga_longa: 0, short: 24.9, short_text: 34.9 };

  if (req.method === "GET") {
    const fk = new URL(req.url).searchParams.get("foto");
    if (fk) {
      if (!CHAVE.test(fk)) return json({ erro: "chave" }, 400);
      return json({ imagem: (await fotos.get(fk, { type: "text" }).catch(() => null)) || null });
    }
    const { blobs } = await store.list();
    const lista = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    const precos = { ...PADRAO, ...((await config.get("precos2", { type: "json" }).catch(() => null)) || {}) };
    return json({ encomendas: lista, precos });
  }

  if (req.method === "POST") {
    const d = await req.json().catch(() => ({}));
    if (d.acao === "precos") {
      const novo = {};
      for (const k of Object.keys(PADRAO)) {
        const v = Number(d.precos?.[k]);
        novo[k] = Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : 0;
      }
      await config.setJSON("precos2", novo);
      return json({ ok: true });
    }
    const key = String(d.key || "");
    if (!CHAVE.test(key)) return json({ erro: "chave" }, 400);

    if (d.acao === "excluir") {
      await store.delete(key);
      await fotos.delete(key).catch(() => {});
      return json({ ok: true });
    }

    if (d.acao === "foto" || d.acao === "removerFoto") {
      const e = await store.get(key, { type: "json" });
      if (!e) return json({ erro: "nao-encontrada" }, 404);
      if (d.acao === "foto") {
        const img = String(d.imagem || "");
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 3_000_000)
          return json({ erro: "imagem-invalida" }, 400);
        await fotos.set(key, img);
        e.foto = true;
      } else {
        await fotos.delete(key).catch(() => {});
        e.foto = false;
      }
      await store.setJSON(key, e);
      return json({ ok: true });
    }

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
