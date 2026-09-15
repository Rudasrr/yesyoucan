import sys, os
from playwright.sync_api import sync_playwright
os.makedirs('shots',exist_ok=True)
import os; URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','out','index.html'))
SETUP_CLIENT='''localLogin("client");SEED.measurements.forEach(m=>saveMeas({...m}));const wk=getWeek(App.week);const sw=SEED.sample_week;const names=["Pondělí","Úterý","Střední","Čtvrtek","Pátek","Sobota","Neděle"];names[2]="Středa";wk.plan=names.map(n=>sw[n]);saveWeek(wk);A.dayField("walk_min",65);
for(let k=1;k<=5;k++){const dt=addDays(todayISO(),-k);const d=getDay(dt);d.walk_min=k===3?30:70;d.beers=k===4?4:0;S().courses.forEach(c=>{d.meals[c.key]={eaten:true}});saveDay(d);}
autoClosePast();A.eaten('snidane',true);render();'''
SETUP_COACH='''localLogin("coach");go('trenink');A.tpNew();App.tpDay=0;render();document.querySelector('#tpex').value='Dřep';A.tpItemAdd();document.querySelector('#tpex').value='Klik o stůl';A.tpItemAdd();document.querySelector('#tpex').value='Běh pomalý';A.tpItemAdd();A.tpDayField('walk_min',45);const pl=trainingPlans()[0];pl.days[2]=JSON.parse(JSON.stringify(pl.days[0]));pl.days[4]=JSON.parse(JSON.stringify(pl.days[0]));saveTrainingPlan(pl);A.tpField('active_from',mondayOf(todayISO()));UI.closeModal();render();'''
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
        shots([(f'desk-{v}',SETUP_CLIENT,v,False,None) for v in ['dnes','tyden','recepty','vareni','navod','suroviny']])
    elif which=='mobile':
        shots([(f'mob-{v}',SETUP_CLIENT,v,True,None) for v in ['dnes','prehled','tyden','more','ucet','suroviny']])
    elif which=='coach':
        shots([(f'coach-{v}',SETUP_CLIENT+SETUP_COACH,v,False,None) for v in ['klient','trenink','nastaveni','databaze','dnes']])
    elif which=='modals':
        shots([('modal-own',SETUP_CLIENT,'recepty',True,'A.editOwn()'),('modal-recipe',SETUP_CLIENT+SETUP_COACH,'databaze',False,"A.editRecipe('r1')"),('coach-mob',SETUP_CLIENT+SETUP_COACH,'klient',True,None)])
