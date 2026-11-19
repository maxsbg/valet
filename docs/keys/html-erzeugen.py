import json, os, html
d=os.path.dirname(os.path.abspath(__file__)); T=json.load(open(os.path.join(d,'key-zuordnung.json')))
e=html.escape
names={'colors':'Farben','materials':'Material','patterns':'Muster','styles':'Stil','seasons':'Saison','collars':'Kragen/Ausschnitt','closures':'Verschluss','straps':'Trägerart','occasions':'Anlässe'}
out=['<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Valet – Englische Keys</title><style>body{font:15px/1.5 -apple-system,sans-serif;color:#2a1a1d;background:#faf6f1;margin:0}main{max-width:820px;margin:0 auto;padding:20px 16px 60px}h2{margin-top:28px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #e8dcd6;padding:4px 6px;text-align:left}code{background:#f1e9e3;padding:0 4px;border-radius:4px}.box{background:#fff;border:1px solid #e8dcd6;border-radius:12px;padding:12px 14px}</style></head><body><main>',
'<h1>Valet – Englische Keys</h1>',
'<div class="box"><b>Was passiert:</b> In der Datenbank stehen künftig englische Keys (z.&nbsp;B. <code>navy</code>), in der App siehst du weiter genau dieselben deutschen Namen („Marineblau“). '
'<b>Reihenfolge:</b> 1. Eine andere KI baut den Code um (Anweisung: <code>docs/keys/ARBEITSANWEISUNG.md</code>). 2. Du mergst den PR. 3. Claude wendet die Migration <code>0014</code> an, vorher wird alles gesichert. '
'<b>Prüfen musst du die Tabelle nicht</b> – die Keys sieht nie jemand. Nur wenn dir ein deutscher Name falsch vorkommt, sag Bescheid.</div>']
out.append('<h2>Kategorien</h2><table><tr><th>Deutsch</th><th>Key</th></tr>')
for c in T['categories']:
    out.append(f'<tr><td><b>{e(c["label"])}</b></td><td><code>{c["key"]}</code></td></tr>')
    for s in c['subs']:
        out.append(f'<tr><td>&nbsp;&nbsp;{e(s["label"])}</td><td><code>{c["key"]}/{s["key"]}</code></td></tr>')
        for t in s['types']: out.append(f'<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;{e(t["label"])}</td><td><code>…/{t["key"]}</code></td></tr>')
out.append('</table>')
for k,v in T.items():
    if k=='categories': continue
    out.append(f'<h2>{names[k]}</h2><table>'+''.join(f'<tr><td>{e(x["label"])}</td><td><code>{x["key"]}</code></td></tr>' for x in v)+'</table>')
out.append('</main></body></html>')
open(os.path.join(d,'key-zuordnung.html'),'w').write('\n'.join(out))
