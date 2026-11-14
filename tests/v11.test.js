const A=require('node:assert/strict');
const J=require('../assets/engine.js');
for(const [i,t] of ['T1','T2','T3','T4','T5'].entries()){
 A.equal(J.inputRecipe({category:'Factory',product:'Weapon',tier:t})['Raw Iron'],[10,20,35,60,100][i]);
 A.equal(J.inputRecipe({category:'Factory',product:'Food',tier:t})['Raw Grain'],[10,20,35,60,100][i]);
 A.equal(J.inputRecipe({category:'Factory',product:'Ticket',tier:t})['Raw Oil'],[25,50,90,150,250][i]);
 A.deepEqual(Object.values(J.inputRecipe({category:'Heavy Industry',product:'Ships',tier:t})),[[2,1,1],[4,2,2],[6,4,4],[12,6,6],[20,10,10]][i]);
}
A.deepEqual(J.inputRecipe({category:'Light Industry',product:'Construction Materials'}),{'Raw Iron':5,Timber:5});
A.deepEqual(J.inputRecipe({category:'Light Industry',product:'Fuel'}),{Coal:5,'Raw Oil':5});
A.deepEqual(J.inputRecipe({category:'Light Industry',product:'Electronics'}),{'Raw Copper':5,'Raw Cotton':5});
A.equal(J.workEnergyPerShift(1),100);A.equal(J.workEnergyPerShift(17),180);A.equal(J.workEnergyPerShift(99),300);
const db={profile:{},countries:[{id:'wv',name:'WV',productionTax:'5',incomeTax:'5.5',exportTax:'5',usdPerUnit:'1',ideology:'None',capitalLost:'no'}],regions:[{id:'reg',name:'Region',countryId:'wv',industry:'6',electricity:'10',crownRank:'none',pioneer:'7',capacityPercent:'100',bonuses:{'Raw Iron':'0'}}],workers:[{id:'miner',name:'Miner',economy:'40',education:'20',level:'17',wage:'10',bonus:'0',owner:false},{id:'owner',name:'Owner',economy:'40',education:'20',level:'17',owner:true}],companies:[]};
const mine={id:'mine',name:'Ironworks',category:'Resource Plant',product:'Raw Iron',level:'4',regionId:'reg',workerIds:['miner'],privateWorkers:[]};
const forge={id:'forge',name:'Warworks',category:'Factory',product:'Weapon',tier:'T1',level:'1',regionId:'reg',workerIds:['owner'],privateWorkers:[]};
db.companies.push(mine,forge);
const first=J.projectCompany(mine,db);A.equal(first.ready,true);A.equal(first.gross,99);A.equal(first.units,95);A.equal(first.wagesUSD,180);A.equal(first.workers[0].shifts,1);
const three=J.projectCompany(mine,db,{shifts:3});A.equal(three.workers[0].shifts,3);A.equal(three.gross,297);A.equal(three.wagesUSD,540);
const splitCompany={...mine,workerIds:['miner','owner']};const distributed=J.projectCompany(splitCompany,db,{shifts:3});A.deepEqual(distributed.shiftAllocation,[2,1]);A.equal(distributed.shiftCount,3);A.equal(distributed.wageLocal,360);
const manual=J.projectCompany(splitCompany,db,{shifts:10,workerShifts:{miner:3,owner:0}});A.deepEqual(manual.shiftAllocation,[3,0]);A.equal(manual.shiftCount,3);
const mkchain=(shifts)=>({settings:{exchangeRate:'24.5',shiftCount:String(shifts)},nodes:[{id:'a',kind:'company',linked:true,companyId:'mine'},{id:'b',kind:'company',linked:true,companyId:'forge'},{id:'c',kind:'market',venue:'global',prices:'Weapon T1:0.89'}],links:[{id:'ab',from:'a',to:'b'},{id:'bc',from:'b',to:'c'}]});
const oneSim=J.simulateChain(mkchain(1),db);A.deepEqual(oneSim.issues,[]);A.equal(oneSim.results.a.produced['Raw Iron'],95);A.equal(oneSim.results.b.produced['Weapon T1'],9);A.equal(oneSim.results.b.produced['Raw Iron'],-90);A.equal(oneSim.results.a.shifts,1);A.equal(oneSim.results.b.shifts,1);A.ok(oneSim.netGold>7);A.ok(oneSim.profitUSD>0);A.equal(oneSim.results.c.warnings.find(x=>x.includes('Exporter country')),undefined);
const threeSim=J.simulateChain(mkchain(3),db);A.equal(threeSim.results.a.shifts,3);A.equal(threeSim.results.b.shifts,3);A.ok(threeSim.profitUSD>oneSim.profitUSD);
const over=mkchain(10);over.nodes[0].shiftCount='1';over.nodes[1].shiftCount='3';const overSim=J.simulateChain(over,db);A.equal(overSim.results.a.shifts,1);A.equal(overSim.results.b.shifts,3);
const taxUnknown=JSON.parse(JSON.stringify(db));taxUnknown.countries[0].productionTax='';const missing=J.simulateChain(mkchain(1),taxUnknown);A.equal(missing.profitUSD,null);A.ok(missing.warnings.some(x=>x.includes('production tax')));
const noStaff=JSON.parse(JSON.stringify(db));noStaff.companies[0].workerIds=[];const missingStaff=J.simulateChain(mkchain(1),noStaff);A.equal(missingStaff.profitUSD,null);
const damage=J.combat({level:'17',strength:'10',energy:'100',weapons:'1000',tier:5,military:'5',electricity:'10',command:'0'});A.equal(damage.equip,30);A.ok(Math.abs(damage.damage-1485)<1e-8);
console.log('PASS V1.1 engine: tiers, work-energy cap, shift counts, automatic distribution, manual assignment, sale country inheritance, profitability and missing-data gating');
