const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const escapeXml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

export function aggregateShopping(objects, unplacedItems = [], rooms = []) {
  const roomMap = new Map(rooms.map((room) => [room.id, room.name]));
  const grouped = new Map();
  objects.forEach((object) => {
    const key = object.productKey || `${object.name}|${object.supplier || ""}|${object.pricePence || 0}`;
    const existing = grouped.get(key) || { id: key, name: object.name, category: object.category, supplier: object.supplier || "", url: object.productUrl || "", unitPricePence: object.pricePence || 0, quantity: 0, status: object.procurementStatus || "proposed", rooms: new Set() };
    existing.quantity += 1;
    if (object.roomId) existing.rooms.add(roomMap.get(object.roomId) || `Room ${object.roomId}`);
    grouped.set(key, existing);
  });
  unplacedItems.forEach((item) => grouped.set(`item-${item.id}`, { ...item, unitPricePence: item.unitPricePence || 0, quantity: item.quantity || 1, rooms: new Set(item.roomName ? [item.roomName] : []) }));
  return [...grouped.values()].map((item) => ({ ...item, roomNames: [...item.rooms], lineTotalPence: item.unitPricePence * item.quantity }));
}

export function buildShoppingCsv(lines) {
  return ["Item,Category,Rooms,Supplier,Quantity,Unit price GBP,Total GBP,Status,URL", ...lines.map((line) => [line.name, line.category, line.roomNames.join("; "), line.supplier, line.quantity, (line.unitPricePence / 100).toFixed(2), (line.lineTotalPence / 100).toFixed(2), line.status, line.url].map(escapeCsv).join(","))].join("\n");
}

export function buildShoppingSvg(lines) {
  const width = 900;
  const rowHeight = 30;
  const height = Math.max(180, 100 + lines.length * rowHeight);
  const total = lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
  const rows = lines.map((line, index) => `<g transform="translate(0 ${80 + index * rowHeight})"><rect width="${width}" height="${rowHeight}" fill="${index % 2 ? "#f5f1e8" : "#fff"}"/><text x="20" y="20">${escapeXml(line.name)}</text><text x="380" y="20">${line.quantity}</text><text x="470" y="20">£${(line.unitPricePence / 100).toFixed(2)}</text><text x="590" y="20">£${(line.lineTotalPence / 100).toFixed(2)}</text><text x="720" y="20">${escapeXml(line.status)}</text></g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><style>text{font-family:Arial,sans-serif;font-size:13px;fill:#1b2b3a}</style><text x="20" y="32" font-size="22" font-weight="bold">RenoLite shopping &amp; specification schedule</text><text x="20" y="65" font-weight="bold">Item</text><text x="380" y="65">Qty</text><text x="470" y="65">Unit</text><text x="590" y="65">Total</text><text x="720" y="65">Status</text>${rows}<text x="590" y="${height - 20}" font-weight="bold">Total £${(total / 100).toFixed(2)}</text></svg>`;
}
