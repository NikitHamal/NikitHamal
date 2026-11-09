// Hanomi native - defs.js + items.js + world.js ported 1:1 (same tables, same noise, same village generator => same world as the web game for a given seed).
#pragma once
#include "spr.h"
constexpr int VERSION = 1;
enum { G_WATER, G_DEEP, G_SAND, G_GRASS, G_FOREST, G_DIRT, G_PATH, G_ROCK, G_TILLED, G_WET, G_WOOD, G_COBBLE, G_SAKURA, G_MARSH, G_PLAZA, G_SNOW, G_TATAMI, G_ONSEN };
enum { B_NONE, B_STONE, B_COAL, B_IRON, B_GOLD, B_GEM, B_WOODWALL, B_STONEWALL, B_BLDG, B_DARK, B_IWALL };
enum { O_NONE = 0, O_OAK = 1, O_PINE, O_SAKURA, O_BIRCH, O_STUMP, O_BUSH, O_BERRY, O_BOULDER, O_PEBBLE, O_TALLGRASS, O_FLOWERS, O_REEDS, O_MUSHROOM, O_LILY, O_SAPLING,
  O_WHEAT = 20, O_CARROT, O_TOMATO, O_PUMPKIN, O_RICE,
  O_TORCH = 40, O_CAMPFIRE, O_CHEST, O_BENCH, O_FURNACE, O_ANVIL, O_BED, O_FENCE, O_GATE, O_LANTERN, O_SCARECROW, O_SIGN, O_BANNER, O_WELL, O_BARREL, O_CRATE, O_HAY, O_STALL,
  O_TORII, O_KOI, O_GRAVE, O_SPIKES, O_TOWER, O_POT, O_DEADTREE, O_CACTUS, O_TABLE, O_HEARTH, O_SHELF, O_BONSAI, O_ANDON, O_CUSHION, O_SCREEN, O_STOVE, O_EXIT, O_WINDOW, O_SCROLL, O_SHRINE, O_DIG, O_BAMBOO };
inline bool isWater(int g) { return g == G_WATER || g == G_DEEP || g == G_ONSEN; }
inline bool isHard(int g) { return g == G_TILLED || g == G_WET || g == G_WOOD || g == G_COBBLE || g == G_PLAZA || g == G_TATAMI; }
static const char* GROUND_NAME[] = {"Water", "Deep water", "Sand", "Grass", "Forest floor", "Dirt", "Path", "Rock", "Tilled soil", "Watered soil", "Wood floor", "Cobblestone", "Sakura grass", "Marsh", "Plaza", "Snow", "Tatami", "Hot spring"};

struct Drop3 { std::string id; int a, b; };
struct BlockDef { const char* name = ""; double hp = 1e9; std::string tool = "none"; int tier = 9; std::vector<Drop3> drop; bool built = false; };
static BlockDef BLOCK[16];
struct ObjDef { const char* name = ""; bool solid = false, tree = false, stump = false, crop = false, fence = false, wall = false, water = false, trap = false, warm = false, has = false; double hp = 1e9; std::string tool = "none", use, station, harvest; int light = 0; std::vector<Drop3> drop;
  ObjDef& d(const char* i, int a, int b) { drop.push_back({i, a, b}); return *this; } };
static ObjDef OBJ[96];
struct CropDef { const char *seed, *crop; int days, n0, n1, s0, s1; };
static CropDef CROPS[32];
inline bool isCrop(int o) { return o >= O_WHEAT && o <= O_RICE; }

struct Item { std::string id, n, k, tool, cook; int v = 0, food = 0, heal = 0, plant = 0, tree = 0, tier = 0, pow = 0, dmg = 0, dur = 0, def = 0, st = 99; double reach = 0; int pO = -1, pB = -1, pG = -1; };
struct Recipe { std::string out; int n; std::vector<std::pair<std::string, int>> in; std::string at; };
static std::vector<Item> ITEMS; static std::unordered_map<std::string, int> ITEM_IDX; static std::vector<Recipe> RECIPES;
inline Item* itm(const std::string& id) { auto it = ITEM_IDX.find(id); return it == ITEM_IDX.end() ? nullptr : &ITEMS[it->second]; }
static std::unordered_map<std::string, std::vector<std::string>> FISH_TABLE;

