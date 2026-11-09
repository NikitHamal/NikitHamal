// Hanomi native — tile/block/object tables, item database, recipes (ported from the web original).
#pragma once
#include "core.h"

enum G_ : u8 { G_WATER, G_DEEP, G_SAND, G_GRASS, G_FOREST, G_DIRT, G_PATH, G_ROCK, G_TILLED, G_WET, G_WOOD, G_COBBLE, G_SAKURA, G_MARSH, G_PLAZA, G_SNOW, G_TATAMI, G_ONSEN, G_COUNT };
inline bool isWater(int g) { return g == G_WATER || g == G_DEEP || g == G_ONSEN; }
static const char* GROUND_NAME[] = {"Water", "Deep water", "Sand", "Grass", "Forest floor", "Dirt", "Path", "Rock", "Tilled soil", "Watered soil", "Wood floor", "Cobblestone", "Sakura grass", "Marsh", "Plaza", "Snow", "Tatami", "Hot spring"};

enum B_ : u8 { B_NONE, B_STONE, B_COAL, B_IRON, B_GOLD, B_GEM, B_WOODWALL, B_STONEWALL, B_BLDG, B_DARK, B_IWALL, B_COUNT };
enum Tool_ { TL_NONE, TL_ANY, TL_AXE, TL_PICK, TL_HOE, TL_SWORD, TL_SPEAR, TL_BOW, TL_ROD, TL_CAN, TL_SHEARS, TL_BUCKET };
struct DropDef { const char* item; int a, b; };
struct BlockDef { const char* name; float hp; int tool, tier; std::vector<DropDef> drop; };
static const BlockDef BLOCKS[B_COUNT] = {
  {"", 0, 0, 0, {}},
  {"Stone", 6, TL_PICK, 0, {{"stone", 1, 2}}}, {"Coal vein", 8, TL_PICK, 0, {{"coal", 1, 3}, {"stone", 0, 1}}},
  {"Iron vein", 10, TL_PICK, 1, {{"iron_ore", 1, 2}, {"stone", 0, 1}}}, {"Gold vein", 12, TL_PICK, 2, {{"gold_ore", 1, 2}}},
  {"Jade crystal", 14, TL_PICK, 2, {{"jade", 1, 2}}}, {"Wood wall", 8, TL_AXE, 0, {{"wood_wall", 1, 1}}},
  {"Stone wall", 16, TL_PICK, 0, {{"stone_wall", 1, 1}}}, {"Building", 1e9f, 0, 9, {}}, {"Deep stone", 10, TL_PICK, 1, {{"stone", 2, 3}}}, {"Wall", 1e9f, 0, 9, {}}};

