"""Check that every id referenced in world-spec.json exists. Exit 1 on any error."""
import json, sys
s = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "world-spec.json", encoding="utf-8"))
ids = lambda k: {x["id"] for x in s[k]}
biomes, rocks = ids("biomes"), {r["id"] for r in s["geology"]["rocks"]}
signs, res, der, goods = ids("signs"), ids("resources"), ids("derived_materials"), ids("goods")
tools, methods, concepts, races = ids("tools"), ids("extraction_methods"), ids("concepts"), ids("races")
overlays = ids("overlays")
items = res | der | goods
cats = {r["category"] for r in s["resources"]}
err = []
def need(cond, msg):
    if not cond: err.append(msg)
for k in ("biomes","signs","resources","derived_materials","goods","tools","extraction_methods","concepts","races","overlays"):
    lst=[x["id"] for x in s[k]]; need(len(lst)==len(set(lst)), f"duplicate id in {k}")
need(not (res & der) and not (res & goods) and not (der & goods), "id shared between resources/derived/goods")
for b, col in s["geology"]["column_by_biome"].items():
    need(b in biomes, f"column for unknown biome {b}")
    need(len(col) == s["geology"]["layers_per_cell"], f"{b}: wrong layer count")
    need(all(r in rocks for r in col), f"{b}: unknown rock")
need(set(s["tool_tier_order"]) == tools, "tool_tier_order must list every tool")
for r in s["resources"]:
    h = r["host"]; i = r["id"]
    need(all(b == "*" or b in biomes for b in h.get("biomes", [])), f"{i}: unknown biome")
    need(all(x in rocks for x in h.get("rocks", [])), f"{i}: unknown rock")
    if "near_overlay" in h: need(h["near_overlay"]["id"] in overlays, f"{i}: unknown overlay")
    need(r["shape"] in s["geology"]["deposit_shapes"], f"{i}: unknown shape")
    need(all(x["sign"] in signs for x in r["signs"]), f"{i}: unknown sign")
    need(all(m in methods for m in r["methods"]), f"{i}: unknown method")
    need(r["min_tool"] in tools, f"{i}: unknown min_tool")
    need(0 <= r["depth"][0] <= r["depth"][1] <= 4, f"{i}: bad depth")
    d = r.get("discovery", {})
    for c in d.get("needs_concepts", []) + d.get("value_understanding_needs", []): need(c in concepts, f"{i}: unknown concept {c}")
    if "smelt" in r: need(all(f in items for f in r["smelt"]["fuel"]), f"{i}: unknown fuel")
    need(r.get("known_at_start") or "discovery" in r, f"{i}: no way to discover")
    need(bool(r["signs"]) or r.get("known_at_start"), f"{i}: undiscoverable (no signs)")
for d in s["derived_materials"]:
    f = d["from"]
    if isinstance(f, dict):
        need(all(k in items for k in f["inputs"]), f"{d['id']}: unknown input")
        need(all(c in concepts for c in f.get("needs_concepts", [])), f"{d['id']}: unknown concept")
for t in s["tools"]:
    if t["made_from"]: need(all(k in items for k in t["made_from"]), f"{t['id']}: unknown material")
    need(all(c in concepts for c in t.get("needs_concepts", [])), f"{t['id']}: unknown concept")
for c in s["concepts"]:
    u = c.get("unlock", {})
    need(all(x in concepts for x in u.get("requires", [])), f"{c['id']}: unknown required concept")
    if "resource" in u: need(u["resource"] in res, f"{c['id']}: unknown resource")
    if "needs_resource_held" in u: need(u["needs_resource_held"] in res, f"{c['id']}: unknown resource")
    need(c.get("known_at_start") or u, f"{c['id']}: no unlock path")
for r in s["races"]:
    i = r["id"]
    need(all(b in biomes for b in r["home_biomes"]), f"{i}: unknown home biome")
    need(all(b in biomes for b in r["penalty_biomes"]), f"{i}: unknown penalty biome")
    need(all(k in cats for k in r["perception"]), f"{i}: unknown perception category")
    need(all(k in items for k in r["values"]), f"{i}: unknown valued item")
    need(all(k in items for k in r["diet"]), f"{i}: unknown food")
    need(all(k in concepts or k in res for k in r["starting_knowledge"]), f"{i}: unknown starting knowledge")
    for k in r.get("sacred", []): need(k in biomes or k in overlays, f"{i}: unknown sacred place {k}")
    need(i in s["combat"]["terrain_mult"], f"{i}: no combat terrain entry")
need(set(s["races_enabled"]) <= races, "races_enabled has unknown race")
for i, m in s["combat"]["terrain_mult"].items():
    need(i in races and all(b in biomes for b in m), f"combat: bad entry {i}")
st = [x["stage"] for x in s["escalation_ladder"]]; need(st == sorted(st), "ladder out of order")
if err:
    print("\n".join("ERROR: " + e for e in err)); sys.exit(1)
print(f"OK: {len(res)} resources ({sum(r['fantastic'] for r in s['resources'])} fantastic), {len(signs)} signs, "
      f"{len(concepts)} concepts, {len(tools)} tools, {len(races)} races, {len(biomes)} biomes")