static void initDefs() {
  auto blk = [&](int b, const char* n, double hp, const char* tool, int tier, std::vector<Drop3> dr, bool built = false) { BLOCK[b].name = n; BLOCK[b].hp = hp; BLOCK[b].tool = tool; BLOCK[b].tier = tier; BLOCK[b].drop = dr; BLOCK[b].built = built; };
  blk(B_STONE, "Stone", 6, "pick", 0, {{"stone", 1, 2}}); blk(B_DARK, "Deep stone", 10, "pick", 1, {{"stone", 2, 3}}); blk(B_COAL, "Coal vein", 8, "pick", 0, {{"coal", 1, 3}, {"stone", 0, 1}});
  blk(B_IRON, "Iron vein", 10, "pick", 1, {{"iron_ore", 1, 2}, {"stone", 0, 1}}); blk(B_GOLD, "Gold vein", 12, "pick", 2, {{"gold_ore", 1, 2}}); blk(B_GEM, "Jade crystal", 14, "pick", 2, {{"jade", 1, 2}});
  blk(B_WOODWALL, "Wood wall", 8, "axe", 0, {{"wood_wall", 1, 1}}, true); blk(B_STONEWALL, "Stone wall", 16, "pick", 0, {{"stone_wall", 1, 1}}, true); blk(B_BLDG, "Building", 1e9, "none", 9, {}); blk(B_IWALL, "Wall", 1e9, "none", 9, {});
  auto D = [&](int o, const char* n, bool solid, double hp, const char* tool) -> ObjDef& { ObjDef& x = OBJ[o]; x.has = true; x.name = n; x.solid = solid; x.hp = hp; x.tool = tool; return x; };
  D(O_OAK, "Oak", 1, 6, "axe").d("wood", 3, 5).d("acorn", 0, 1).d("apple", 0, 1); OBJ[O_OAK].tree = OBJ[O_OAK].stump = true;
  D(O_PINE, "Pine", 1, 6, "axe").d("wood", 3, 5).d("pinecone", 0, 1); OBJ[O_PINE].tree = OBJ[O_PINE].stump = true;
  D(O_SAKURA, "Sakura", 1, 6, "axe").d("wood", 2, 4).d("petals", 1, 3).d("sakura_sapling", 0, 1); OBJ[O_SAKURA].tree = OBJ[O_SAKURA].stump = true;
  D(O_BIRCH, "Birch", 1, 5, "axe").d("wood", 2, 4).d("acorn", 0, 1); OBJ[O_BIRCH].tree = OBJ[O_BIRCH].stump = true;
  D(O_DEADTREE, "Dead tree", 1, 3, "axe").d("wood", 1, 3).d("stick", 1, 2); OBJ[O_DEADTREE].tree = true;
  D(O_STUMP, "Stump", 1, 3, "axe").d("wood", 1, 2);
  D(O_BUSH, "Bush", 0, 1, "any").d("fiber", 1, 2).d("stick", 0, 1); D(O_BERRY, "Berry bush", 0, 1, "any").d("berries", 2, 4).d("fiber", 0, 1); OBJ[O_BERRY].harvest = "berries";
  D(O_BOULDER, "Boulder", 1, 5, "pick").d("stone", 2, 4).d("flint", 0, 1); D(O_PEBBLE, "Pebbles", 0, 1, "any").d("stone", 1, 1).d("flint", 0, 1);
  D(O_TALLGRASS, "Tall grass", 0, 1, "any").d("fiber", 1, 1).d("wheat_seeds", 0, 1); D(O_FLOWERS, "Flowers", 0, 1, "any").d("flower", 1, 1);
  D(O_REEDS, "Reeds", 0, 1, "any").d("fiber", 1, 2).d("rice_seeds", 0, 1); D(O_MUSHROOM, "Mushroom", 0, 1, "any").d("mushroom", 1, 2);
  D(O_LILY, "Lily pad", 0, 1, "any").d("lotus", 0, 1); OBJ[O_LILY].water = true; D(O_CACTUS, "Cactus", 1, 2, "any").d("fiber", 1, 1); D(O_SAPLING, "Sapling", 0, 1, "any").d("sapling", 1, 1);
  const char* cn[] = {"Wheat", "Carrots", "Tomatoes", "Pumpkin", "Rice"}; for (int i = 0; i < 5; i++) { D(O_WHEAT + i, cn[i], 0, 1, "any"); OBJ[O_WHEAT + i].crop = true; }
  CROPS[O_WHEAT] = {"wheat_seeds", "wheat", 3, 1, 2, 1, 2}; CROPS[O_CARROT] = {"carrot", "carrot", 3, 2, 3, 0, 0}; CROPS[O_TOMATO] = {"tomato_seeds", "tomato", 4, 2, 4, 0, 1}; CROPS[O_PUMPKIN] = {"pumpkin_seeds", "pumpkin", 5, 1, 1, 1, 2}; CROPS[O_RICE] = {"rice_seeds", "rice", 4, 2, 3, 0, 1};
  auto place = [&](int o, const char* n, bool solid, double hp, const char* tool, const char* dropId, int light = 0, bool warm = false, const char* station = "", const char* use = "") -> ObjDef& { ObjDef& x = D(o, n, solid, hp, tool); if (dropId[0]) x.d(dropId, 1, 1); x.light = light; x.warm = warm; x.station = station; x.use = use; return x; };
  place(O_TORCH, "Torch", 0, 1, "any", "torch", 5, true); place(O_CAMPFIRE, "Campfire", 1, 2, "any", "campfire", 7, true, "fire"); place(O_CHEST, "Chest", 1, 3, "any", "chest", 0, false, "", "chest");
  place(O_BENCH, "Workbench", 1, 3, "any", "bench", 0, false, "bench"); place(O_FURNACE, "Furnace", 1, 4, "pick", "furnace", 3, true, "furnace"); place(O_ANVIL, "Anvil", 1, 5, "pick", "anvil", 0, false, "anvil");
  place(O_BED, "Bed", 1, 2, "any", "bed", 0, false, "", "bed"); place(O_FENCE, "Fence", 1, 2, "any", "fence").fence = true; place(O_GATE, "Gate", 1, 2, "any", "gate", 0, false, "", "gate").fence = true;
  place(O_LANTERN, "Stone lantern", 1, 4, "pick", "lantern", 6); place(O_SCARECROW, "Scarecrow", 1, 2, "any", "scarecrow"); place(O_SIGN, "Sign", 1, 2, "any", "");  OBJ[O_SIGN].d("wood", 1, 1);
  place(O_BANNER, "Banner", 1, 1e9, "none", "", 0, false, "", "banner"); place(O_WELL, "Well", 1, 1e9, "none", "", 0, false, "", "well"); place(O_BARREL, "Barrel", 1, 2, "any", ""); OBJ[O_BARREL].d("wood", 1, 2);
  place(O_CRATE, "Crate", 1, 2, "any", ""); OBJ[O_CRATE].d("wood", 1, 2); place(O_HAY, "Haystack", 1, 2, "any", ""); OBJ[O_HAY].d("wheat", 2, 4); place(O_STALL, "Market stall", 1, 1e9, "none", "", 0, false, "", "trade");
  place(O_TORII, "Torii", 0, 1e9, "none", ""); place(O_KOI, "Koi pond", 1, 1e9, "none", "", 0, false, "", "koi"); place(O_GRAVE, "Lost satchel", 0, 1e9, "none", "", 0, false, "", "grave");
  place(O_SPIKES, "Spike trap", 0, 3, "any", "spikes").trap = true; place(O_TOWER, "Watchtower", 1, 12, "axe", "tower", 4); place(O_TABLE, "Low table", 1, 1e9, "none", "");
  place(O_HEARTH, "Irori hearth", 1, 1e9, "none", "", 5, true, "fire"); place(O_SHELF, "Tansu", 1, 1e9, "none", ""); place(O_BONSAI, "Bonsai", 1, 1e9, "none", ""); place(O_ANDON, "Andon lamp", 1, 1e9, "none", "", 4, true);
  place(O_CUSHION, "Zabuton", 0, 1e9, "none", ""); place(O_SCREEN, "Folding screen", 1, 1e9, "none", ""); place(O_STOVE, "Kamado stove", 1, 1e9, "none", "", 3, true, "pot"); place(O_EXIT, "Doorway", 0, 1e9, "none", "");
  place(O_WINDOW, "Shoji window", 0, 1e9, "none", "").wall = true; place(O_SCROLL, "Hanging scroll", 0, 1e9, "none", "").wall = true; place(O_SHRINE, "Wayside shrine", 1, 1e9, "none", "", 3, false, "", "shrine");
  place(O_BAMBOO, "Bamboo", 1, 3, "axe", "").tree = true; OBJ[O_BAMBOO].d("bamboo", 2, 3); place(O_DIG, "Glinting soil", 0, 1e9, "none", ""); place(O_POT, "Cooking pot", 1, 2, "any", "pot", 2, true, "pot");

  // ---- items ----
  auto I = [&](const char* id, const char* n, const char* k, int v) -> Item& { Item it; it.id = id; it.n = n; it.k = k; it.v = v; ITEMS.push_back(it); return ITEMS.back(); };
  I("wood", "Wood", "mat", 2); I("stick", "Stick", "mat", 1); I("stone", "Stone", "mat", 1); I("flint", "Flint", "mat", 2); I("fiber", "Plant fiber", "mat", 1); I("rope", "Rope", "mat", 4); I("coal", "Coal", "mat", 3);
  I("iron_ore", "Iron ore", "mat", 5); I("iron", "Iron ingot", "mat", 12); I("gold_ore", "Gold ore", "mat", 10); I("gold", "Gold ingot", "mat", 25); I("jade", "Jade", "mat", 40); I("leather", "Leather", "mat", 6); I("wool", "Wool", "mat", 5); I("feather", "Feather", "mat", 1);
  I("bone", "Bone", "mat", 2); I("bamboo", "Bamboo", "mat", 3); I("petals", "Sakura petals", "mat", 2); I("flower", "Wildflower", "mat", 1); I("lotus", "Lotus", "mat", 6); I("egg", "Egg", "mat", 3); I("wheat", "Wheat", "mat", 3); I("rice", "Rice", "mat", 4); I("rotten", "Rotten flesh", "mat", 0);
  I("berries", "Berries", "food", 2).food = 2; I("apple", "Apple", "food", 3).food = 3; { Item& c = I("carrot", "Carrot", "food", 3); c.food = 3; c.plant = O_CARROT; } I("tomato", "Tomato", "food", 4).food = 3; I("pumpkin", "Pumpkin", "food", 8).food = 4; I("mushroom", "Mushroom", "food", 2).food = 2;
  I("milk", "Milk", "food", 5).food = 3; I("raw_meat", "Raw meat", "food", 4).food = 2; I("cooked_meat", "Grilled meat", "food", 9).food = 7; I("raw_fish", "Raw fish", "food", 4).food = 2; I("cooked_fish", "Grilled fish", "food", 8).food = 6; I("bread", "Bread", "food", 10).food = 6;
  I("onigiri", "Onigiri", "food", 11).food = 6; { Item& c = I("stew", "Hearty stew", "food", 22); c.food = 11; c.heal = 4; } { Item& c = I("sushi", "Sushi", "food", 20); c.food = 9; c.heal = 2; } { Item& c = I("pie", "Pumpkin pie", "food", 24); c.food = 10; c.heal = 3; } { Item& c = I("mochi", "Sakura mochi", "food", 18); c.food = 7; c.heal = 6; }
  auto fish = [&](const char* id, const char* n, int v, int f, const char* cook) { Item& c = I(id, n, "fish", v); c.food = f; c.cook = cook; };
  fish("fish_carp", "Carp", 6, 2, "cooked_fish"); fish("fish_trout", "Trout", 8, 2, "cooked_fish"); fish("fish_salmon", "Salmon", 12, 3, "cooked_fish"); fish("fish_catfish", "Catfish", 10, 2, "cooked_fish"); fish("fish_eel", "Eel", 14, 2, "cooked_fish"); fish("fish_golden", "Golden koi", 80, 1, "");
  I("wheat_seeds", "Wheat seeds", "seed", 1).plant = O_WHEAT; I("tomato_seeds", "Tomato seeds", "seed", 3).plant = O_TOMATO; I("pumpkin_seeds", "Pumpkin seeds", "seed", 4).plant = O_PUMPKIN; I("rice_seeds", "Rice seedlings", "seed", 3).plant = O_RICE;
  I("acorn", "Acorn", "seed", 1).tree = O_OAK; I("pinecone", "Pinecone", "seed", 1).tree = O_PINE; I("sakura_sapling", "Sakura sapling", "seed", 8).tree = O_SAKURA; I("sapling", "Sapling", "seed", 1).tree = O_OAK;
  auto T = [&](const char* id, const char* n, const char* k, const char* tool, int tier, int pow, int dmg, int dur, int v) { Item& c = I(id, n, k, v); c.tool = tool; c.tier = tier; c.pow = pow; c.dmg = dmg; c.dur = dur; return &c; };
  T("axe_wood", "Wooden axe", "tool", "axe", 0, 1, 2, 60, 6); T("axe_stone", "Stone axe", "tool", "axe", 1, 2, 3, 130, 12); T("axe_iron", "Iron axe", "tool", "axe", 2, 3, 4, 300, 40);
  T("pick_wood", "Wooden pickaxe", "tool", "pick", 0, 1, 1, 60, 6); T("pick_stone", "Stone pickaxe", "tool", "pick", 1, 2, 2, 130, 12); T("pick_iron", "Iron pickaxe", "tool", "pick", 2, 3, 3, 300, 40);
  T("hoe_wood", "Wooden hoe", "tool", "hoe", 0, 1, 1, 80, 5); T("hoe_iron", "Iron hoe", "tool", "hoe", 2, 2, 2, 400, 30);
  T("sword_wood", "Wooden sword", "weapon", "sword", 0, 0, 3, 60, 6); T("sword_stone", "Stone sword", "weapon", "sword", 0, 0, 5, 130, 14); T("sword_iron", "Iron sword", "weapon", "sword", 0, 0, 7, 300, 45); T("katana", "Jade katana", "weapon", "sword", 0, 0, 11, 900, 160);
  T("spear", "Spear", "weapon", "spear", 0, 0, 5, 160, 16)->reach = 1.5; T("bow", "Bow", "weapon", "bow", 0, 0, 4, 200, 20); I("arrow", "Arrow", "ammo", 1);
  T("rod", "Fishing rod", "tool", "rod", 0, 0, 0, 200, 12); T("can", "Watering can", "tool", "can", 0, 0, 0, 500, 20); T("shears", "Shears", "tool", "shears", 0, 0, 0, 200, 18); T("bucket", "Bucket", "tool", "bucket", 0, 0, 0, 0, 15);
  I("armor_leather", "Leather armor", "armor", 30).def = 2; I("armor_iron", "Samurai armor", "armor", 90).def = 5; I("dog_treat", "Dog treat", "misc", 4);
  auto P = [&](const char* id, const char* n, int v, int o, int b, int g) { Item& c = I(id, n, "place", v); c.pO = o; c.pB = b; c.pG = g; };
  P("torch", "Torch", 2, O_TORCH, -1, -1); P("campfire", "Campfire", 6, O_CAMPFIRE, -1, -1); P("chest", "Chest", 12, O_CHEST, -1, -1); P("bench", "Workbench", 10, O_BENCH, -1, -1); P("furnace", "Furnace", 18, O_FURNACE, -1, -1); P("anvil", "Anvil", 40, O_ANVIL, -1, -1);
  P("bed", "Futon", 20, O_BED, -1, -1); P("fence", "Fence", 2, O_FENCE, -1, -1); P("gate", "Gate", 4, O_GATE, -1, -1); P("lantern", "Stone lantern", 14, O_LANTERN, -1, -1); P("scarecrow", "Scarecrow", 8, O_SCARECROW, -1, -1);
  P("wood_wall", "Wood wall", 4, -1, B_WOODWALL, -1); P("stone_wall", "Stone wall", 6, -1, B_STONEWALL, -1); P("wood_floor", "Wood floor", 2, -1, -1, G_WOOD); P("cobble", "Cobblestone", 2, -1, -1, G_COBBLE);
  P("spikes", "Spike trap", 10, O_SPIKES, -1, -1); P("tower", "Watchtower", 50, O_TOWER, -1, -1); P("pot", "Cooking pot", 16, O_POT, -1, -1); P("barrel", "Barrel", 6, O_BARREL, -1, -1);
  for (size_t i = 0; i < ITEMS.size(); i++) { ITEM_IDX[ITEMS[i].id] = (int)i; Item& it = ITEMS[i]; it.st = (it.k == "tool" || it.k == "weapon" || it.k == "armor") ? 1 : 99; }
  FISH_TABLE["river"] = {"fish_carp", "fish_trout", "fish_trout", "fish_salmon", "fish_eel"}; FISH_TABLE["lake"] = {"fish_carp", "fish_carp", "fish_catfish", "fish_trout", "fish_eel"}; FISH_TABLE["sea"] = {"fish_salmon", "fish_salmon", "fish_eel", "fish_catfish"}; FISH_TABLE["marsh"] = {"fish_catfish", "fish_catfish", "fish_eel", "fish_carp"};
  auto R = [&](const char* out, int n, std::vector<std::pair<std::string, int>> in, const char* at) { RECIPES.push_back({out, n, in, at}); };
  R("bench", 1, {{"wood", 6}}, ""); R("stick", 4, {{"wood", 1}}, ""); R("rope", 1, {{"fiber", 3}}, ""); R("torch", 4, {{"stick", 1}, {"coal", 1}}, ""); R("campfire", 1, {{"wood", 3}, {"stone", 3}}, "");
  R("axe_wood", 1, {{"wood", 3}, {"stick", 2}}, "bench"); R("pick_wood", 1, {{"wood", 3}, {"stick", 2}}, "bench"); R("sword_wood", 1, {{"wood", 2}, {"stick", 1}}, "bench"); R("hoe_wood", 1, {{"wood", 2}, {"stick", 2}}, "bench");
  R("axe_stone", 1, {{"stone", 3}, {"stick", 2}, {"rope", 1}}, "bench"); R("pick_stone", 1, {{"stone", 3}, {"stick", 2}, {"rope", 1}}, "bench"); R("sword_stone", 1, {{"stone", 3}, {"stick", 1}, {"rope", 1}}, "bench"); R("spear", 1, {{"stick", 3}, {"flint", 2}, {"rope", 1}}, "bench");
  R("bow", 1, {{"stick", 3}, {"rope", 2}}, "bench"); R("arrow", 6, {{"stick", 2}, {"flint", 1}, {"feather", 1}}, "bench"); R("rod", 1, {{"stick", 3}, {"rope", 2}}, "bench"); R("chest", 1, {{"wood", 8}}, "bench");
  R("fence", 4, {{"stick", 6}}, "bench"); R("fence", 6, {{"bamboo", 4}}, "bench"); R("rod", 1, {{"bamboo", 2}, {"rope", 1}}, "bench"); R("arrow", 8, {{"bamboo", 2}, {"flint", 1}, {"feather", 1}}, "bench"); R("wood_floor", 4, {{"bamboo", 3}}, "bench"); R("gate", 1, {{"wood", 2}, {"stick", 3}}, "bench");
  R("wood_wall", 2, {{"wood", 3}}, "bench"); R("wood_floor", 4, {{"wood", 2}}, "bench"); R("bed", 1, {{"wood", 4}, {"wool", 3}}, "bench"); R("scarecrow", 1, {{"stick", 3}, {"wheat", 2}, {"fiber", 2}}, "bench");
  R("furnace", 1, {{"stone", 12}, {"coal", 1}}, "bench"); R("lantern", 1, {{"stone", 6}, {"torch", 1}}, "bench"); R("spikes", 2, {{"stick", 4}, {"flint", 2}}, "bench"); R("tower", 1, {{"wood", 20}, {"rope", 4}}, "bench");
  R("armor_leather", 1, {{"leather", 6}, {"rope", 2}}, "bench"); R("barrel", 1, {{"wood", 4}, {"iron", 1}}, "bench"); R("anvil", 1, {{"iron", 4}, {"stone", 6}}, "bench");
  R("iron", 1, {{"iron_ore", 1}, {"coal", 1}}, "furnace"); R("gold", 1, {{"gold_ore", 1}, {"coal", 1}}, "furnace"); R("stone_wall", 2, {{"stone", 3}}, "furnace"); R("cobble", 4, {{"stone", 2}}, "furnace");
  R("axe_iron", 1, {{"iron", 3}, {"stick", 2}}, "anvil"); R("pick_iron", 1, {{"iron", 3}, {"stick", 2}}, "anvil"); R("sword_iron", 1, {{"iron", 3}, {"stick", 1}}, "anvil"); R("hoe_iron", 1, {{"iron", 2}, {"stick", 2}}, "anvil");
  R("katana", 1, {{"iron", 4}, {"gold", 2}, {"jade", 1}}, "anvil"); R("armor_iron", 1, {{"iron", 8}, {"leather", 3}}, "anvil"); R("shears", 1, {{"iron", 2}}, "anvil"); R("can", 1, {{"iron", 3}}, "anvil"); R("bucket", 1, {{"iron", 3}}, "anvil"); R("pot", 1, {{"iron", 2}, {"stone", 4}}, "anvil");
  R("cooked_meat", 1, {{"raw_meat", 1}}, "fire"); R("cooked_fish", 1, {{"raw_fish", 1}}, "fire"); R("bread", 1, {{"wheat", 3}}, "fire"); R("onigiri", 1, {{"rice", 2}}, "fire"); R("dog_treat", 3, {{"raw_meat", 1}, {"wheat", 1}}, "fire");
  R("stew", 1, {{"mushroom", 1}, {"carrot", 1}, {"raw_meat", 1}}, "pot"); R("sushi", 2, {{"raw_fish", 1}, {"rice", 1}}, "pot"); R("pie", 1, {{"pumpkin", 1}, {"wheat", 2}, {"egg", 1}}, "pot"); R("mochi", 2, {{"rice", 2}, {"petals", 2}}, "pot");
  for (auto& it : ITEMS) if (it.k == "fish" && it.id != "fish_golden") { R("cooked_fish", 1, {{it.id, 1}}, "fire"); if (it.id == "fish_salmon" || it.id == "fish_trout" || it.id == "fish_eel") R("sushi", 2, {{it.id, 1}, {"rice", 1}}, "pot"); }
}
static const char* STATION_NAME(const std::string& s) { return s == "bench" ? "Workbench" : s == "furnace" ? "Furnace" : s == "anvil" ? "Anvil" : s == "fire" ? "Campfire" : "Cooking pot"; }