enum O_ : u8 {
  O_NONE = 0, O_OAK = 1, O_PINE, O_SAKURA, O_BIRCH, O_STUMP, O_BUSH, O_BERRY, O_BOULDER, O_PEBBLE, O_TALLGRASS, O_FLOWERS, O_REEDS, O_MUSHROOM, O_LILY, O_SAPLING,
  O_WHEAT = 20, O_CARROT, O_TOMATO, O_PUMPKIN, O_RICE,
  O_TORCH = 40, O_CAMPFIRE, O_CHEST, O_BENCH, O_FURNACE, O_ANVIL, O_BED, O_FENCE, O_GATE, O_LANTERN, O_SCARECROW, O_SIGN, O_BANNER, O_WELL, O_BARREL, O_CRATE, O_HAY, O_STALL,
  O_TORII, O_KOI, O_GRAVE, O_SPIKES, O_TOWER, O_POT, O_DEADTREE, O_CACTUS, O_SHRINE = 77, O_DIG, O_BAMBOO, O_MAX
};
struct ObjDef { const char* name; bool solid; float hp; int tool; std::vector<DropDef> drop; bool tree, crop; int light; bool warm; const char* station; const char* use; bool water; };
static ObjDef OBJS[O_MAX];
inline void initObjs() {
  static bool done = false; if (done) return; done = true;
  auto S = [](int o, const char* n, bool solid, float hp, int tool, std::vector<DropDef> d) { OBJS[o] = {n, solid, hp, tool, d, false, false, 0, false, nullptr, nullptr, false}; return &OBJS[o]; };
  S(O_OAK, "Oak", 1, 6, TL_AXE, {{"wood", 3, 5}, {"acorn", 0, 1}, {"apple", 0, 1}})->tree = 1;
  S(O_PINE, "Pine", 1, 6, TL_AXE, {{"wood", 3, 5}, {"pinecone", 0, 1}})->tree = 1;
  S(O_SAKURA, "Sakura", 1, 6, TL_AXE, {{"wood", 2, 4}, {"petals", 1, 3}, {"sakura_sapling", 0, 1}})->tree = 1;
  S(O_BIRCH, "Birch", 1, 5, TL_AXE, {{"wood", 2, 4}, {"acorn", 0, 1}})->tree = 1;
  S(O_DEADTREE, "Dead tree", 1, 3, TL_AXE, {{"wood", 1, 3}, {"stick", 1, 2}})->tree = 1;
  S(O_STUMP, "Stump", 1, 3, TL_AXE, {{"wood", 1, 2}});
  S(O_BUSH, "Bush", 0, 1, TL_ANY, {{"fiber", 1, 2}, {"stick", 0, 1}}); S(O_BERRY, "Berry bush", 0, 1, TL_ANY, {{"berries", 2, 4}, {"fiber", 0, 1}});
  S(O_BOULDER, "Boulder", 1, 5, TL_PICK, {{"stone", 2, 4}, {"flint", 0, 1}}); S(O_PEBBLE, "Pebbles", 0, 1, TL_ANY, {{"stone", 1, 1}, {"flint", 0, 1}});
  S(O_TALLGRASS, "Tall grass", 0, 1, TL_ANY, {{"fiber", 1, 1}, {"wheat_seeds", 0, 1}}); S(O_FLOWERS, "Flowers", 0, 1, TL_ANY, {{"flower", 1, 1}});
  S(O_REEDS, "Reeds", 0, 1, TL_ANY, {{"fiber", 1, 2}, {"rice_seeds", 0, 1}}); S(O_MUSHROOM, "Mushroom", 0, 1, TL_ANY, {{"mushroom", 1, 2}});
  S(O_LILY, "Lily pad", 0, 1, TL_ANY, {{"lotus", 0, 1}})->water = 1; S(O_CACTUS, "Cactus", 1, 2, TL_ANY, {{"fiber", 1, 1}}); S(O_SAPLING, "Sapling", 0, 1, TL_ANY, {{"sapling", 1, 1}});
  const char* cn[] = {"Wheat", "Carrots", "Tomatoes", "Pumpkin", "Rice"}; for (int i = 0; i < 5; i++) S(O_WHEAT + i, cn[i], 0, 1, TL_ANY, {})->crop = 1;
  auto P = [&](int o, const char* n, bool solid, float hp, int tool, const char* drop, int light = 0, bool warm = false, const char* st = nullptr, const char* use = nullptr) {
    ObjDef* d = S(o, n, solid, hp, tool, drop ? std::vector<DropDef>{{drop, 1, 1}} : std::vector<DropDef>{}); d->light = light; d->warm = warm; d->station = st; d->use = use; };
  P(O_TORCH, "Torch", 0, 1, TL_ANY, "torch", 5, 1); P(O_CAMPFIRE, "Campfire", 1, 2, TL_ANY, "campfire", 7, 1, "fire"); P(O_CHEST, "Chest", 1, 3, TL_ANY, "chest", 0, 0, nullptr, "chest");
  P(O_BENCH, "Workbench", 1, 3, TL_ANY, "bench", 0, 0, "bench"); P(O_FURNACE, "Furnace", 1, 4, TL_PICK, "furnace", 3, 1, "furnace"); P(O_ANVIL, "Anvil", 1, 5, TL_PICK, "anvil", 0, 0, "anvil");
  P(O_BED, "Futon", 1, 2, TL_ANY, "bed", 0, 0, nullptr, "bed"); P(O_FENCE, "Fence", 1, 2, TL_ANY, "fence"); P(O_GATE, "Gate", 1, 2, TL_ANY, "gate", 0, 0, nullptr, "gate");
  P(O_LANTERN, "Stone lantern", 1, 4, TL_PICK, "lantern", 6); P(O_SCARECROW, "Scarecrow", 1, 2, TL_ANY, "scarecrow"); P(O_SIGN, "Sign", 1, 2, TL_ANY, "wood");
  P(O_BANNER, "Banner", 1, 1e9f, 0, nullptr, 0, 0, nullptr, "banner"); P(O_WELL, "Well", 1, 1e9f, 0, nullptr, 0, 0, nullptr, "well");
  S(O_BARREL, "Barrel", 1, 2, TL_ANY, {{"wood", 1, 2}}); S(O_CRATE, "Crate", 1, 2, TL_ANY, {{"wood", 1, 2}}); S(O_HAY, "Haystack", 1, 2, TL_ANY, {{"wheat", 2, 4}});
  P(O_STALL, "Market stall", 1, 1e9f, 0, nullptr, 0, 0, nullptr, "trade"); P(O_TORII, "Torii", 0, 1e9f, 0, nullptr); P(O_KOI, "Koi pond", 1, 1e9f, 0, nullptr, 0, 0, nullptr, "koi");
  P(O_GRAVE, "Lost satchel", 0, 1e9f, 0, nullptr, 0, 0, nullptr, "grave"); P(O_SPIKES, "Spike trap", 0, 3, TL_ANY, "spikes"); P(O_TOWER, "Watchtower", 1, 12, TL_AXE, "tower", 4);
  P(O_POT, "Cooking pot", 1, 2, TL_ANY, "pot", 2, 1, "pot"); P(O_SHRINE, "Wayside shrine", 1, 1e9f, 0, nullptr, 3, 0, nullptr, "shrine"); P(O_DIG, "Glinting soil", 0, 1e9f, 0, nullptr);
  S(O_BAMBOO, "Bamboo", 1, 3, TL_AXE, {{"bamboo", 2, 3}})->tree = 1;
}
struct CropDef { const char* seed; const char* crop; int days, n0, n1, s0, s1; };
inline const CropDef* cropDef(int o) {
  static const CropDef C[5] = {{"wheat_seeds", "wheat", 3, 1, 2, 1, 2}, {"carrot", "carrot", 3, 2, 3, 0, 0}, {"tomato_seeds", "tomato", 4, 2, 4, 0, 1}, {"pumpkin_seeds", "pumpkin", 5, 1, 1, 1, 2}, {"rice_seeds", "rice", 4, 2, 3, 0, 1}};
  return (o >= O_WHEAT && o <= O_RICE) ? &C[o - O_WHEAT] : nullptr;
}
static const int DIRV[4][2] = {{0, 1}, {1, 0}, {0, -1}, {-1, 0}};

