from playwright.sync_api import sync_playwright
from pathlib import Path
import json
HTML=Path('/mnt/data/JollyJacks_Parlamentum_Toolkit_V1.1.html').read_text()

def make_html(fixture=None):
 data=json.dumps(fixture or {},ensure_ascii=True).replace('</','<\\/')
 inject='''<script>Object.defineProperty(window,"localStorage",{configurable:true,value:{data:'''+json.dumps({'jollyjacks_full_v1':json.dumps(fixture)})+''',getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=v},removeItem(k){delete this.data[k]}}});</script>'''
 return HTML.replace('<head>','<head>'+inject,1)

fixture={'schema':3,'profile':{'name':'','level':'','economy':'','education':'','war':'','homeCountryId':'','avatar':'','notes':''},
'countries':[{'id':'wv','name':'Test Country','productionTax':'5','incomeTax':'5.5','exportTax':'5','importTax':'5','usdPerUnit':'1','ideology':'None','capitalLost':'no'}],
'regions':[{'id':'reg','name':'Test Region','countryId':'wv','industry':'6','electricity':'10','crownRank':'none','pioneer':'7','capacityPercent':'100','bonuses':{'Raw Iron':'0'}}],
'workers':[{'id':'miner','name':'Paid miner','economy':'40','education':'20','level':'17','wage':'10','bonus':'0','owner':False},{'id':'owner','name':'Owner','economy':'40','education':'20','level':'17','owner':True}],
'companies':[{'id':'mine','name':'Ironworks','category':'Resource Plant','product':'Raw Iron','level':'4','regionId':'reg','workerIds':['miner'],'privateWorkers':[]},{'id':'forge','name':'Warworks','category':'Factory','product':'Weapon','tier':'T1','level':'1','regionId':'reg','workerIds':['owner'],'privateWorkers':[]}],
'chains':[{'id':'chain','name':'Iron to T1','description':'','nodes':[{'id':'a','kind':'company','linked':True,'companyId':'mine','x':30,'y':140},{'id':'b','kind':'company','linked':True,'companyId':'forge','x':400,'y':140},{'id':'c','kind':'market','venue':'global','prices':'Weapon T1:0.89','x':800,'y':140}], 'links':[{'id':'ab','from':'a','to':'b'},{'id':'bc','from':'b','to':'c'}],'settings':{'exchangeRate':'24.5','leftCollapsed':False,'rightCollapsed':False,'grid':True,'snap':False},'updated':123456}],
'templates':[],'settings':{'grid':True,'snap':False,'exchangeRate':'','marketPrices':'','calculator':{}}}

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
 fresh=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 fresh.set_content(make_html(),wait_until='load')
 assert fresh.locator('main h1').first.count() and 'Build your empire' in fresh.locator('main h1').first.inner_text()
 fresh.click('[data-nav="workers"]');fresh.click('[data-act="create-worker"]')
 text=fresh.locator('.modal').inner_text()
 assert 'Planned shifts' not in text and 'Energy allocated' not in text
 print('Fresh empty UI and worker editor passed')
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(make_html(fixture),wait_until='load')
 page.click('[data-nav="chains"]')
 page.click('[data-open-chain="chain"]')
 print('Quick panel:',page.locator('.chain-quick').inner_text()[:400].replace('\n',' | '))
 assert page.locator('#quick-shift-count').input_value()=='1'
 assert page.locator('.quick-metrics').count()==1
 assert page.locator('.results-panel').count()==1
 page.screenshot(path='/mnt/data/JollyJacks_V1_1_SupplyChain.png',full_page=True)
 before=page.locator('.quick-metrics').inner_text()
 page.click('[data-quick-shifts="3"]')
 assert page.locator('#quick-shift-count').input_value()=='3'
 after=page.locator('.quick-metrics').inner_text()
 print('profit before:',before.replace('\n',' '),'profit after:',after.replace('\n',' '))
 assert before!=after
 # Market doesn't need manually entered exporter; price editors populated by product type.
 page.locator('[data-select-node="c"]').click()
 assert page.locator('[data-market-price="Weapon T1"]').count()==1
 print('market:',page.locator('.inspector-panel').inner_text()[:280].replace('\n',' | '))
 page.locator('[data-market-price="Weapon T1"]').fill('1.05');page.locator('[data-market-price="Weapon T1"]').blur()
 assert page.locator('[data-market-price="Weapon T1"]').input_value()=='1.05'
 # Company shift override isn't in Advanced.
 page.locator('[data-select-node="a"]').click()
 assert page.locator('[data-node-shifts]').count()==1
 page.locator('[data-node-shifts]').fill('1');page.locator('[data-node-shifts]').blur()
 assert page.locator('[data-node-shifts]').input_value()=='1'
 # Automatic worker simulation and settings persist in V1-compatible key.
 saved=json.loads(page.evaluate('localStorage.getItem("jollyjacks_full_v1")'))
 assert saved['chains'][0]['settings']['shiftCount']=='3'
 assert saved['chains'][0]['nodes'][0]['shiftCount']=='1'
 assert saved['chains'][0]['nodes'][2]['prices'].find('1.05')>=0
 # Profit button and collapsible panels.
 page.click('[data-v1="results"]')
 page.click('[data-v1="toggle-left"]');page.click('[data-v1="toggle-right"]')
 cls=page.locator('.workspace').get_attribute('class')
 print('collapsed:',cls)
 assert 'left-collapsed' in cls and 'right-collapsed' in cls
 assert not errors,errors
 browser.close()
print('PASS V1.1 UI: fresh install, worker forms, shift buttons, auto profitability, market price editing, company shift override, persistence, panel toggles')