/* ============================ world ============================ */
constexpr int REG = 104, VR = 21;
static const char* SYL1[] = {"Aka", "Hana", "Kiri", "Mizu", "Yama", "Kaze", "Tsuki", "Hoshi", "Kumo", "Ishi", "Mori", "Sora", "Yuki", "Kawa", "Hino", "Nagi", "Ao", "Shira", "Kuro", "Taka", "Fuyu", "Asa"};
static const char* SYL2[] = {"mura", "zawa", "hara", "oka", "shima", "no", "gawa", "mine", "dera", "saki", "tani", "machi", "ba", "ishi", "kage", "ya"};
static const char* RULER[] = {"Ren", "Haru", "Aoi", "Sora", "Kaito", "Yuna", "Daichi", "Mei", "Riku", "Hina", "Takeshi", "Akane", "Isamu", "Nobu", "Sayo", "Jun"};
static const int NATION_COLORS[] = {0xc8423a, 0x3a6fc8, 0xd8a23a, 0x7a46b8, 0x2f9a6a, 0xd86a2a, 0x2aa0b0, 0xb83a7a, 0x6a7a2a, 0x5a4a3a};
static const char* TEMPER[] = {"peaceful", "proud", "greedy", "warlike", "honest"};
template <class T, size_t N> inline const T& rpick(RNG& r, const T (&a)[N]) { return a[(size_t)std::floor(r.next() * N)]; }

