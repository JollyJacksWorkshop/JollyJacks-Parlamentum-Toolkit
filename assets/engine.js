/* JollyJack's Parlamentum Toolkit V1 — offline, deterministic calculator engine.
   Rules checked against Parlamentum Book (Nov 14, 2026):
   /docs/en/companies-production, /energy-work, /formula-reference,
   /markets-tax-fx, /infrastructure-regions, /minor-updates, /war.
   All inputs are user-provided. Missing inputs produce warnings, never pretend to be live game data.
*/
(function(root){'use strict';
const EPS=1e-8;
const RES=['Raw Grain','Raw Iron','Raw Oil','Raw Cotton','Timber','Coal','Raw Copper'];
const MULT=[1,.8,.65,.5,.4], COMBAT=[1,1.5,2,2.5,3];
const FOOD=[10,20,35,60,100],TICKET=[25,50,90,150,250];
const SHIPS=[[2,1,1],[4,2,2],[6,4,4],[12,6,6],[20,10,10]];
const clamp=(x,min=0,max=1e10)=>{const v=Number(x);return Number.isFinite(v)?Math.min(max,Math.max(min,v)):min};
const has=x=>x!==undefined&&x!==null&&String(x).trim()!=='';
const take=(o,k,d=0)=>has(o?.[k])?clamp(o[k],-1e7,1e10):d;
const floor=x=>Math.floor(x+EPS);
const currencyTax=(amount,pct)=>{if(amount<=0||pct<=0)return 0;return Math.min(amount,Math.max(.01,floor(amount*pct)/100));};
const productKey=c=>c.category==='Resource Plant'?c.product:((c.category==='Factory'||c.category==='Heavy Industry')?c.product+' '+c.tier:c.product);
const inputRecipe=c=>{
 const p=c?.product||'',t=Math.max(0,Math.min(4,(parseInt((c.tier||'T1').replace('T',''),10)||1)-1));
 if(c?.category==='Resource Plant')return {};
 if(c?.category==='Factory')return p==='Food'?{'Raw Grain':FOOD[t]}:p==='Weapon'?{'Raw Iron':FOOD[t]}:p==='Ticket'?{'Raw Oil':TICKET[t]}:{};
 if(c?.category==='Light Industry')return p==='Construction Materials'?{'Raw Iron':5,Timber:5}:p==='Fuel'?{Coal:5,'Raw Oil':5}:p==='Electronics'?{'Raw Copper':5,'Raw Cotton':5}:{};
 if(c?.category==='Heavy Industry'&&p==='Ships')return {'Construction Materials':SHIPS[t][0],Fuel:SHIPS[t][1],Electronics:SHIPS[t][2]};
 return {};
};
const tierMult=c=>(c.category==='Factory'||c.category==='Heavy Industry')?MULT[Math.max(0,Math.min(4,(parseInt((c.tier||'T1').replace('T',''),10)||1)-1))]:1;
const statMult=(e,d,l)=>1+.02*e+.015*d+.005*(l-1);
function effectiveEnergy(start,energy,premium=false){let remaining=clamp(energy,0,1e7),pos=clamp(start,0,1e9),total=0;const limits=premium?[12500,17500]:[10000,15000];for(const [end,m] of [[limits[0],1],[limits[1],.75],[Infinity,.5]]){const piece=Math.max(0,Math.min(remaining,end-pos));total+=piece*m;pos+=piece;remaining-=piece;if(!remaining)break}return total;}
function rateFor(c,w,reg,country,opt={}){
 const errors=[],warnings=[];
 if(!c||!c.category||!c.product)errors.push('Select a company category and product.');
 if(!has(c?.level))errors.push('Company level is unknown.');
 if(!has(w?.economy)||!has(w?.education)||!has(w?.level))errors.push('Worker Economy, Education and character level are required.');
 if(!reg){errors.push('Assign a saved region to use the regional production indexes.');}
 else if(!has(reg.industry)||!has(reg.electricity))errors.push('Region Industry and Electricity indexes are required.');
 if(errors.length)return {ready:false,rate:null,errors,warnings};
 const lvl=clamp(w.level,1,1e6), coLevel=clamp(c.level,1,1e6),rank=take(reg,'crownRank',0);
 const crown=rank===1?1.3:rank===2?1.2:rank===3?1.1:1;
 if(!has(reg.crownRank))warnings.push('City ranking unknown; no crown bonus applied.');
 const socialism=country?.ideology==='Socialism'?.15:0;
 if(!country||!has(country.ideology))warnings.push('Country ideology unknown; no ideology bonus applied.');
 const convoy=take(w,'mobileWorkshop',0)/100+take(c,'extraIndustry',0)/100;
 const industry=1+.25*clamp(reg.industry,0,10)/10*clamp(reg.electricity,0,10)/10*crown+socialism+convoy;
 const capacity=has(reg.capacityPercent)?(clamp(reg.capacityPercent,0,100)>=50?1:.5+.5*clamp(reg.capacityPercent,0,100)/50):1;
 if(!has(reg.capacityPercent))warnings.push('Regional capacity unknown; no crowding penalty assumed in this estimate.');
 const players=take(reg,'activePlayers',-1);
 const pioneer=has(reg.pioneer)?1+clamp(reg.pioneer,0,10)/100:players>=0?(players<=15?1.10:players>=30?1:1+.1*(30-players)/15):1;
 if(!has(reg.pioneer)&&!has(reg.activePlayers))warnings.push('Pioneer bonus unknown; not included.');
 let dep=0;
 if(c.category==='Resource Plant'){
   const bonus=reg.bonuses?.[c.product];
   if(has(bonus))dep=clamp(bonus,0,200);
   else warnings.push(`${c.product} regional deposit unknown; no deposit bonus applied.`);
 }
 const comp=c.category==='Resource Plant'?(1+.01*(coLevel-1)):(tierMult(c)*(1+.02*(coLevel-1)));
 const basic=2*statMult(clamp(w.economy),clamp(w.education),lvl)*comp*(1+dep/100);
 const rate=Math.max(1,basic*industry*capacity*pioneer);
 const capital=(country?.capitalLost===true||country?.capitalLost==='yes')?0.9:1;
 if(!country||country.capitalLost===undefined||country.capitalLost==='')warnings.push('Capital-loss status unspecified; no capital-loss penalty applied.');
 return {ready:true,rate,capital,industry,capacity,pioneer,deposit:dep,crown,errors,warnings};
}
function energyFor(units,rate,energy,start,premium,capital=1){if(units<=0)return 0;let lo=0,hi=Math.floor(clamp(energy,0,300));const output=e=>floor(rate*effectiveEnergy(start,e,premium)*capital/10);if(output(hi)<units)return hi;while(lo<hi){const mid=Math.floor((hi+lo)/2);if(output(mid)>=units)hi=mid;else lo=mid+1;}return lo;}
function workEnergyPerShift(level){return Math.min(300,100+5*(Math.max(1,Math.floor(clamp(level,1,10000)))-1));}
function companyWorkers(c,db){
 const linked=(c.workerIds||[]).map(workerId=>db.workers.find(x=>x.id===workerId)||(c.embeddedLibraryWorkers||[]).find(x=>x.id===workerId)).filter(Boolean);
 const privatePeople=c.privateWorkers||[];
 return [...linked,...privatePeople].map(w=>w.owner?{...w,economy:has(w.economy)?w.economy:db.profile?.economy,education:has(w.education)?w.education:db.profile?.education,level:has(w.level)?w.level:db.profile?.level}:w);
}
function shiftAllocation(workers,total,manual={}){
 const requested=Math.floor(clamp(total,0,10000));
 const manualKeys=manual&&typeof manual==='object'?Object.keys(manual):[];
 if(manualKeys.length)return workers.map(w=>Math.floor(clamp(manual[w.id]||0,0,10000)));
 return workers.map((w,i)=>Math.floor(requested/workers.length)+(i<requested%workers.length?1:0));
}
function projectWorker(c,w,reg,country,opt={}){
 const shifts=Math.floor(clamp(has(opt.shifts)?opt.shifts:1,0,10000));
 if(shifts===0)return {ready:true,rate:null,errors:[],warnings:[],total:0,net:0,wages:0,energy:0,tax:0,rows:[],shifts:0,energyPerShift:has(w.level)?workEnergyPerShift(w.level):null};
 const info=rateFor(c,w,reg,country,opt),warnings=[...info.warnings],errors=[...info.errors];
 if(!w.owner&&(!has(w.wage)||!has(w.bonus)))errors.push('Set the worker base wage and wage skill multiplier in their worker profile (enter 0 explicitly if applicable).');
 if(c.category==='Resource Plant'&&!has(country?.productionTax))errors.push('Set the production tax for this region’s controlling country (0 is allowed).');
 if(errors.length)return {ready:false,rate:info.rate,errors,warnings,total:0,net:0,wages:0,energy:0,tax:0,rows:[],shifts};
 const capped=workEnergyPerShift(w.level);
 const taxPct=c.category==='Resource Plant'?clamp(country.productionTax,0,50):0;
 const fatigueStart=take(w,'dailyEnergy',0),premium=w.premium===true;
 if(!has(w.dailyEnergy)&&shifts>1)warnings.push('Hypothetical consecutive shifts start from zero daily work fatigue. Actual energy balance or regeneration is not guaranteed.');
 let total=0,net=0,wages=0,energy=0,tax=0,daily=fatigueStart;
 const rows=[];
 const wage10=w.owner?0:floor((clamp(w.wage)+clamp(w.economy)*clamp(w.bonus,0,50)/100)*100)/100;
 const useCount=Math.min(shifts,2000);
 if(shifts>2000)warnings.push('Only first 2,000 simulated shifts per worker are calculated to limit processing time.');
 for(let i=0;i<useCount;i++){
   const out=floor(info.rate*effectiveEnergy(daily,capped,premium)*info.capital/10);
   const spent=energyFor(out,info.rate,capped,daily,premium,info.capital);
   const taxed=c.category==='Resource Plant'?floor(out*taxPct/100):0;
   const effective=effectiveEnergy(daily,spent,premium);
   const pay=w.owner?0:floor(wage10*effective/10*100)/100;
   total+=out;net+=out-taxed;wages+=pay;energy+=spent;tax+=taxed;daily+=spent;
   if(i<5)rows.push({produced:out,retained:out-taxed,wages:pay,energy:spent});
 }
 return {ready:true,rate:info.rate,gross:total,total,net,wages,energy,tax,rows,wage10,errors,warnings,shifts,energyPerShift:capped};
}
function projectCompany(c,db,opt={}){
 const region=c?.regionId?(db.regions.find(x=>x.id===c.regionId)||c.embeddedRegion||null):null;
 const country=(region?db.countries.find(x=>x.id===(opt.regionOverrides?.[region.id]||region.countryId)):db.countries.find(x=>x.id===c.directCountryId))||c.embeddedCountry||null;
 const workers=companyWorkers(c,db);
 const count=has(opt.shifts)?opt.shifts:1;
 const allocations=shiftAllocation(workers,count,opt.workerShifts||{});
 const results=workers.map((w,i)=>projectWorker(c,w,region,country,{...opt,shifts:allocations[i]}));
 const errors=results.flatMap(r=>r.errors||[]),warnings=[...new Set(results.flatMap(r=>r.warnings||[]))];
 if(!workers.length)errors.push('No workers assigned. Add a saved worker or your own profile to this company.');
 if(workers.length&&allocations.every(x=>x===0))errors.push('Assign at least one simulated shift to this company.');
 const ready=workers.length>0&&allocations.some(x=>x>0)&&results.every(r=>r.ready);
 const gross=results.reduce((a,x)=>a+(x.total||0),0),units=results.reduce((a,x)=>a+(x.net||0),0),wageLocal=results.reduce((a,x)=>a+(x.wages||0),0);
 const convert=country?(has(country.usdPerUnit)?Number(country.usdPerUnit):null):null;
 if(wageLocal>0&&convert===null)warnings.push('USD conversion for the country’s local currency is unknown. Enter it in Countries.');
 const wagesUSD=wageLocal===0?0:convert===null?null:wageLocal*convert;
 return {ready,workers:results,workerNames:workers.map(w=>w.name||'(Unnamed worker)'),shiftAllocation:allocations,shiftCount:allocations.reduce((a,b)=>a+b,0),region,country,errors:[...new Set(errors)],warnings,gross,units,wageLocal,wagesUSD,taxUnits:gross-units,product:productKey(c)};
}
function parseStock(input){const result={};if(!has(input))return result;for(const p of String(input).split(/[,;\n]+/)){const m=p.trim().match(/^(.+?)\s*[:=]\s*(\d+(?:\.\d+)?)$/);if(m){const name=m[1].trim();result[name]=(result[name]||0)+Math.floor(Number(m[2]));}}return result;}
function parsePrices(input){const result={};if(!has(input))return result;for(const p of String(input).split(/[;\n]+/)){const m=p.trim().match(/^(.+?)\s*[:=]\s*(\d+(?:\.\d+)?)$/);if(m)result[m[1].trim()]=Number(m[2]);}return result;}
function marketSale(qty,price,market,taxPct,fx=undefined,localFX=undefined){
 const q=Math.floor(clamp(qty)),p=clamp(price),gross=q*p,tax=currencyTax(gross,clamp(taxPct,0,50)),net=gross-tax;
 return {qty:q,price:p,market,gross,tax,net,netUnit:q?net/q:0,usdPerUnit:market==='global'?(has(fx)?(q?net/q*fx:0):null):(has(localFX)?(q?net/q*localFX:0):null),usd:market==='global'?(has(fx)?net*fx:null):(has(localFX)?net*localFX:null)};
}
function combat(v){
 const level=Math.max(1,Math.floor(clamp(v.level,1))),tier=Math.max(1,Math.min(5,Math.floor(clamp(v.tier,1,5)))),naval=v.naval===true;
 const block=naval?40:10,maxEnergy=Math.min(300,100+5*(level-1)),available=Math.min(maxEnergy,Math.floor(clamp(v.energy,0,300)));
 const perBlock=1+Math.floor(level/8),requests=naval?Math.floor(available/40):(available>=10?Math.ceil(available/10):0),blocks=Math.max(0,Math.min(requests,Math.floor(clamp(v.weapons,0)/perBlock)));
 const crown={1:1.3,2:1.2,3:1.1}[v.crown]||1;
 const mil=.2*clamp(v.military,0,10)/10*clamp(v.electricity,0,10)/10*crown;
 const bonus=1+mil+(v.nationalist?.1:0)+.008*clamp(v.command,0,10);
 const equip=blocks*perBlock,capital=v.capitalLost?.9:1;
 const damage=equip*(naval?4:1)*(5+clamp(v.strength))*COMBAT[tier-1]*bonus*capital;
 return {tier,naval,block,blocks,perBlock,equip,energy:naval?blocks*40:(blocks===requests?available:blocks*10),damage,low:blocks?floor(damage*.9):0,high:blocks?floor(damage*1.1):0,criticalLow:blocks?floor(damage*1.35):0,criticalHigh:blocks?floor(damage*1.65):0,mean:damage*1.025,militaryBonus:mil,totalBonus:bonus*capital,maxEnergy};
}
function simulateChain(chain,db){
 const issues=[],warnings=[],nodes=chain.nodes||[],links=chain.links||[],settings=chain.settings||{};
 const nodeById=Object.fromEntries(nodes.map(n=>[n.id,n]));const indeg=Object.fromEntries(nodes.map(n=>[n.id,0]));
 for(const l of links){if(indeg[l.to]!==undefined)indeg[l.to]++}
 const queue=nodes.filter(n=>indeg[n.id]===0).map(n=>n.id),order=[];
 while(queue.length){const id=queue.shift();order.push(id);for(const l of links.filter(x=>x.from===id)){if(--indeg[l.to]===0)queue.push(l.to)}}
 if(order.length!==nodes.length)issues.push('Chain has a cycle; break it before simulating.');
 const incoming=Object.fromEntries(nodes.map(n=>[n.id,{}]));const receiptCountry=Object.fromEntries(nodes.map(n=>[n.id,{}]));
 const results={},rows=[],revenueByCurrency={gold:0,local:0},warningsUSD=[];
 let incomeUSD=0,costUSD=0,incomeKnown=true,costKnown=true;
 const priceMap=parsePrices(settings.marketPrices);
 const available=n=>incoming[n.id]||{};
 const getCompany=n=>n.linked?(db.companies.find(c=>c.id===n.companyId)||n.snapshot):n.snapshot;
 for(const nid of order){
   const n=nodeById[nid],ins=available(n),out={},row={id:n.id,name:n.label||'',kind:n.kind,produced:{},inputs:{...ins},retained:{},wageUSD:0,wageLocal:0,revenueUSD:0,earnGold:0,warnings:[]};
   if(n.kind==='company'){
     const c=getCompany(n);if(!c){row.warnings.push('Missing linked company');results[n.id]=row;continue}
     row.name=c.name;const snapshot={...c,level:has(n.overrideLevel)?n.overrideLevel:c.level};
     const desired=has(n.shiftCount)?n.shiftCount:(has(settings.shiftCount)?settings.shiftCount:1);const result=projectCompany(snapshot,db,{regionOverrides:settings.regionOverrides||{},shifts:desired,workerShifts:n.workerShifts||{}});row.shifts=result.shiftCount;row.workers=result.workers.map((w,i)=>({name:result.workerNames[i],shifts:w.shifts,energy:w.energy,wages:w.wages}));row.warnings.push(...result.errors,...result.warnings);row.rate=result.workers[0]?.rate??null;
     const recipe=inputRecipe(snapshot);const initialInputs=parseStock(snapshot.inputStock);for(const [k,q] of Object.entries(initialInputs))ins[k]=(ins[k]||0)+q;const maxByInputs=Object.keys(recipe).length?Math.min(...Object.entries(recipe).map(([key,amount])=>Math.floor((ins[key]||0)/amount))):Infinity;
     const make=Math.max(0,Math.min(result.units||0,maxByInputs));
     if(make<(result.units||0)&&Object.keys(recipe).length)row.warnings.push('Not enough input materials; finished output limited by available resources.');
     if(!result.ready){row.warnings.push('Company information is incomplete; financial results cannot be finalized.');costKnown=false;}
     for(const [name,nper] of Object.entries(recipe)){const consume=make*nper;row.inputs[name]=ins[name]||0;row.produced[name]=-consume;ins[name]=(ins[name]||0)-consume;}
     const key=productKey(snapshot),initStock=Math.floor(clamp(snapshot.initialStock||0));
     out[key]=(out[key]||0)+make+initStock;
     if(initStock)row.warnings.push('Company starting stock is included in output; it is not newly produced.');
     row.produced[key]=make;row.retained[key]=make+initStock;row.wageLocal=result.wageLocal;
     if(result.wagesUSD===null){if(result.wageLocal>0)costKnown=false}else{row.wageUSD=result.wagesUSD||0;costUSD+=row.wageUSD;}
     row.countryId=result.country?.id||'';
     row.inputs={...row.inputs,...initialInputs};
     for(const [key,q] of Object.entries(ins)){if(q>0)out[key]=(out[key]||0)+q}
   }else if(n.kind==='storage'){
     row.name=n.label||'Storage';for(const [key,q] of Object.entries(ins))out[key]=(out[key]||0)+q;
     for(const [key,q] of Object.entries(parseStock(n.initialStock)))out[key]=(out[key]||0)+q;
   }else if(n.kind==='market'){
     row.name=n.label||'Market';const venue=n.venue||settings.market||'',prices={...priceMap,...parsePrices(n.prices)};
     for(const [key,q] of Object.entries(ins)){
       if(q<=0)continue;
       if(!venue){row.warnings.push('Market venue is not selected; this stock remains unsold.');out[key]=(out[key]||0)+q;continue}
       const price=prices[key];if(price===undefined){row.warnings.push(`No sale price for ${key}; no sale booked.`);out[key]=(out[key]||0)+q;continue}
       const autoCountry=receiptCountry[n.id][key]||'';const originId=n.exporterCountryId||autoCountry;
       const country=db.countries.find(x=>x.id===originId);
       const pct=venue==='global'?(country?country.exportTax:originId==='independent'?10:null):(country?country.incomeTax:null);
       if(originId==='__mixed__')row.warnings.push('Mixed-country source: choose the appropriate seller country on this Market block.');else if(!country&&originId!=='independent')row.warnings.push('Seller country cannot be inferred from the connected company. Choose a country on this Market block.');
       if(!has(pct)){row.warnings.push(`Unknown ${venue} sale tax for ${key}; tax modeled at 0 until entered.`)}
       if(!has(pct)){row.warnings.push(`Cannot finalize ${key} sales without a known seller-country tax.`);out[key]=(out[key]||0)+q;incomeKnown=false;continue}
       const sale=marketSale(q,price,venue,pct,settings.exchangeRate,country?.usdPerUnit);
       if(venue==='global'){row.earnGold+=sale.net;revenueByCurrency.gold+=sale.net}else{revenueByCurrency.local+=sale.net}
       if(sale.usd===null){incomeKnown=false;row.warnings.push(`Currency conversion unknown for ${key}; add exchange rate.`)}else{row.revenueUSD+=sale.usd;incomeUSD+=sale.usd;}
       row.produced[key]=-q;
     }
   }
   results[n.id]=row;
   // Move output along directed links according to explicit allocation. Unspecified connections use FIFO.
   const outgoing=links.filter(l=>l.from===n.id);
   for(const [key,value] of Object.entries(out)){
     let remain=Math.max(0,Math.floor(value));if(!remain)continue;
     const eligible=outgoing.filter(l=>{if(l.resource&&l.resource!==key)return false;const target=nodeById[l.to];if(!target)return false;if(target.kind!=='company')return true;const c=getCompany(target);return c?Object.hasOwn(inputRecipe(c),key):false});
     for(let i=0;i<eligible.length;i++){
       const l=eligible[i],mode=l.allocationMode,limit=clamp(l.allocationValue,0,1e9);
       let qty=remain;
       if(mode==='percent')qty=Math.min(remain,Math.floor(value*Math.min(100,limit)/100));
       else if(mode==='units')qty=Math.min(remain,Math.floor(limit));
       else if(!mode&&settings.resourcePriority==='balanced')qty=Math.ceil(remain/(eligible.length-i));
       if(qty<=0)continue;
       const target=incoming[l.to];target[key]=(target[key]||0)+qty;
       const prev=receiptCountry[l.to][key]||'';const sourceCountry=row.countryId||receiptCountry[n.id][key]||'';
       if(sourceCountry)receiptCountry[l.to][key]=!prev||prev===sourceCountry?sourceCountry:'__mixed__';
       remain-=qty;
     }
     if(remain)row.retained[key]=remain;
     else if(outgoing.length)row.retained[key]=0;
   }
   if(row.warnings.length)warnings.push(...row.warnings.map(x=>`${row.name}: ${x}`));
   rows.push(row);
 }
 return {rows,results,issues,warnings:[...new Set(warnings)],incomeUSD:incomeKnown?incomeUSD:null,costUSD:costKnown?costUSD:null,profitUSD:incomeKnown&&costKnown?incomeUSD-costUSD:null,netGold:revenueByCurrency.gold,unsold:rows.filter(r=>r.kind==='storage'||r.kind==='company').map(r=>({name:r.name,stock:r.retained})),mode:settings.simulationMode||'simple'};
}
const api={workEnergyPerShift,companyWorkers,shiftAllocation,RES,MULT,COMBAT,FOOD,TICKET,SHIPS,has,take,clamp,floor,currencyTax,productKey,inputRecipe,tierMult,statMult,effectiveEnergy,rateFor,projectWorker,projectCompany,parseStock,parsePrices,marketSale,combat,simulateChain};
if(typeof module==='object'&&module.exports)module.exports=api;
root.JJEngine=api;
})(typeof window==='object'?window:globalThis);
