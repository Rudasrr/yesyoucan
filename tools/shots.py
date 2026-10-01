import sys, os
from playwright.sync_api import sync_playwright
os.makedirs('shots',exist_ok=True)
import os; URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','out','index.html'))
SETUP_CLIENT='''localLogin("client");SEED.measurements.forEach(m=>saveMeas({...m}));const wk=getWeek(App.week);const sw=SEED.sample_week;const names=["Pondělí","Úterý","Střední","Čtvrtek","Pátek","Sobota","Neděle"];names[2]="Středa";wk.plan=names.map(n=>sw[n]);saveWeek(wk);A.dayField("walk_min",65);
for(let k=1;k<=5;k++){const dt=addDays(todayISO(),-k);const d=getDay(dt);d.walk_min=k===3?30:70;d.beers=k===4?4:0;S().courses.forEach(c=>{d.meals[c.key]={eaten:true}});saveDay(d);}
autoClosePast();A.eaten('snidane',true);render();'''
SETUP_COACH='''localLogin("coach");App.coachTab='trenink';go('nastaveni');const mo=mondayOf(todayISO());[0,2,4].forEach(k=>{A.trDaySheet(addDays(mo,k));A.trAdd('Dřep');A.trAdd('Klik o stůl');A.trAdd('Běh pomalý');A.trDraftField('walk_min',45);A.trSave()});UI.closeModal();render();'''
def shots(jobs):
    with sync_playwright() as p:
        b=p.chromium.launch()
        for name,setup,view,mobile,extra in jobs:
            vp={'width':390,'height':844} if mobile else {'width':1440,'height':900}
            ctx=b.new_context(viewport=vp,locale='cs-CZ',timezone_id='Europe/Prague'); pg=ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
            pg.goto(URL); pg.wait_for_timeout(250)
            pg.evaluate(setup); pg.wait_for_timeout(150)
            if view: pg.evaluate(f"go('{view}')"); pg.wait_for_timeout(150)
            if extra: pg.evaluate(extra); pg.wait_for_timeout(250)
            pg.screenshot(path=f'shots/{name}.png', full_page=True)
            print(name,'errors:',errs or 'none'); ctx.close()
        b.close()
if __name__=='__main__':
    which=sys.argv[1] if len(sys.argv)>1 else 'client'
    if which=='client':
        shots([(f'desk-{v}',SETUP_CLIENT,v,False,None) for v in ['dnes','plan','pokrok','recepty','navod','suroviny']])
    elif which=='mobile':
        shots([(f'mob-{v}',SETUP_CLIENT,v,True,None) for v in ['dnes','plan','pokrok','more','ucet','suroviny']])
    elif which=='coach':
        shots([(f'coach-{v}',SETUP_CLIENT+SETUP_COACH,v,False,None) for v in ['klient','nastaveni','ucet']])
    elif which=='modals':
        shots([('modal-meal',SETUP_CLIENT,'dnes',True,"A.mealSheet('obed')"),('modal-own',SETUP_CLIENT,'recepty',True,'A.editOwn()'),('coach-mob',SETUP_CLIENT+SETUP_COACH,'klient',True,None)])
