import json
T=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'key-zuordnung.json')))
q=lambda s: "'"+s.replace("'","''")+"'"
rows=[]
for c in T['categories']:
    rows.append((c['label'],None,None,c['key'],None,None))
    for s in c['subs']:
        rows.append((c['label'],s['label'],None,c['key'],s['key'],None))
        for t in s['types']: rows.append((c['label'],s['label'],t['label'],c['key'],s['key'],t['key']))
legacy_cat=[('mantel','outerwear','coat'),('jacke','outerwear',None),('pullover','top','sweater'),('hose','pants',None),('schuhe','shoe',None),('tasche','bag',None),('accessoire','accessory',None)]
n=lambda v: 'null' if v is None else q(v)
L=[]
L.append("""-- 0014: Englische Keys statt deutscher Namen (Leitsatz 19.11.2026, Okay von Max am 19.11.2026)
-- Erzeugt aus docs/keys/key-zuordnung.json (nicht von Hand ändern, neu erzeugen: python3 docs/keys/sql-erzeugen.py).
-- REIHENFOLGE: erst die App ausliefern, die Keys UND alte deutsche Namen lesen kann, dann diese Migration anwenden.
-- Alte Werte bleiben in items_keys_backup_0014 / outfits_keys_backup_0014 erhalten (Rückweg: siehe Ende der Datei).

begin;

create table if not exists items_keys_backup_0014 as
  select id, category, subcategory, item_type, colors, colors_b, materials, pattern, pattern_b, styles, seasons, collar, closure, strap from items;
create table if not exists outfits_keys_backup_0014 as select id, occasions from outfits;
alter table items_keys_backup_0014 enable row level security;
alter table outfits_keys_backup_0014 enable row level security;

create temp table k_path(c text, s text, t text, ck text, sk text, tk text) on commit drop;
insert into k_path values""")
L.append(',\n'.join(f"({n(a)},{n(b)},{n(c)},{n(d)},{n(e)},{n(f)})" for a,b,c,d,e,f in rows)+';')
L.append("create temp table k_val(list text, label text, key text) on commit drop;\ninsert into k_val values")
vals=[]
for k,v in T.items():
    if k=='categories': continue
    for x in v: vals.append(f"({q(k)},{q(x['label'])},{q(x['key'])})")
for a,b in [('Uni','campus'),('Arbeit','office'),('Abend/Ausgehen','party'),('Ausgehen','party'),('Abend','party'),('Training','sport')]:
    vals.append(f"('occasions',{q(a)},{q(b)})")
L.append(',\n'.join(vals)+';')
L.append("""
-- Kategorie-Pfad (genaue Übereinstimmung aller drei Ebenen)
update items i set category = p.ck, subcategory = p.sk, item_type = p.tk
from k_path p
where i.category = p.c and i.subcategory is not distinct from p.s and i.item_type is not distinct from p.t;
-- Alte IDs aus dem ersten Import""")
for a,b,c in legacy_cat:
    L.append(f"update items set category = {q(b)}, subcategory = {n(c)}, item_type = null where category = {q(a)} and subcategory is null;")
L.append("""
-- Einzelwerte
update items i set pattern   = v.key from k_val v where v.list = 'patterns' and i.pattern   = v.label;
update items i set pattern_b = v.key from k_val v where v.list = 'patterns' and i.pattern_b = v.label;
update items i set collar    = v.key from k_val v where v.list = 'collars'  and i.collar    = v.label;
update items i set closure   = v.key from k_val v where v.list = 'closures' and i.closure   = v.label;
update items i set strap     = v.key from k_val v where v.list = 'straps'   and i.strap     = v.label;

-- Listen (Reihenfolge = Rang bleibt erhalten; Unbekanntes bleibt unverändert)
update items i set colors = coalesce((select array_agg(coalesce(v.key, x) order by o) from unnest(i.colors) with ordinality u(x, o)
  left join k_val v on v.list = 'colors' and v.label = u.x), '{}') where cardinality(i.colors) > 0;
update items i set colors_b = coalesce((select array_agg(coalesce(v.key, x) order by o) from unnest(i.colors_b) with ordinality u(x, o)
  left join k_val v on v.list = 'colors' and v.label = u.x), '{}') where cardinality(i.colors_b) > 0;
update items i set styles = coalesce((select array_agg(coalesce(v.key, x) order by o) from unnest(i.styles) with ordinality u(x, o)
  left join k_val v on v.list = 'styles' and v.label = u.x), '{}') where cardinality(i.styles) > 0;
update items i set seasons = coalesce((select array_agg(coalesce(v.key, x) order by o) from unnest(i.seasons) with ordinality u(x, o)
  left join k_val v on v.list = 'seasons' and v.label = u.x), '{}') where cardinality(i.seasons) > 0;
update outfits t set occasions = coalesce((select array_agg(distinct_key order by first_o) from (
    select coalesce(v.key, x) distinct_key, min(o) first_o from unnest(t.occasions) with ordinality u(x, o)
    left join k_val v on v.list = 'occasions' and v.label = u.x group by 1) d), '{}') where cardinality(t.occasions) > 0;

-- Material: jsonb [{name, pct}] → name = Key, pct bleibt
update items i set materials = (select jsonb_agg(case when v.key is null then m else jsonb_set(m, '{name}', to_jsonb(v.key)) end order by o)
  from jsonb_array_elements(i.materials) with ordinality e(m, o)
  left join k_val v on v.list = 'materials' and v.label = m->>'name')
where jsonb_typeof(i.materials) = 'array' and jsonb_array_length(i.materials) > 0;

commit;

-- Prüfung danach (muss 0 Zeilen liefern, sonst Werte nachtragen):
-- select category, subcategory, item_type from items where category !~ '^[a-z_]+$' or subcategory !~ '^[a-z_]+$' or item_type !~ '^[a-z_0-9]+$';
-- Rückweg:
-- update items i set category=b.category, subcategory=b.subcategory, item_type=b.item_type, colors=b.colors, colors_b=b.colors_b, materials=b.materials,
--   pattern=b.pattern, pattern_b=b.pattern_b, styles=b.styles, seasons=b.seasons, collar=b.collar, closure=b.closure, strap=b.strap
--   from items_keys_backup_0014 b where b.id = i.id;
-- update outfits o set occasions = b.occasions from outfits_keys_backup_0014 b where b.id = o.id;
""")
open(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..','supabase','migrations','0014_englische_keys.sql'),'w').write('\n'.join(L))
print(len(rows), len(vals))
