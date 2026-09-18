import json, sys
from playwright.sync_api import sync_playwright
import os; URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','out','index.html'))
SETUP=open(os.path.join(os.path.dirname(__file__),'shots.py')).read().split("SETUP_CLIENT='''")[1].split("'''")[0]
VIEWS_C=['dnes','tyden','jidlo','mereni','navod','recepty','suroviny','more','ucet']
SUBTABS=[('jidlo','jidloTab',['nakup','vareni','recepty','suroviny']),('mereni','merTab',['zapis','prehled'])]
VIEWS_K=['klient','zprava','trenink','nastaveni','databaze','dnes','tyden']
WIDTHS=[390,768,1440]
CHECK_JS='''(() => {
  const out={overflow:0, offscreen:[], contrast:[], tiny:[], sidescroll:[], holes:[]};
  // díry v rozvržení: mřížka s prázdnými sloupci, nebo karta natažená do prázdna
  for(const el of document.querySelectorAll('#main *')){
    const cs=getComputedStyle(el);
    if(cs.display!=='grid') continue;
    const cols=cs.gridTemplateColumns.split(' ').filter(t=>parseFloat(t)>0).length;
    const pocet=par=>[...par.children].reduce((n,c)=>{const d=getComputedStyle(c).display;return d==='none'?n:d==='contents'?n+pocet(c):n+1;},0);
    const kids=pocet(el);
    if(cols>1 && kids>0 && kids<cols) out.holes.push('prázdné sloupce: '+(el.className||el.tagName)+' '+kids+'/'+cols);
  }
  // překryv ovládacích prvků: dvě tlačítka nebo pole přes sebe = rozbité rozvržení
  const ovl=[...document.querySelectorAll('#main button, #main input, #main select, #main .chip')].filter(e=>e.getBoundingClientRect().width>0 && (!e.checkVisibility || e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})));
  for(let i=0;i<ovl.length;i++)for(let j=i+1;j<ovl.length;j++){
    const a=ovl[i], b=ovl[j];
    if(a.contains(b)||b.contains(a)) continue;
    const r=a.getBoundingClientRect(), q=b.getBoundingClientRect();
    const prek=Math.max(0,Math.min(r.right,q.right)-Math.max(r.left,q.left))*Math.max(0,Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top));
    if(prek>16) out.holes.push('překryv prvků: '+((a.className||a.tagName)+'').slice(0,18)+' × '+((b.className||b.tagName)+'').slice(0,18));
  }
  for(const el of document.querySelectorAll('#main .grid > .card, #main .dgrid > * > .card')){
    const r=el.getBoundingClientRect();
    const last=[...el.children].filter(c=>c.getBoundingClientRect().height>0).pop(); if(!last) continue;
    const dole=r.bottom-last.getBoundingClientRect().bottom;
    if(dole>90) out.holes.push('prázdno pod obsahem: '+(el.className||'card')+' '+Math.round(dole)+'px');
  }
  for(const el of document.querySelectorAll('#main *')){
    const cs=getComputedStyle(el);
    if(/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 8)
      out.sidescroll.push((el.className||el.tagName)+'|+'+(el.scrollWidth-el.clientWidth)+'px');
  }
  const de=document.documentElement; out.overflow = de.scrollWidth - de.clientWidth;
  const vw=de.clientWidth;
  const lum=c=>{const m=c.match(/\\d+(\\.\\d+)?/g); if(!m) return null; const [r,g,b]=m.map(Number); const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}; return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const bg=el=>{while(el){const cs=getComputedStyle(el); if(cs.backgroundImage!=='none') return 'grad'; const c=cs.backgroundColor; const al=c.startsWith('rgba')?parseFloat(c.split(',')[3]):1; if(c && c!=='transparent' && al>=0.5) return c; el=el.parentElement;} return 'rgb(247, 248, 252)'};
  for(const el of document.querySelectorAll('#main *')){
    const r=el.getBoundingClientRect(); if(r.width===0) continue;
    if(r.right>vw+1 && el.closest('.tbl,.plist,.calstrip,.weekgrid')===null) out.offscreen.push(el.className+'|'+el.tagName+'|'+Math.round(r.right-vw));
    if(el.children.length===0 && el.textContent.trim().length>2){ const cs=getComputedStyle(el); const fs=parseFloat(cs.fontSize); if(fs<11) out.tiny.push(el.textContent.trim().slice(0,30));
      const b=bg(el); if(b!=='grad'){ const l1=lum(cs.color), l2=lum(b); if(l1!=null&&l2!=null){ const cr=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); if(cr<3.5) out.contrast.push(el.textContent.trim().slice(0,30)+'|'+cr.toFixed(1)); } } }
  }
  out.offscreen=out.offscreen.slice(0,5); out.contrast=out.contrast.slice(0,5); out.tiny=out.tiny.slice(0,5); out.sidescroll=out.sidescroll.slice(0,5); out.holes=out.holes.slice(0,5);
  return out; })()'''
