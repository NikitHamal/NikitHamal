// Hanomi — core constants and tile/block/object tables.
export const TS = 16;          // tile size in pixels
export const CS = 16;          // chunk size in tiles
export const CPX = TS * CS;    // chunk size in pixels
export const DAY_LEN = 600;    // seconds per in-game day
export const VERSION = 1;

// ground layer
export const G = {
  WATER: 0, DEEP: 1, SAND: 2, GRASS: 3, FOREST: 4, DIRT: 5, PATH: 6, ROCK: 7,
  TILLED: 8, WET: 9, WOOD: 10, COBBLE: 11, SAKURA: 12, MARSH: 13, PLAZA: 14, SNOW: 15, TATAMI: 16, ONSEN: 17,
};
export const isWater = g => g === G.WATER || g === G.DEEP || g === G.ONSEN;
export const HARD = new Set([G.TILLED, G.WET, G.WOOD, G.COBBLE, G.PLAZA, G.TATAMI]); // tile-exact edges
export const GROUND_NAME = ['Water', 'Deep water', 'Sand', 'Grass', 'Forest floor', 'Dirt', 'Path', 'Rock', 'Tilled soil', 'Watered soil', 'Wood floor', 'Cobblestone', 'Sakura grass', 'Marsh', 'Plaza', 'Snow', 'Tatami', 'Hot spring'];

// block layer (solid, mineable / buildable walls)
export const B = { NONE: 0, STONE: 1, COAL: 2, IRON: 3, GOLD: 4, GEM: 5, WOODWALL: 6, STONEWALL: 7, BLDG: 8, DARK: 9, IWALL: 10 };
export const BLOCK = {
  [B.STONE]: { name: 'Stone', hp: 6, tool: 'pick', tier: 0, drop: [['stone', 1, 2]] },
  [B.DARK]: { name: 'Deep stone', hp: 10, tool: 'pick', tier: 1, drop: [['stone', 2, 3]] },
  [B.COAL]: { name: 'Coal vein', hp: 8, tool: 'pick', tier: 0, drop: [['coal', 1, 3], ['stone', 0, 1]] },
  [B.IRON]: { name: 'Iron vein', hp: 10, tool: 'pick', tier: 1, drop: [['iron_ore', 1, 2], ['stone', 0, 1]] },
  [B.GOLD]: { name: 'Gold vein', hp: 12, tool: 'pick', tier: 2, drop: [['gold_ore', 1, 2]] },
  [B.GEM]: { name: 'Jade crystal', hp: 14, tool: 'pick', tier: 2, drop: [['jade', 1, 2]] },
  [B.WOODWALL]: { name: 'Wood wall', hp: 8, tool: 'axe', tier: 0, drop: [['wood_wall', 1, 1]], built: 1 },
  [B.STONEWALL]: { name: 'Stone wall', hp: 16, tool: 'pick', tier: 0, drop: [['stone_wall', 1, 1]], built: 1 },
  [B.BLDG]: { name: 'Building', hp: 1e9, tool: 'none', tier: 9, drop: [] },
  [B.IWALL]: { name: 'Wall', hp: 1e9, tool: 'none', tier: 9, drop: [] },
};

// object layer (one per tile; trees, plants, placeables)
export const O = {
  NONE: 0, OAK: 1, PINE: 2, SAKURA: 3, BIRCH: 4, STUMP: 5, BUSH: 6, BERRY: 7, BOULDER: 8, PEBBLE: 9,
  TALLGRASS: 10, FLOWERS: 11, REEDS: 12, MUSHROOM: 13, LILY: 14, SAPLING: 15,
  WHEAT: 20, CARROT: 21, TOMATO: 22, PUMPKIN: 23, RICE: 24,
  TORCH: 40, CAMPFIRE: 41, CHEST: 42, BENCH: 43, FURNACE: 44, ANVIL: 45, BED: 46, FENCE: 47, GATE: 48,
  LANTERN: 49, SCARECROW: 50, SIGN: 51, BANNER: 52, WELL: 53, BARREL: 54, CRATE: 55, HAY: 56, STALL: 57,
  TORII: 58, KOI: 59, GRAVE: 60, SPIKES: 61, TOWER: 62, POT: 63, DEADTREE: 64, CACTUS: 65,
  TABLE: 66, HEARTH: 67, SHELF: 68, BONSAI: 69, ANDON: 70, CUSHION: 71, SCREEN: 72, STOVE: 73, EXIT: 74, WINDOW: 75, SCROLL: 76,
  SHRINE: 77, DIG: 78, BAMBOO: 79,
};
export const CROPS = { [O.WHEAT]: { seed: 'wheat_seeds', crop: 'wheat', days: 3, n: [1, 2], seeds: [1, 2] },
  [O.CARROT]: { seed: 'carrot', crop: 'carrot', days: 3, n: [2, 3], seeds: [0, 0] },
  [O.TOMATO]: { seed: 'tomato_seeds', crop: 'tomato', days: 4, n: [2, 4], seeds: [0, 1] },
  [O.PUMPKIN]: { seed: 'pumpkin_seeds', crop: 'pumpkin', days: 5, n: [1, 1], seeds: [1, 2] },
  [O.RICE]: { seed: 'rice_seeds', crop: 'rice', days: 4, n: [2, 3], seeds: [0, 1] } };
