const fs=require('fs');const h=fs.readFileSync(require('path').join(__dirname,'..','out','index.html'),'utf8');const js=h.split('<script>')[1].split('</script>')[0];
const cut=js.indexOf('/* ===== Úložiště');
const code=js.slice(0,cut).replace('const CLOUD_CONFIG','var CLOUD_CONFIG')+`
const s={...SEED.settings,met:SEED.met,phase_thresholds:SEED.phase_thresholds};
const sw=SEED.sample_week['Středa'];
const day={date:'2026-09-09',meals:Object.fromEntries(['snidane','obed','svacina','vecere1','vecere2'].map((k,i)=>[k,{sel:sw[i]}])),walk_min:65,walk_kmh:5,exercise_min:0,beers:0,fried_g:0};
const d=calcDay(s,SEED.foods,SEED.recipes,day,132.78571428571428);
console.log('courses',d.courses.map(c=>c.kcal.toFixed(2)),'tot',d.tot.kcal.toFixed(2),'prot',d.tot.p.toFixed(2),'protTarget',d.protTarget);
console.log(d.checks.map(c=>c.text)); console.log(d.summary);
const d2=calcDay(s,SEED.foods,SEED.recipes,{...day,beers:6,fried_g:200},132.79); console.log('friday',d2.tot.kcal.toFixed(1),d2.checks[0].text,'|',d2.friday);
const ov=calcOverview(s,SEED.measurements); console.log(ov.cur,ov.q4,ov.forecast,ov.avgWeekLoss,ov.dev,ov.weekBack.text,ov.phase,ov.pvr[0]);
const pd=calcPlanDay(s,SEED.foods,SEED.recipes,SEED.sample_week['Úterý'],132.78571428571428); console.log('tue',pd.kcal.toFixed(2),pd.p.toFixed(3),pd.protTarget,pd.status);
const pd2=calcPlanDay(s,SEED.foods,SEED.recipes,SEED.sample_week['Sobota'],132.78571428571428); console.log('sat',pd2.kcal.toFixed(2),pd2.p.toFixed(3),pd2.protTarget,pd2.status);
const pd3=calcPlanDay(s,SEED.foods,SEED.recipes,SEED.sample_week['Pondělí'],132.78571428571428); console.log('mon',pd3.kcal.toFixed(2),pd3.p.toFixed(3));
`;
new Function(code)();