struct Tile { int g = -1, b = -1, o = -1, m = -1; };
struct Struct { std::string kind; int x, y, w, h; std::string v; int style; bool home = false; bool hasDoor = false; int dx = 0, dy = 0; };
struct Spawn { std::string k; int x, y; int home = -1; bool pen = false; int px = 0, py = 0, pw = 0, ph = 0; };
inline i64 pkey(int x, int y) { return ((i64)x << 32) ^ (u32)y; }
struct Village { std::string id; int x, y; bool home; std::string name, ruler; int color; std::string temper; int size; std::unordered_map<i64, Tile> ov; std::vector<Struct> structs; std::vector<Spawn> spawns;
  bool hasBanner = false; int bx = 0, by = 0; bool hasStall = false; int sx = 0, sy = 0; bool hasKoi = false; int kx = 0, ky = 0, kw = 0, kh = 0; int homeHouse = -1; int spawnX = 0, spawnY = 0; std::vector<std::pair<int, int>> fields; bool fieldsDone = false; };

struct Chunk {
  int cx, cy; u8 g[CS * CS], b[CS * CS], o[CS * CS], m[CS * CS]; std::unordered_set<int> mod; bool dirty = true, gen = false, water = false, hasWater = false; int rv = 0, wrv = -1;
  Img cv, wcv, wallcv; bool haveCv = false, haveWcv = false, haveWall = false; u8 wrows[CS] = {0}; bool wallsBaked = false;
};
struct SavedTile { int idx, g, b, o, m; };
struct SyncPtr { };
struct World {
  u32 seed = 0; std::unordered_map<i64, std::unique_ptr<Chunk>> chunks; std::unordered_map<i64, std::vector<SavedTile>> saved; std::unordered_map<std::string, std::unique_ptr<Village>> villages; std::unordered_map<std::string, std::vector<std::pair<std::string, std::pair<int, int>>>> chests; // chest: list of (item,(n,dur))
  u32 S[8];
  struct Samp { double e, m, t, h; bool river; };
  void init(u32 sd) { seed = sd; chunks.clear(); saved.clear(); villages.clear(); chests.clear(); for (int k = 1; k <= 8; k++) S[k - 1] = hash2i(k, 99, seed) % 100000; }
  Samp sample(int x, int y) const {
    double d0 = std::hypot((double)x, (double)y);
    double e = fbm(x / 120.0, y / 120.0, S[0], 5) * 0.72 + fbm(x / 420.0, y / 420.0, S[1], 3) * 0.38 - 0.05; e += std::max(0.0, 1 - d0 / 70) * 0.32;
    double m = fbm(x / 85.0 + 300, y / 85.0, S[2], 4), t = fbm(x / 260.0, y / 260.0 + 50, S[3], 3) + std::max(0.0, 1 - d0 / 180) * 0.25;
    double h = fbm(x / 64.0, y / 64.0, S[4], 4) - std::max(0.0, 1 - d0 / 60) * 0.25, rv = fbm(x / 190.0, y / 190.0, S[5], 3);
    return {e, m, t, h, std::fabs(rv - 0.5) < 0.0105 + fbm(x / 30.0, y / 30.0, S[6], 2) * 0.006 && d0 > 34 && e < 0.66};
  }
  const char* biomeAt(int x, int y) const {
    Samp s = sample(x, y); if (s.e < 0.34) return "deep"; if (s.e < 0.4 || s.river) return "water"; if (s.e < 0.425) return "beach"; if (s.h > 0.6 && s.e > 0.44) return "rock"; if (s.t < 0.33) return "snow";
    if (s.e < 0.47 && s.m > 0.58) return "marsh"; if (s.m > 0.585) return "forest"; if (fbm(x / 46.0, y / 46.0, S[7], 3) > 0.63) return "sakura"; return "meadow";
  }
  Tile base(int x, int y) const {
    Samp s = sample(x, y); auto H = [&](int k) { return hash2(x, y, seed + k); }; int g = G_GRASS, b = 0, o = 0, m = 0;
    if (s.e < 0.34) g = G_DEEP;
    else if (s.e < 0.4 || s.river) { g = G_WATER; if (H(1) < 0.025 && s.e > 0.37) o = O_LILY; }
    else if (s.e < 0.425) { g = G_SAND; double r = H(2); if (r < 0.012) o = O_PEBBLE; else if (r < 0.016) o = O_BOULDER; }
    else if (s.h > 0.6 && s.e > 0.44) {
      g = G_ROCK;
      if (s.h > 0.632) { b = s.h > 0.7 ? B_DARK : B_STONE; double v1 = fbm(x / 5.0, y / 5.0, S[1] + 7, 2), v2 = fbm(x / 6.0, y / 6.0, S[2] + 9, 2), v3 = fbm(x / 4.0, y / 4.0, S[3] + 11, 2);
        if (v1 > 0.69) b = B_COAL; if (s.h > 0.655 && v2 > 0.71) b = B_IRON; if (s.h > 0.685 && v3 > 0.74) b = B_GOLD; if (s.h > 0.7 && H(3) < 0.012) b = B_GEM;
      } else if (fbm(x / 9.0, y / 9.0, S[5] + 13, 2) > 0.7 && s.h < 0.62) g = G_ONSEN;
      else { double r = H(4); if (r < 0.04) o = O_BOULDER; else if (r < 0.08) o = O_PEBBLE; else if (r < 0.095) o = O_PINE; }
    }
    else if (s.t < 0.33) { g = G_SNOW; double r = H(5); if (r < 0.09) o = O_PINE; else if (r < 0.105) o = O_BOULDER; else if (r < 0.12) o = O_DEADTREE; else if (r < 0.13) o = O_BERRY; }
    else if (s.e < 0.47 && s.m > 0.58) {
      g = G_MARSH; if (fbm(x / 7.0, y / 7.0, S[4] + 3, 2) > 0.64) { g = G_WATER; if (H(6) < 0.08) o = O_LILY; }
      else { double r = H(7); if (r < 0.1) o = O_REEDS; else if (r < 0.13) o = O_DEADTREE; else if (r < 0.16) o = O_MUSHROOM; else if (r < 0.2) o = O_TALLGRASS; }
    }
    else if (s.m > 0.585) {
      g = G_FOREST; double r = H(8), k = H(9); bool bam = fbm(x / 30.0, y / 30.0, S[6] + 5, 2) > 0.66;
      if (bam && r < 0.26) o = O_BAMBOO; else if (r < 0.2) o = k < 0.45 ? O_OAK : k < 0.8 ? O_PINE : O_BIRCH;
      else if (r < 0.23) o = O_MUSHROOM; else if (r < 0.27) o = O_BUSH; else if (r < 0.285) o = O_BERRY; else if (r < 0.33) o = O_TALLGRASS;
    }
    else if (fbm(x / 46.0, y / 46.0, S[7], 3) > 0.63) { g = G_SAKURA; double r = H(10); if (r < 0.085) o = O_SAKURA; else if (r < 0.13) o = O_FLOWERS; else if (r < 0.16) o = O_TALLGRASS; else if (r < 0.17) o = O_BOULDER; }
    else { double r = H(11); bool dry = s.m < 0.42;
      if (r < (dry ? 0.012 : 0.03)) o = H(12) < 0.8 ? O_OAK : O_BIRCH; else if (r < 0.05) o = O_BUSH; else if (r < 0.06) o = O_BERRY; else if (r < (dry ? 0.16 : 0.11)) o = O_TALLGRASS;
      else if (r < 0.14) o = O_FLOWERS; else if (r < 0.147) o = O_BOULDER; else if (r < 0.152) o = O_PEBBLE; }
    if (!o && !b && (g == G_GRASS || g == G_FOREST || g == G_SAKURA || g == G_SAND || g == G_SNOW)) { double q = H(31); if (q < 0.0009 && g != G_SAND) o = O_SHRINE; else if (q < 0.0026) o = O_DIG; }
    if (o && OBJ[o].tree) m = hash2i(x, y, 77) & 3; if (o == O_FLOWERS || o == O_MUSHROOM || o == O_BOULDER || o == O_PEBBLE) m = hash2i(x, y, 78) & 7;
    return {g, b, o, m};
  }
  Village* villageForRegion(int rx, int ry) {
    std::string key = std::to_string(rx) + "," + std::to_string(ry); auto it = villages.find(key); if (it != villages.end()) return it->second.get();
    std::unique_ptr<Village> v;
    if (rx == 0 && ry == 0) v = makeVillage(key, 0, 0, true);
    else if (std::abs(rx) + std::abs(ry) > 0 && !(std::abs(rx) <= 1 && std::abs(ry) <= 1 && hash2(rx, ry, seed) < 0.35)) {
      RNG r(hash2i(rx, ry, seed + 404));
      if (r.next() < 0.78) for (int tries = 0; tries < 6 && !v; tries++) {
        int cx = jround(rx * REG + r.r(-REG * 0.3, REG * 0.3)), cy = jround(ry * REG + r.r(-REG * 0.3, REG * 0.3)); if (std::hypot((double)cx, (double)cy) < 70) continue; bool ok = true;
        for (int k = 0; k < 13 && ok; k++) { double a = k / 12.0 * PI * 2, rr = k == 12 ? 0 : 15; std::string bb = biomeAt(jround(cx + std::cos(a) * rr), jround(cy + std::sin(a) * rr)); if (bb == "water" || bb == "deep" || bb == "rock") ok = false; }
        if (ok) v = makeVillage(key, cx, cy, false);
      }
    }
    Village* p = v.get(); villages[key] = std::move(v); return p;
  }
  std::vector<Village*> villagesNear(double x, double y, double rad = VR + 2) {
    std::vector<Village*> out; int rx0 = (int)std::floor((x - rad) / REG + 0.5) - 1, rx1 = (int)std::floor((x + rad) / REG + 0.5) + 1, ry0 = (int)std::floor((y - rad) / REG + 0.5) - 1, ry1 = (int)std::floor((y + rad) / REG + 0.5) + 1;
    for (int ry = ry0; ry <= ry1; ry++) for (int rx = rx0; rx <= rx1; rx++) { Village* v = villageForRegion(rx, ry); if (v && std::fabs(v->x - x) <= rad + VR && std::fabs(v->y - y) <= rad + VR) out.push_back(v); }
    return out;
  }
  std::unique_ptr<Village> makeVillage(const std::string& id, int cx, int cy, bool home) {
    RNG r(hash2i(cx, cy, seed + 7)); auto v = std::make_unique<Village>(); v->id = id; v->x = cx; v->y = cy; v->home = home;
    if (home) v->name = "Hanomi"; else { std::string a = rpick(r, SYL1); v->name = a + rpick(r, SYL2); }
    v->ruler = rpick(r, RULER); v->color = home ? 0xe87a9a : rpick(r, NATION_COLORS); v->temper = home ? "kind" : rpick(r, TEMPER); v->size = home ? 1 : r.i(1, 3);
    auto set = [&](int x, int y, int g, int b, int o, int m) { Tile& t = v->ov[pkey(x, y)]; if (g != -2) { if (g != -1 || t.g == -1) {} } if (g >= 0) t.g = g; if (b >= 0) t.b = b; if (o >= 0) t.o = o; if (m >= 0) t.m = m; };
    // set(x,y,g,b,o,m): -1 = leave unchanged
    int R2 = VR * VR;
    for (int y = -VR; y <= VR; y++) for (int x = -VR; x <= VR; x++) { int d2 = x * x + y * y; if (d2 > R2) continue; Tile bs = base(cx + x, cy + y); int g = bs.g; if (isWater(g) || g == G_ROCK || g == G_MARSH || g == G_SAND) g = G_GRASS;
      int o = (d2 < (VR - 4) * (VR - 4)) ? 0 : (OBJ[bs.o].tree ? 0 : bs.o); set(cx + x, cy + y, home ? (d2 < (VR - 3) * (VR - 3) ? G_SAKURA : G_GRASS) : g, 0, isWater(bs.g) ? 0 : o, 0); }
    auto path = [&](int x, int y) { set(x, y, G_PATH, 0, 0, 0); };
    std::unordered_set<i64> used; auto mark = [&](int x, int y, int w, int h) { for (int j = -1; j <= h; j++) for (int i = -1; i <= w; i++) used.insert(pkey(x + i, y + j)); };
    auto freeA = [&](int x, int y, int w, int h) { for (int j = -1; j <= h; j++) for (int i = -1; i <= w; i++) { i64 k = pkey(x + i, y + j); if (used.count(k)) return false; auto o = v->ov.find(k); if (o != v->ov.end() && o->second.g == G_PATH) return false; if ((x + i - cx) * (x + i - cx) + (y + j - cy) * (y + j - cy) > (VR - 2) * (VR - 2)) return false; } return true; };
    int L = VR - 2; const int arms[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    for (auto& a : arms) { int dx = a[0], dy = a[1]; for (int s = 0; s <= L; s++) { int wob = jround(std::sin(s * 0.35 + r.r(0, 0.2)) * 0.6); for (int w = 0; w < 2; w++) { int px = cx + dx * s + (dy ? w + wob : 0), py = cy + dy * s + (dx ? w + wob : 0); path(px, py); } } }
    for (int y = -4; y <= 4; y++) for (int x = -4; x <= 4; x++) if (x * x + y * y <= 17) set(cx + x, cy + y, G_PLAZA, 0, 0, 0);
    mark(cx - 4, cy - 4, 9, 9);
    auto strukt = [&](const char* kind, int x, int y, int w, int h, int style = -1, bool hm = false) -> int { Struct s; s.kind = kind; s.x = x; s.y = y; s.w = w; s.h = h; s.v = id; { int rs = r.i(0, 3); s.style = style >= 0 ? style : rs; } s.home = hm; v->structs.push_back(s); mark(x, y, w, h);
      for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) set(x + i, y + j, G_DIRT, B_BLDG, 0, 0); return (int)v->structs.size() - 1; };
    auto doorPath = [&](int si) { Struct& s = v->structs[si]; int dx = s.x + (s.w >> 1); for (int yy = s.y + s.h; yy <= s.y + s.h + 1; yy++) { path(dx, yy); used.insert(pkey(dx, yy)); } s.hasDoor = true; s.dx = dx; s.dy = s.y + s.h - 1; };
    if (home) {
      int KW = 12, KH = 8, px0 = cx + 5, py0 = cy - 11; strukt("koi", px0, py0, KW, KH); v->hasKoi = true; v->kx = px0; v->ky = py0; v->kw = KW; v->kh = KH;
      for (int j = 0; j < KH; j++) for (int i = 0; i < KW; i++) { double u = ((i + 0.5) * TS - KW * 8) / (KW * 8 - 4), q = ((j + 0.5) * TS - KH * 8) / (KH * 8 - 4); set(px0 + i, py0 + j, G_SAKURA, std::pow(std::fabs(u), 2.6) + std::pow(std::fabs(q), 2.6) < 0.8 ? B_BLDG : 0, 0, 0); }
      set(px0 - 1, py0 + KH, -1, 0, O_LANTERN, 0); set(px0 + KW, py0 + KH - 1, -1, 0, O_LANTERN, 0);
      set(px0 + KW + 1, py0 + 1, -1, 0, O_SAKURA, 1); set(px0 - 2, py0 - 1, -1, 0, O_SAKURA, 2); set(px0 + KW + 2, py0 + 5, -1, 0, O_SAKURA, 0); set(px0 + 3, py0 - 2, -1, 0, O_SAKURA, 3);
      int hs = strukt("house", cx - 11, cy - 9, 6, 4, 0, true); doorPath(hs); v->homeHouse = hs; Struct& H = v->structs[hs];
      set(H.x + H.w + 1, H.y + H.h, -1, 0, O_CHEST, 0); set(H.x - 1, H.y + H.h, -1, 0, O_BENCH, 0);
      for (int j = 0; j < 4; j++) for (int i = 0; i < 6; i++) set(cx - 11 + i, cy + 5 + j, G_TILLED, 0, (j == 1 || j == 2) && i < 4 ? O_WHEAT : 0, 1);
      for (int i = -1; i <= 6; i++) { set(cx - 11 + i, cy + 4, -1, 0, i == 2 ? O_GATE : O_FENCE, 0); set(cx - 11 + i, cy + 9, -1, 0, O_FENCE, 0); }
      for (int j = 5; j < 9; j++) { set(cx - 12, cy + j, -1, 0, O_FENCE, 0); set(cx - 5, cy + j, -1, 0, O_FENCE, 0); }
      mark(cx - 12, cy + 4, 8, 6); set(cx - 7, cy + 7, -1, 0, O_SCARECROW, 0); set(cx + 3, cy + 3, -1, 0, O_BANNER, 0); v->hasBanner = true; v->bx = cx + 3; v->by = cy + 3; set(cx - 3, cy - 3, -1, 0, O_WELL, 0);
      v->hasStall = true; v->sx = cx - 3; v->sy = cy + 3; set(v->sx, v->sy, -1, 0, O_STALL, 0); v->spawns.push_back({"merchant", v->sx, v->sy + 1}); v->spawns.push_back({"dog", cx - 6, cy - 4}); v->spawnX = H.dx; v->spawnY = H.dy + 2;
    } else {
      set(cx, cy - 2, -1, 0, O_BANNER, 0); v->hasBanner = true; v->bx = cx; v->by = cy - 2; set(cx + 2, cy + 2, -1, 0, O_WELL, 0);
      int hall = strukt("hall", cx - 4, cy - 10, 8, 4); doorPath(hall); v->spawns.push_back({"chief", v->structs[hall].dx, v->structs[hall].dy + 2});
      v->hasStall = true; v->sx = cx - 3; v->sy = cy + 3; set(v->sx, v->sy, -1, 0, O_STALL, 0); v->spawns.push_back({"merchant", v->sx, v->sy + 1});
      if (v->size >= 2) { int bk = strukt("barracks", cx + 6, cy - 10, 6, 4); doorPath(bk); }
    }
    int nH = home ? 4 : 6 + v->size * 3, placed = 0;
    auto isPath = [&](int x, int y) { auto o = v->ov.find(pkey(x, y)); return o != v->ov.end() && (o->second.g == G_PATH || o->second.g == G_PLAZA); };
    static const int WP[4] = {4, 5, 5, 6}, HP[3] = {3, 3, 4};
    for (int tries = 0; tries < 260 && placed < nH; tries++) {
      int w = WP[(int)std::floor(r.next() * 4)], h = HP[(int)std::floor(r.next() * 3)], x, y; bool along = tries < 90;
      if (along) { const int* arm = arms[r.i(0, 3)]; int s = r.i(6, L - 3), side = r.chance(0.5) ? 1 : -1;
        if (arm[0]) { if (side > 0) continue; x = cx + arm[0] * s - (w >> 1); y = cy - h - 1; } else { y = cy + arm[1] * s - h; x = side < 0 ? cx - w - 1 : cx + 3; }
      } else { double a = r.r(0, PI * 2), d = r.r(7, VR - 6); x = jround(cx + std::cos(a) * d - w / 2.0); y = jround(cy + std::sin(a) * d - h / 2.0); }
      if (!freeA(x, y, w, h)) continue;
      int hs = strukt("house", x, y, w, h); doorPath(hs); placed++; Struct& H = v->structs[hs]; int px = H.dx, py = H.dy + 2;
      if (!isPath(px, py)) { bool horiz = !(std::abs(px - cx) < std::abs(py - cy));
        for (int k = 0; k < 40 && !isPath(px, py); k++) { if (horiz) { if (py == cy || isPath(px, py)) break; py += py < cy ? 1 : -1; } else { if (px == cx || isPath(px, py)) break; px += px < cx ? 1 : -1; }
          i64 key = pkey(px, py); if (used.count(key) && !isPath(px, py)) break; path(px, py); } }
      Spawn sp; sp.k = "villager"; sp.x = H.dx; sp.y = H.dy + 2; sp.home = (int)v->structs.size() - 1; v->spawns.push_back(sp);
    }
    for (int f = 0; f < (home ? 0 : 2); f++) for (int tries = 0; tries < 30; tries++) {
      int w = r.i(5, 7), h = r.i(3, 4), x = cx + r.i(-L + 1, L - w - 1), y = cy + r.i(-L + 1, L - h - 1); if (!freeA(x - 1, y - 1, w + 2, h + 2)) continue;
      static const int CP[5] = {O_WHEAT, O_WHEAT, O_CARROT, O_TOMATO, O_RICE}; int crop = CP[(int)std::floor(r.next() * 5)];
      for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) set(x + i, y + j, G_TILLED, 0, crop, r.i(1, 3));
      for (int i = -1; i <= w; i++) { set(x + i, y - 1, -1, 0, O_FENCE, 0); set(x + i, y + h, -1, 0, i == (w >> 1) ? O_GATE : O_FENCE, 0); }
      for (int j = 0; j < h; j++) { set(x - 1, y + j, -1, 0, O_FENCE, 0); set(x + w, y + j, -1, 0, O_FENCE, 0); }
      mark(x - 1, y - 1, w + 2, h + 2); break; }
    for (int tries = 0; tries < 30; tries++) {
      int w = 6, h = 4, x = cx + r.i(-L + 2, L - w - 2), y = cy + r.i(-L + 2, L - h - 2); if (!freeA(x - 1, y - 1, w + 2, h + 2)) continue;
      for (int i = -1; i <= w; i++) { set(x + i, y - 1, -1, 0, O_FENCE, 0); set(x + i, y + h, -1, 0, i == 2 ? O_GATE : O_FENCE, 0); }
      for (int j = 0; j < h; j++) { set(x - 1, y + j, -1, 0, O_FENCE, 0); set(x + w, y + j, -1, 0, O_FENCE, 0); }
      set(x + w - 1, y, -1, 0, O_HAY, 0);
      static const char* AK[3] = {"cow", "sheep", "chicken"}; std::string kinds[3]; if (home) kinds[0] = kinds[1] = kinds[2] = "chicken"; else { kinds[0] = AK[(int)std::floor(r.next() * 3)]; kinds[1] = AK[(int)std::floor(r.next() * 3)]; kinds[2] = "chicken"; }
      for (int k = 0; k < 3; k++) { Spawn sp; sp.k = kinds[k]; sp.x = x + 1 + k * 2; sp.y = y + 2; sp.pen = true; sp.px = x; sp.py = y; sp.pw = w; sp.ph = h; v->spawns.push_back(sp); }
      mark(x - 1, y - 1, w + 2, h + 2); break; }
    for (auto& a : arms) { int dx = a[0], dy = a[1]; for (int s = 7; s < L - 1; s += 6) { int px = cx + dx * s + (dy ? (s % 12 ? 3 : -2) : 0), py = cy + dy * s + (dx ? (s % 12 ? -2 : 3) : 0); i64 k = pkey(px, py); if (!used.count(k)) { set(px, py, -1, 0, O_LANTERN, 0); used.insert(k); } } }
    int end = L - 1; set(cx, cy + end, -1, 0, O_TORII, 0);
    static const int DEC[8] = {O_BARREL, O_CRATE, O_FLOWERS, O_SAKURA, O_FLOWERS, O_BUSH, O_SAKURA, O_OAK};
    for (int k = 0; k < 14; k++) { int x = cx + r.i(-L, L), y = cy + r.i(-L, L); i64 key = pkey(x, y); auto o = v->ov.find(key);
      if (used.count(key) || o == v->ov.end() || o->second.g == G_PATH || o->second.g == G_PLAZA || o->second.b > 0) continue; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > (VR - 4) * (VR - 4)) continue;
      { int dco = DEC[(int)std::floor(r.next() * 8)]; int dm = r.i(0, 3); set(x, y, -1, 0, dco, dm); } used.insert(key); }
    if (!home) for (int k = 0; k < 2 + v->size; k++) { int gx = cx + r.i(-3, 3), gy = cy + r.i(4, 6); v->spawns.push_back({"guard", gx, gy}); }
    if (home) for (int k = 0; k < 2; k++) { int gx = cx + r.i(-2, 2); v->spawns.push_back({"villager", gx, cy + 5}); }
    return v;
  }
  /* ---------- chunks ---------- */
  Chunk* peek(int cx, int cy) { auto it = chunks.find(pkey(cx, cy)); return it == chunks.end() ? nullptr : it->second.get(); }
  Chunk* chunk(int cx, int cy) { i64 k = pkey(cx, cy); auto it = chunks.find(k); if (it != chunks.end()) return it->second.get(); auto c = std::make_unique<Chunk>(); c->cx = cx; c->cy = cy; genChunk(*c); Chunk* p = c.get(); chunks[k] = std::move(c); return p; }
  void genChunk(Chunk& c) {
    int x0 = c.cx * CS, y0 = c.cy * CS; auto vs = villagesNear(x0 + CS / 2.0, y0 + CS / 2.0, CS);
    for (int j = 0; j < CS; j++) for (int i = 0; i < CS; i++) { int x = x0 + i, y = y0 + j, idx = j * CS + i; Tile t = base(x, y);
      for (Village* v : vs) { auto o = v->ov.find(pkey(x, y)); if (o != v->ov.end()) { const Tile& ov = o->second; if (ov.g >= 0) t.g = ov.g; if (ov.b >= 0) t.b = ov.b; if (ov.o >= 0) t.o = ov.o; if (ov.m >= 0) t.m = ov.m; break; } }
      c.g[idx] = t.g; c.b[idx] = t.b; c.o[idx] = t.o; c.m[idx] = t.m; if (isWater(t.g)) c.water = true; }
    auto sv = saved.find(pkey(c.cx, c.cy)); if (sv != saved.end()) for (auto& s : sv->second) { c.g[s.idx] = s.g; c.b[s.idx] = s.b; c.o[s.idx] = s.o; c.m[s.idx] = s.m; c.mod.insert(s.idx); if (isWater(s.g)) c.water = true; }
    c.gen = true;
  }
  Chunk* at(int x, int y, int& idx) { int cx = (int)std::floor(x / (double)CS), cy = (int)std::floor(y / (double)CS); idx = (y - cy * CS) * CS + (x - cx * CS); return chunk(cx, cy); }
  int ground(int x, int y) { int i; Chunk* c = at(x, y, i); return c->g[i]; } int block(int x, int y) { int i; Chunk* c = at(x, y, i); return c->b[i]; }
  int obj(int x, int y) { int i; Chunk* c = at(x, y, i); return c->o[i]; } int meta(int x, int y) { int i; Chunk* c = at(x, y, i); return c->m[i]; }
  void dirtyNeighbours(Chunk* c, int i, bool walls = false) { int lx = i % CS, ly = i / CS; std::vector<int> xs = {0}, ys = {0}; if (lx <= 1) xs.push_back(-1); if (lx >= CS - 2) xs.push_back(1); if (ly <= 1) ys.push_back(-1); if (ly >= CS - 2) ys.push_back(1);
    for (int dx : xs) for (int dy : ys) if (dx || dy) { Chunk* n = peek(c->cx + dx, c->cy + dy); if (n) { n->dirty = true; if (walls) n->rv++; } } }
  void set(int x, int y, int g = -1, int b = -1, int o = -1, int m = -1) { int i; Chunk* c = at(x, y, i); int old = c->g[i], oldB = c->b[i];
    if (g >= 0) c->g[i] = g; if (b >= 0) c->b[i] = b; if (o >= 0) c->o[i] = o; if (m >= 0) c->m[i] = m; c->mod.insert(i);
    if (g >= 0 && g != old) { c->dirty = true; if (isWater(g)) c->water = true; dirtyNeighbours(c, i); }
    if (b >= 0 && b != oldB) { c->rv++; c->dirty = true; dirtyNeighbours(c, i, true); } }
  int depth(int x, int y) { int g = ground(x, y); if (!isWater(g)) return 0; if (g == G_DEEP) return 2; for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) if ((dx || dy) && !isWater(ground(x + dx, y + dy))) return 1; return 2; }
  bool solid(int x, int y, bool swim = false) { int i; Chunk* c = at(x, y, i); if (c->b[i]) return true; int g = c->g[i]; if (!swim && isWater(g) && depth(x, y) == 2) return true;
    int o = c->o[i]; if (o && OBJ[o].solid) { if (o == O_GATE && (c->m[i] & 1)) return false; return true; } return false; }
  void unloadFar(double px, double py, int keep = 7) { int cx = (int)std::floor(px / CS), cy = (int)std::floor(py / CS); std::vector<i64> del;
    for (auto& kv : chunks) { Chunk* c = kv.second.get(); if (std::abs(c->cx - cx) > keep || std::abs(c->cy - cy) > keep) { if (!c->mod.empty()) { std::vector<SavedTile> a; for (int i : c->mod) a.push_back({i, c->g[i], c->b[i], c->o[i], c->m[i]}); saved[kv.first] = a; } del.push_back(kv.first); } }
    for (i64 k : del) chunks.erase(k); }
};
