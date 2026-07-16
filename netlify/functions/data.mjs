import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const itemsStore = getStore("stockcheck-items");
  const countsStore = getStore("stockcheck-counts");

  try {
    if (req.method === "GET") {
      const items = (await itemsStore.get("items", { type: "json" })) || null;
      const counts = (await countsStore.get("counts", { type: "json" })) || {};
      return json({ items, counts });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action;

      if (action === "setItems") {
        await itemsStore.setJSON("items", body.items || []);
        return json({ ok: true });
      }

      if (action === "upsertItem") {
        const items = (await itemsStore.get("items", { type: "json" })) || [];
        const oldBarcode = body.oldBarcode || body.item.barcode;
        const idx = items.findIndex((i) => i.barcode === oldBarcode);
        if (idx >= 0) items[idx] = body.item;
        else items.push(body.item);
        await itemsStore.setJSON("items", items);
        return json({ ok: true });
      }

      if (action === "deleteItem") {
        const items = (await itemsStore.get("items", { type: "json" })) || [];
        const filtered = items.filter((i) => i.barcode !== body.barcode);
        await itemsStore.setJSON("items", filtered);
        return json({ ok: true });
      }

      if (action === "upsertCount") {
        const counts = (await countsStore.get("counts", { type: "json" })) || {};
        counts[body.barcode] = body.count;
        await countsStore.setJSON("counts", counts);
        return json({ ok: true });
      }

      if (action === "deleteCount") {
        const counts = (await countsStore.get("counts", { type: "json" })) || {};
        delete counts[body.barcode];
        await countsStore.setJSON("counts", counts);
        return json({ ok: true });
      }

      if (action === "clearCounts") {
        await countsStore.setJSON("counts", {});
        return json({ ok: true });
      }

      return json({ error: "Unknown action" }, 400);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
};