// solid: blocks movement ; hp/tool for breaking ; drop: [item,min,max] ; light: radius in tiles
export const OBJ = {
  [O.OAK]: { name: 'Oak', solid: 1, hp: 6, tool: 'axe', drop: [['wood', 3, 5], ['acorn', 0, 1], ['apple', 0, 1]], tree: 1, stump: 1 },
  [O.PINE]: { name: 'Pine', solid: 1, hp: 6, tool: 'axe', drop: [['wood', 3, 5], ['pinecone', 0, 1]], tree: 1, stump: 1 },
  [O.SAKURA]: { name: 'Sakura', solid: 1, hp: 6, tool: 'axe', drop: [['wood', 2, 4], ['petals', 1, 3], ['sakura_sapling', 0, 1]], tree: 1, stump: 1 },
  [O.BIRCH]: { name: 'Birch', solid: 1, hp: 5, tool: 'axe', drop: [['wood', 2, 4], ['acorn', 0, 1]], tree: 1, stump: 1 },
  [O.DEADTREE]: { name: 'Dead tree', solid: 1, hp: 3, tool: 'axe', drop: [['wood', 1, 3], ['stick', 1, 2]], tree: 1 },
  [O.STUMP]: { name: 'Stump', solid: 1, hp: 3, tool: 'axe', drop: [['wood', 1, 2]] },
  [O.BUSH]: { name: 'Bush', solid: 0, hp: 1, tool: 'any', drop: [['fiber', 1, 2], ['stick', 0, 1]] },
  [O.BERRY]: { name: 'Berry bush', solid: 0, hp: 1, tool: 'any', drop: [['berries', 2, 4], ['fiber', 0, 1]], harvest: 'berries' },
  [O.BOULDER]: { name: 'Boulder', solid: 1, hp: 5, tool: 'pick', drop: [['stone', 2, 4], ['flint', 0, 1]] },
  [O.PEBBLE]: { name: 'Pebbles', solid: 0, hp: 1, tool: 'any', drop: [['stone', 1, 1], ['flint', 0, 1]] },
  [O.TALLGRASS]: { name: 'Tall grass', solid: 0, hp: 1, tool: 'any', drop: [['fiber', 1, 1], ['wheat_seeds', 0, 1]] },
  [O.FLOWERS]: { name: 'Flowers', solid: 0, hp: 1, tool: 'any', drop: [['flower', 1, 1]] },
  [O.REEDS]: { name: 'Reeds', solid: 0, hp: 1, tool: 'any', drop: [['fiber', 1, 2], ['rice_seeds', 0, 1]] },
  [O.MUSHROOM]: { name: 'Mushroom', solid: 0, hp: 1, tool: 'any', drop: [['mushroom', 1, 2]] },
  [O.LILY]: { name: 'Lily pad', solid: 0, hp: 1, tool: 'any', drop: [['lotus', 0, 1]], water: 1 },
  [O.CACTUS]: { name: 'Cactus', solid: 1, hp: 2, tool: 'any', drop: [['fiber', 1, 1]] },
  [O.SAPLING]: { name: 'Sapling', solid: 0, hp: 1, tool: 'any', drop: [['sapling', 1, 1]] },
  [O.WHEAT]: { name: 'Wheat', solid: 0, hp: 1, tool: 'any', crop: 1 },
  [O.CARROT]: { name: 'Carrots', solid: 0, hp: 1, tool: 'any', crop: 1 },
  [O.TOMATO]: { name: 'Tomatoes', solid: 0, hp: 1, tool: 'any', crop: 1 },
  [O.PUMPKIN]: { name: 'Pumpkin', solid: 0, hp: 1, tool: 'any', crop: 1 },
  [O.RICE]: { name: 'Rice', solid: 0, hp: 1, tool: 'any', crop: 1 },
  [O.TORCH]: { name: 'Torch', solid: 0, hp: 1, tool: 'any', drop: [['torch', 1, 1]], light: 5, warm: 1 },
  [O.CAMPFIRE]: { name: 'Campfire', solid: 1, hp: 2, tool: 'any', drop: [['campfire', 1, 1]], light: 7, warm: 1, station: 'fire' },
  [O.CHEST]: { name: 'Chest', solid: 1, hp: 3, tool: 'any', drop: [['chest', 1, 1]], use: 'chest' },
  [O.BENCH]: { name: 'Workbench', solid: 1, hp: 3, tool: 'any', drop: [['bench', 1, 1]], station: 'bench' },
  [O.FURNACE]: { name: 'Furnace', solid: 1, hp: 4, tool: 'pick', drop: [['furnace', 1, 1]], station: 'furnace', light: 3, warm: 1 },
  [O.ANVIL]: { name: 'Anvil', solid: 1, hp: 5, tool: 'pick', drop: [['anvil', 1, 1]], station: 'anvil' },
  [O.BED]: { name: 'Bed', solid: 1, hp: 2, tool: 'any', drop: [['bed', 1, 1]], use: 'bed' },
  [O.FENCE]: { name: 'Fence', solid: 1, hp: 2, tool: 'any', drop: [['fence', 1, 1]], fence: 1 },
  [O.GATE]: { name: 'Gate', solid: 1, hp: 2, tool: 'any', drop: [['gate', 1, 1]], fence: 1, use: 'gate' },
  [O.LANTERN]: { name: 'Stone lantern', solid: 1, hp: 4, tool: 'pick', drop: [['lantern', 1, 1]], light: 6 },
  [O.SCARECROW]: { name: 'Scarecrow', solid: 1, hp: 2, tool: 'any', drop: [['scarecrow', 1, 1]] },
  [O.SIGN]: { name: 'Sign', solid: 1, hp: 2, tool: 'any', drop: [['wood', 1, 1]] },
  [O.BANNER]: { name: 'Banner', solid: 1, hp: 1e9, tool: 'none', use: 'banner' },
  [O.WELL]: { name: 'Well', solid: 1, hp: 1e9, tool: 'none', use: 'well' },
  [O.BARREL]: { name: 'Barrel', solid: 1, hp: 2, tool: 'any', drop: [['wood', 1, 2]] },
  [O.CRATE]: { name: 'Crate', solid: 1, hp: 2, tool: 'any', drop: [['wood', 1, 2]] },
  [O.HAY]: { name: 'Haystack', solid: 1, hp: 2, tool: 'any', drop: [['wheat', 2, 4]] },
  [O.STALL]: { name: 'Market stall', solid: 1, hp: 1e9, tool: 'none', use: 'trade' },
  [O.TORII]: { name: 'Torii', solid: 0, hp: 1e9, tool: 'none' },
  [O.KOI]: { name: 'Koi pond', solid: 1, hp: 1e9, tool: 'none', use: 'koi' },
  [O.GRAVE]: { name: 'Lost satchel', solid: 0, hp: 1e9, tool: 'none', use: 'grave' },
  [O.SPIKES]: { name: 'Spike trap', solid: 0, hp: 3, tool: 'any', drop: [['spikes', 1, 1]], trap: 1 },
  [O.TOWER]: { name: 'Watchtower', solid: 1, hp: 12, tool: 'axe', drop: [['tower', 1, 1]], light: 4 },
  [O.TABLE]: { name: 'Low table', solid: 1, hp: 1e9, tool: 'none' },
  [O.HEARTH]: { name: 'Irori hearth', solid: 1, hp: 1e9, tool: 'none', light: 5, warm: 1, station: 'fire' },
  [O.SHELF]: { name: 'Tansu', solid: 1, hp: 1e9, tool: 'none' },
  [O.BONSAI]: { name: 'Bonsai', solid: 1, hp: 1e9, tool: 'none' },
  [O.ANDON]: { name: 'Andon lamp', solid: 1, hp: 1e9, tool: 'none', light: 4, warm: 1 },
  [O.CUSHION]: { name: 'Zabuton', solid: 0, hp: 1e9, tool: 'none' },
  [O.SCREEN]: { name: 'Folding screen', solid: 1, hp: 1e9, tool: 'none' },
  [O.STOVE]: { name: 'Kamado stove', solid: 1, hp: 1e9, tool: 'none', light: 3, warm: 1, station: 'pot' },
  [O.EXIT]: { name: 'Doorway', solid: 0, hp: 1e9, tool: 'none' },
  [O.WINDOW]: { name: 'Shoji window', solid: 0, hp: 1e9, tool: 'none', wall: 1 },
  [O.SCROLL]: { name: 'Hanging scroll', solid: 0, hp: 1e9, tool: 'none', wall: 1 },
  [O.SHRINE]: { name: 'Wayside shrine', solid: 1, hp: 1e9, tool: 'none', use: 'shrine', light: 3 },
  [O.BAMBOO]: { name: 'Bamboo', solid: 1, hp: 3, tool: 'axe', drop: [['bamboo', 2, 3]], tree: 1 },
  [O.DIG]: { name: 'Glinting soil', solid: 0, hp: 1e9, tool: 'none' },
  [O.POT]: { name: 'Cooking pot', solid: 1, hp: 2, tool: 'any', drop: [['pot', 1, 1]], station: 'pot', light: 2, warm: 1 },
};
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // down,right,up,left