rows=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for role,views in [('client',VIEWS_C),('coach',VIEWS_K)]:
        for w in WIDTHS:
            ctx=b.new_context(viewport={'width':w,'height':900},locale='cs-CZ',timezone_id='Europe/Prague'); pg=ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
            pg.goto(URL); pg.wait_for_timeout(200); pg.evaluate(SETUP)
            if role=='coach': pg.evaluate("localLogin('coach');render()")
            for v in views:
                pg.evaluate(f"go('{v}')"); pg.wait_for_timeout(120)
                res=pg.evaluate(CHECK_JS)
                for sv,prop,tabs in SUBTABS:          # projít i podzáložky
                    if sv!=v: continue
                    for t in tabs:
                        pg.evaluate(f"App.{prop}='{t}';render()"); pg.wait_for_timeout(120)
                        r2=pg.evaluate(CHECK_JS)
                        rows.append((role,w,f'{v}/{t}',r2['overflow'],len(r2['offscreen']),r2['offscreen'][:2],len(r2['contrast']),r2['contrast'][:2],len(r2['tiny']),0,len(errs),len(r2['sidescroll']) if w==390 else 0,r2['sidescroll'][:2],len(r2['holes']),r2['holes'][:2]))
                # click all buttons that don't navigate/destroy (sample)
                nbtn=pg.evaluate("document.querySelectorAll('#main button').length")
                rows.append((role,w,v,res['overflow'],len(res['offscreen']),res['offscreen'][:2],len(res['contrast']),res['contrast'][:2],len(res['tiny']),nbtn,len(errs),len(res['sidescroll']) if w==390 else 0,res['sidescroll'][:2],len(res['holes']),res['holes'][:2]))
            ctx.close()
    # interaction sweep: click every button on each client view (1440), catching errors
    ctx=b.new_context(viewport={'width':1440,'height':900},locale='cs-CZ'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.goto(URL); pg.wait_for_timeout(200); pg.evaluate(SETUP)
    clicks=0
    for v in VIEWS_C:
        pg.evaluate(f"go('{v}')"); pg.wait_for_timeout(100)
        n=pg.evaluate("document.querySelectorAll('#main button, #main .chip, #main .task, #main .pitem').length")
        for i in range(min(n,60)):
            try:
                pg.evaluate(f"""(()=>{{const els=document.querySelectorAll('#main button, #main .chip, #main .task, #main .pitem'); const el=els[{i}]; if(!el) return; const t=(el.getAttribute('onclick')||'')+el.textContent; if(/print|logout|export|import|Smazat|Vyprázdnit|clearWeek|resetDay|genWeek|closeDay|delMeas|Odhlásit|Změnit roli/.test(t)) return; el.click();}})()""")
                clicks+=1; pg.wait_for_timeout(30); pg.evaluate("UI.closeModal()"); pg.evaluate(f"if(App.view!=='{v}') go('{v}')")
            except Exception as e: errs.append(f'{v}#{i}: {e}')
    b.close()
print(f"{'role':6} {'w':5} {'view':10} {'ovfl':5} {'off':4} {'contr':5} {'tiny':4} {'bok':4} {'díra':4} {'btns':4} err")
for r in rows: print(f"{r[0]:6} {r[1]:<5} {r[2]:10} {r[3]:<5} {r[4]:<4} {r[6]:<5} {r[8]:<4} {r[11]:<4} {r[13]:<4} {r[9]:<4} {r[10]} {r[5] if r[4] else ''} {r[7] if r[6] else ''} {r[12] if r[11] else ''} {r[14] if r[13] else ''}")
side=sum(r[11] for r in rows)
print('na telefonu se roluje do strany:', side or 'nikde')
holes=sum(r[13] for r in rows)
print('díry v rozvržení:', holes or 'žádné')
print('interaction clicks:',clicks,'errors:',errs[:5] or 'none')