/* ---------- items ---------- */
enum Kind_ { K_MAT, K_FOOD, K_SEED, K_TOOL, K_WEAPON, K_PLACE, K_ARMOR, K_MISC, K_FISH, K_AMMO };
struct ItemDef {
  std::string id, name; int kind = K_MAT, value = 1, food = 0, heal = 0, tool = TL_NONE, tier = 0, pow = 0, dmg = 0, dur = 0, st = 99, def = 0;
  float reach = 0; int plant = 0, tree = 0, po = 0, pb = 0, pg = -1; std::string cook;
};
static std::vector<ItemDef> ITEMS; static std::unordered_map<std::string, int> ITEM_IX;
inline int itm(const std::string& id) { auto it = ITEM_IX.find(id); return it == ITEM_IX.end() ? 0 : it->second; }
inline ItemDef& newItem(const char* id, const char* name, int kind, int value) { ITEMS.emplace_back(); ItemDef& d = ITEMS.back(); d.id = id; d.name = name; d.kind = kind; d.value = value; d.st = (kind == K_TOOL || kind == K_WEAPON || kind == K_ARMOR) ? 1 : 99; ITEM_IX[id] = (int)ITEMS.size() - 1; return d; }
struct Recipe { const char* out; int n; std::vector<std::pair<const char*, int>> in; const char* at; };
static std::vector<Recipe> RECIPES;
inline void initItems() {
  if (!ITEMS.empty()) return; initObjs(); ITEMS.reserve(256);
  newItem("none", "", K_MISC, 0);
  auto M = [](const char* i, const char* n, int v) { newItem(i, n, K_MAT, v); };
  M("wood", "Wood", 2); M("stick", "Stick", 1); M("stone", "Stone", 1); M("flint", "Flint", 2); M("fiber", "Plant fiber", 1); M("rope", "Rope", 4); M("coal", "Coal", 3);
  M("iron_ore", "Iron ore", 5); M("iron", "Iron ingot", 12); M("gold_ore", "Gold ore", 10); M("gold", "Gold ingot", 25); M("jade", "Jade", 40); M("leather", "Leather", 6); M("wool", "Wool", 5);
  M("feather", "Feather", 1); M("bone", "Bone", 2); M("bamboo", "Bamboo", 3); M("petals", "Sakura petals", 2); M("flower", "Wildflower", 1); M("lotus", "Lotus", 6); M("egg", "Egg", 3);
  M("wheat", "Wheat", 3); M("rice", "Rice", 4); M("rotten", "Rotten flesh", 0);
  auto F = [](const char* i, const char* n, int v, int f, int heal = 0, int plant = 0) { ItemDef& d = newItem(i, n, K_FOOD, v); d.food = f; d.heal = heal; d.plant = plant; };
  F("berries", "Berries", 2, 2); F("apple", "Apple", 3, 3); F("carrot", "Carrot", 3, 3, 0, O_CARROT); F("tomato", "Tomato", 4, 3); F("pumpkin", "Pumpkin", 8, 4); F("mushroom", "Mushroom", 2, 2);
  F("milk", "Milk", 5, 3); F("raw_meat", "Raw meat", 4, 2); F("cooked_meat", "Grilled meat", 9, 7); F("raw_fish", "Raw fish", 4, 2); F("cooked_fish", "Grilled fish", 8, 6);
  F("bread", "Bread", 10, 6); F("onigiri", "Onigiri", 11, 6); F("stew", "Hearty stew", 22, 11, 4); F("sushi", "Sushi", 20, 9, 2); F("pie", "Pumpkin pie", 24, 10, 3); F("mochi", "Sakura mochi", 18, 7, 6);
  auto Fi = [](const char* i, const char* n, int v, int f) { ItemDef& d = newItem(i, n, K_FISH, v); d.food = f; d.cook = "cooked_fish"; };
  Fi("fish_carp", "Carp", 6, 2); Fi("fish_trout", "Trout", 8, 2); Fi("fish_salmon", "Salmon", 12, 3); Fi("fish_catfish", "Catfish", 10, 2); Fi("fish_eel", "Eel", 14, 2); newItem("fish_golden", "Golden koi", K_FISH, 80).food = 1;
  auto Sd = [](const char* i, const char* n, int v, int plant, int tree = 0) { ItemDef& d = newItem(i, n, K_SEED, v); d.plant = plant; d.tree = tree; };
  Sd("wheat_seeds", "Wheat seeds", 1, O_WHEAT); Sd("tomato_seeds", "Tomato seeds", 3, O_TOMATO); Sd("pumpkin_seeds", "Pumpkin seeds", 4, O_PUMPKIN); Sd("rice_seeds", "Rice seedlings", 3, O_RICE);
  Sd("acorn", "Acorn", 1, 0, O_OAK); Sd("pinecone", "Pinecone", 1, 0, O_PINE); Sd("sakura_sapling", "Sakura sapling", 8, 0, O_SAKURA); Sd("sapling", "Sapling", 1, 0, O_OAK);
  auto Tl = [](const char* i, const char* n, int kind, int tool, int tier, int pow, int dmg, int dur, int v) { ItemDef& d = newItem(i, n, kind, v); d.tool = tool; d.tier = tier; d.pow = pow; d.dmg = dmg; d.dur = dur; return &d; };
  Tl("axe_wood", "Wooden axe", K_TOOL, TL_AXE, 0, 1, 2, 60, 6); Tl("axe_stone", "Stone axe", K_TOOL, TL_AXE, 1, 2, 3, 130, 12); Tl("axe_iron", "Iron axe", K_TOOL, TL_AXE, 2, 3, 4, 300, 40);
  Tl("pick_wood", "Wooden pickaxe", K_TOOL, TL_PICK, 0, 1, 1, 60, 6); Tl("pick_stone", "Stone pickaxe", K_TOOL, TL_PICK, 1, 2, 2, 130, 12); Tl("pick_iron", "Iron pickaxe", K_TOOL, TL_PICK, 2, 3, 3, 300, 40);
  Tl("hoe_wood", "Wooden hoe", K_TOOL, TL_HOE, 0, 1, 1, 80, 5); Tl("hoe_iron", "Iron hoe", K_TOOL, TL_HOE, 2, 2, 2, 400, 30);
  Tl("sword_wood", "Wooden sword", K_WEAPON, TL_SWORD, 0, 0, 3, 60, 6); Tl("sword_stone", "Stone sword", K_WEAPON, TL_SWORD, 0, 0, 5, 130, 14); Tl("sword_iron", "Iron sword", K_WEAPON, TL_SWORD, 0, 0, 7, 300, 45);
  Tl("katana", "Jade katana", K_WEAPON, TL_SWORD, 0, 0, 11, 900, 160); Tl("spear", "Spear", K_WEAPON, TL_SPEAR, 0, 0, 5, 160, 16)->reach = 1.5f; Tl("bow", "Bow", K_WEAPON, TL_BOW, 0, 0, 4, 200, 20);
  newItem("arrow", "Arrow", K_AMMO, 1);
  Tl("rod", "Fishing rod", K_TOOL, TL_ROD, 0, 0, 0, 200, 12); Tl("can", "Watering can", K_TOOL, TL_CAN, 0, 0, 0, 500, 20); Tl("shears", "Shears", K_TOOL, TL_SHEARS, 0, 0, 0, 200, 18); Tl("bucket", "Bucket", K_TOOL, TL_BUCKET, 0, 0, 0, 0, 15);
  { ItemDef& d = newItem("armor_leather", "Leather armor", K_ARMOR, 30); d.def = 2; } { ItemDef& d = newItem("armor_iron", "Samurai armor", K_ARMOR, 90); d.def = 5; }
  newItem("dog_treat", "Dog treat", K_MISC, 4);
  auto Pl = [](const char* i, const char* n, int v, int o, int b = 0, int g = -1) { ItemDef& d = newItem(i, n, K_PLACE, v); d.po = o; d.pb = b; d.pg = g; };
  Pl("torch", "Torch", 2, O_TORCH); Pl("campfire", "Campfire", 6, O_CAMPFIRE); Pl("chest", "Chest", 12, O_CHEST); Pl("bench", "Workbench", 10, O_BENCH); Pl("furnace", "Furnace", 18, O_FURNACE);
  Pl("anvil", "Anvil", 40, O_ANVIL); Pl("bed", "Futon", 20, O_BED); Pl("fence", "Fence", 2, O_FENCE); Pl("gate", "Gate", 4, O_GATE); Pl("lantern", "Stone lantern", 14, O_LANTERN);
  Pl("scarecrow", "Scarecrow", 8, O_SCARECROW); Pl("wood_wall", "Wood wall", 4, 0, B_WOODWALL); Pl("stone_wall", "Stone wall", 6, 0, B_STONEWALL); Pl("wood_floor", "Wood floor", 2, 0, 0, G_WOOD);
  Pl("cobble", "Cobblestone", 2, 0, 0, G_COBBLE); Pl("spikes", "Spike trap", 10, O_SPIKES); Pl("tower", "Watchtower", 50, O_TOWER); Pl("pot", "Cooking pot", 16, O_POT); Pl("barrel", "Barrel", 6, O_BARREL);
  for (auto& it : ITEMS) {} // (stack sizes already set by kind)
  auto R = [](const char* out, int n, std::vector<std::pair<const char*, int>> in, const char* at) { RECIPES.push_back({out, n, in, at}); };
  R("bench", 1, {{"wood", 6}}, nullptr); R("stick", 4, {{"wood", 1}}, nullptr); R("rope", 1, {{"fiber", 3}}, nullptr); R("torch", 4, {{"stick", 1}, {"coal", 1}}, nullptr); R("campfire", 1, {{"wood", 3}, {"stone", 3}}, nullptr);
  R("axe_wood", 1, {{"wood", 3}, {"stick", 2}}, "bench"); R("pick_wood", 1, {{"wood", 3}, {"stick", 2}}, "bench"); R("sword_wood", 1, {{"wood", 2}, {"stick", 1}}, "bench"); R("hoe_wood", 1, {{"wood", 2}, {"stick", 2}}, "bench");
  R("axe_stone", 1, {{"stone", 3}, {"stick", 2}, {"rope", 1}}, "bench"); R("pick_stone", 1, {{"stone", 3}, {"stick", 2}, {"rope", 1}}, "bench"); R("sword_stone", 1, {{"stone", 3}, {"stick", 1}, {"rope", 1}}, "bench");
  R("spear", 1, {{"stick", 3}, {"flint", 2}, {"rope", 1}}, "bench"); R("bow", 1, {{"stick", 3}, {"rope", 2}}, "bench"); R("arrow", 6, {{"stick", 2}, {"flint", 1}, {"feather", 1}}, "bench");
  R("rod", 1, {{"stick", 3}, {"rope", 2}}, "bench"); R("chest", 1, {{"wood", 8}}, "bench"); R("fence", 4, {{"stick", 6}}, "bench"); R("fence", 6, {{"bamboo", 4}}, "bench"); R("rod", 1, {{"bamboo", 2}, {"rope", 1}}, "bench");
  R("arrow", 8, {{"bamboo", 2}, {"flint", 1}, {"feather", 1}}, "bench"); R("wood_floor", 4, {{"bamboo", 3}}, "bench"); R("gate", 1, {{"wood", 2}, {"stick", 3}}, "bench");
  R("wood_wall", 2, {{"wood", 3}}, "bench"); R("wood_floor", 4, {{"wood", 2}}, "bench"); R("bed", 1, {{"wood", 4}, {"wool", 3}}, "bench"); R("scarecrow", 1, {{"stick", 3}, {"wheat", 2}, {"fiber", 2}}, "bench");
  R("furnace", 1, {{"stone", 12}, {"coal", 1}}, "bench"); R("lantern", 1, {{"stone", 6}, {"torch", 1}}, "bench"); R("spikes", 2, {{"stick", 4}, {"flint", 2}}, "bench"); R("tower", 1, {{"wood", 20}, {"rope", 4}}, "bench");
  R("armor_leather", 1, {{"leather", 6}, {"rope", 2}}, "bench"); R("barrel", 1, {{"wood", 4}, {"iron", 1}}, "bench"); R("anvil", 1, {{"iron", 4}, {"stone", 6}}, "bench");
  R("iron", 1, {{"iron_ore", 1}, {"coal", 1}}, "furnace"); R("gold", 1, {{"gold_ore", 1}, {"coal", 1}}, "furnace"); R("stone_wall", 2, {{"stone", 3}}, "furnace"); R("cobble", 4, {{"stone", 2}}, "furnace");
  R("axe_iron", 1, {{"iron", 3}, {"stick", 2}}, "anvil"); R("pick_iron", 1, {{"iron", 3}, {"stick", 2}}, "anvil"); R("sword_iron", 1, {{"iron", 3}, {"stick", 1}}, "anvil"); R("hoe_iron", 1, {{"iron", 2}, {"stick", 2}}, "anvil");
  R("katana", 1, {{"iron", 4}, {"gold", 2}, {"jade", 1}}, "anvil"); R("armor_iron", 1, {{"iron", 8}, {"leather", 3}}, "anvil"); R("shears", 1, {{"iron", 2}}, "anvil"); R("can", 1, {{"iron", 3}}, "anvil");
  R("bucket", 1, {{"iron", 3}}, "anvil"); R("pot", 1, {{"iron", 2}, {"stone", 4}}, "anvil");
  R("cooked_meat", 1, {{"raw_meat", 1}}, "fire"); R("cooked_fish", 1, {{"raw_fish", 1}}, "fire"); R("bread", 1, {{"wheat", 3}}, "fire"); R("onigiri", 1, {{"rice", 2}}, "fire"); R("dog_treat", 3, {{"raw_meat", 1}, {"wheat", 1}}, "fire");
  R("stew", 1, {{"mushroom", 1}, {"carrot", 1}, {"raw_meat", 1}}, "pot"); R("sushi", 2, {{"raw_fish", 1}, {"rice", 1}}, "pot"); R("pie", 1, {{"pumpkin", 1}, {"wheat", 2}, {"egg", 1}}, "pot"); R("mochi", 2, {{"rice", 2}, {"petals", 2}}, "pot");
}
inline const char* stationName(const char* s) { if (!s) return "Hands"; std::string a = s; return a == "bench" ? "Workbench" : a == "furnace" ? "Furnace" : a == "anvil" ? "Anvil" : a == "fire" ? "Campfire" : "Cooking pot"; }
