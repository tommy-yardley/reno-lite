const mm = (value) => value / 25.4;
const floor = (label, category, widthMm, depthMm) => ({ label, category, mount: "floor", widthInches: mm(widthMm), depthInches: mm(depthMm), standardMm: { width: widthMm, depth: depthMm } });

// UK-oriented nominal planning footprints, not manufacturer-specific dimensions.
export const OBJECT_CATALOG = {
  sofa: floor("3-seat sofa", "Living", 2200, 950),
  twoSeatSofa: floor("2-seat sofa", "Living", 1800, 900),
  armchair: floor("Armchair", "Living", 900, 900),
  coffeeTable: floor("Coffee table", "Living", 1200, 600),
  tvUnit: floor("TV unit", "Living", 1600, 450),
  sideTable: floor("Side table", "Living", 500, 500),
  diningTable: floor("6-seat dining table", "Dining", 1800, 900),
  fourSeatTable: floor("4-seat dining table", "Dining", 1200, 800),
  diningChair: floor("Dining chair", "Dining", 450, 520),
  barStool: floor("Bar stool", "Dining", 450, 450),
  doubleBed: floor("UK double bed", "Bedroom", 1350, 1900),
  kingBed: floor("UK king bed", "Bedroom", 1500, 2000),
  singleBed: floor("UK single bed", "Bedroom", 900, 1900),
  bedsideTable: floor("Bedside table", "Bedroom", 450, 400),
  wardrobe: floor("Wardrobe", "Bedroom", 1000, 600),
  chestDrawers: floor("Chest of drawers", "Bedroom", 800, 450),
  desk: floor("Desk", "Office", 1200, 600),
  officeChair: floor("Office chair", "Office", 650, 650),
  bookcase: floor("Bookcase", "Office", 800, 300),
  cabinet: floor("Storage cabinet", "Storage", 900, 450),
  baseCabinet: floor("600 base unit", "Kitchen", 600, 600),
  tallCabinet: floor("600 tall unit", "Kitchen", 600, 600),
  kitchenIsland: floor("Kitchen island", "Kitchen", 1800, 900),
  fridgeFreezer: floor("Fridge freezer", "Kitchen", 600, 650),
  cooker: floor("600 cooker", "Kitchen", 600, 600),
  dishwasher: floor("Dishwasher", "Kitchen", 600, 600),
  washingMachine: floor("Washing machine", "Utility", 600, 650),
  tumbleDryer: floor("Tumble dryer", "Utility", 600, 650),
  socket: { label: "13A socket", category: "Electrical", mount: "wall", symbol: "S" },
  doubleSocket: { label: "13A double socket", category: "Electrical", mount: "wall", symbol: "SS" },
  lightSwitch: { label: "Light switch", category: "Electrical", mount: "wall", symbol: "SW" },
  radiator: { label: "Radiator", category: "Heating", mount: "wall", symbol: "R", widthInches: mm(1000), standardMm: { width: 1000 } },
  ceilingLight: { label: "Ceiling light", category: "Lighting", mount: "free", symbol: "L" },
  pendant: { label: "Pendant light", category: "Lighting", mount: "free", symbol: "P" },
};

export const CATALOG_GROUPS = ["Living", "Dining", "Bedroom", "Office", "Kitchen", "Utility", "Storage", "Electrical", "Lighting", "Heating"];
