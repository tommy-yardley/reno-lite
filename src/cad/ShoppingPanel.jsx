import React, { useMemo } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { buildJpegPdf } from "../lib/pdfExport";
import { saveOrShareFile } from "../lib/nativeExport";
import { aggregateShopping, buildShoppingCsv, buildShoppingSvg } from "./shopping";

async function shoppingPdf(svg) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = Math.ceil((1800 * image.height) / image.width);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const base64 = canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return buildJpegPdf(bytes, canvas.width, canvas.height, 595, (595 * canvas.height) / canvas.width);
}

export default function ShoppingPanel({ cad }) {
  const lines = useMemo(
    () => aggregateShopping(cad.objects, cad.shoppingItems, cad.rooms),
    [cad.objects, cad.shoppingItems, cad.rooms],
  );
  const total = lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
  const purchased = lines
    .filter((line) => ["purchased", "delivered", "installed"].includes(line.status))
    .reduce((sum, line) => sum + line.lineTotalPence, 0);
  const exportCsv = () =>
    saveOrShareFile(
      new Blob([buildShoppingCsv(lines)], { type: "text/csv" }),
      "reno-lite-shopping-list.csv",
    );
  const exportPdf = async () =>
    saveOrShareFile(
      await shoppingPdf(buildShoppingSvg(lines)),
      "reno-lite-shopping-list.pdf",
    );

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="mono text-[11px] uppercase tracking-widest text-[#5B6B78]">
          Shopping & specifications
        </h2>
        <button onClick={cad.addShoppingItem} className="flex items-center gap-1 text-[10px] text-[#B8863E]">
          <Plus size={11} /> Add material
        </button>
      </div>
      {lines.length > 0 && (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded border border-[#D8CCB0] bg-[#FBF8F1] p-2">
              <span className="text-[9px] text-[#8A97A3]">Specified</span>
              <strong className="mono block text-sm">£{(total / 100).toFixed(2)}</strong>
            </div>
            <div className="rounded border border-[#D8CCB0] bg-[#FBF8F1] p-2">
              <span className="text-[9px] text-[#8A97A3]">Purchased+</span>
              <strong className="mono block text-sm">£{(purchased / 100).toFixed(2)}</strong>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#D8CCB0] bg-[#FBF8F1]">
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#E8DFC9] px-2 py-2 text-[10px] last:border-b-0">
                <div>
                  <p className="font-medium text-[#1B2B3A]">{line.quantity}× {line.name}</p>
                  <p className="text-[9px] text-[#8A97A3]">
                    {line.roomNames.join(", ") || line.supplier || line.category} · {line.status}
                  </p>
                </div>
                <span className="mono text-[#5B6B78]">£{(line.lineTotalPence / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {cad.shoppingItems.map((item) => (
        <div key={item.id} className="mt-2 space-y-2 rounded border border-[#D8CCB0] bg-[#FBF8F1] p-2">
          <div className="flex gap-1">
            <input value={item.name} aria-label="Item name" onChange={(event) => cad.updateShoppingItem(item.id, { name: event.target.value })} className="min-w-0 flex-1 text-xs font-medium" />
            <button onClick={() => cad.deleteShoppingItem(item.id)} aria-label={`Delete ${item.name}`} className="text-[#B2483A]"><Trash2 size={13} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <label className="text-[9px] text-[#8A97A3]">Quantity<input aria-label="Quantity" type="number" min="1" value={item.quantity} onChange={(event) => cad.updateShoppingItem(item.id, { quantity: Number(event.target.value) })} className="mono mt-0.5 w-full rounded border border-[#D8CCB0] px-1 py-1.5 text-[10px]" /></label>
            <label className="text-[9px] text-[#8A97A3]">Unit price £<input aria-label="Unit price" type="number" step="0.01" value={(item.unitPricePence / 100).toFixed(2)} onChange={(event) => cad.updateShoppingItem(item.id, { unitPricePence: Math.round(Number(event.target.value) * 100) })} className="mono mt-0.5 w-full rounded border border-[#D8CCB0] px-1 py-1.5 text-[10px]" /></label>
            <label className="text-[9px] text-[#8A97A3]">Status<select aria-label="Procurement status" value={item.status || "proposed"} onChange={(event) => cad.updateShoppingItem(item.id, { status: event.target.value })} className="mt-0.5 w-full rounded border border-[#D8CCB0] bg-transparent px-1 py-1.5 text-[10px]">{["proposed", "approved", "purchased", "delivered", "installed"].map((status) => <option key={status}>{status}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <input aria-label="Category" placeholder="Category" value={item.category || ""} onChange={(event) => cad.updateShoppingItem(item.id, { category: event.target.value })} className="rounded border border-[#D8CCB0] px-2 py-1.5 text-[10px]" />
            <input aria-label="Room" placeholder="Room / area" value={item.roomName || ""} onChange={(event) => cad.updateShoppingItem(item.id, { roomName: event.target.value })} className="rounded border border-[#D8CCB0] px-2 py-1.5 text-[10px]" />
            <input aria-label="Supplier" placeholder="Supplier" value={item.supplier || ""} onChange={(event) => cad.updateShoppingItem(item.id, { supplier: event.target.value })} className="rounded border border-[#D8CCB0] px-2 py-1.5 text-[10px]" />
            <input aria-label="Product URL" placeholder="Product URL" value={item.url || ""} onChange={(event) => cad.updateShoppingItem(item.id, { url: event.target.value })} className="rounded border border-[#D8CCB0] px-2 py-1.5 text-[10px]" />
          </div>
        </div>
      ))}
      {lines.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={exportCsv} className="flex items-center justify-center gap-1 rounded border border-[#D8CCB0] py-2 text-[10px] text-[#5E86A8]"><Download size={11} /> CSV</button>
          <button onClick={exportPdf} className="flex items-center justify-center gap-1 rounded border border-[#D8CCB0] py-2 text-[10px] text-[#5E86A8]"><Download size={11} /> PDF</button>
        </div>
      )}
    </section>
  );
}
