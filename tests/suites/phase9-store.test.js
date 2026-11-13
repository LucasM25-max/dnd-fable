'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),H=require('../harness');
const read=f=>fs.readFileSync(path.join(H.ROOT,f),'utf8');

/* The Store page, the 3D dice and the end of fight screen: what can be checked without a browser (the pictures are checked by eye). */
module.exports=function({suite,test}){
  suite('phase 9 store and presentation',()=>{
    test('the shop is called The Store and keeps its id, and still stocks the first fight\'s items, with the potion first',async()=>{
      const C=await H.loadData({shops:true});
      const s=C.shops.get('armory');
      assert.strictEqual(s.name,'The Store');
      const ids=s.stock.map(r=>r.item);
      ['potion-of-healing','javelin','dagger','handaxe','mace','spear','leather-armor','chain-shirt','shield'].forEach(i=>assert.ok(ids.includes(i),i));
      assert.strictEqual(ids[0],'potion-of-healing');
      assert.strictEqual(C.items.get('potion-of-healing').costCp,5000);
    });
    test('the word Armory is gone from everything the player reads',()=>{
      ['index.html','README.md'].forEach(f=>assert.ok(!/armory/i.test(read(f)),f));
    });
    test('the page loads the new scripts before the files that use them',()=>{
      const h=read('index.html'),at=n=>h.indexOf('js/'+n);
      assert.ok(at('hud/dice3d.js')>0&&at('hud/dice3d.js')<at('hud/roll-feed.js'));
      assert.ok(at('menu/store-stage.js')>0&&at('menu/store-stage.js')<at('menu/store-previews.js'));
      assert.ok(at('menu/store-previews.js')<at('menu/shop-ui.js'));
    });
    test('the Store sells nothing back: no selling in its page',()=>{
      const js=read('js/menu/shop-ui.js');
      assert.ok(!/Ro\(\)\.sell|\.sell\(/.test(js));
      assert.ok(/Ro\(\)\.purchase/.test(js)&&/buyVictory/.test(js));
    });
    test('the Store page has its sections, and only tiles for what exists',()=>{
      const js=read('js/menu/shop-ui.js');
      ['Featured','Character','Weapons','Armour','Gear','Magic','Cosmetics','Subclasses','Species','Feats','Skins','Victory Animations','Backgrounds'].forEach(w=>assert.ok(js.includes(w),w));
    });
    test('a saved game loads: progress saved by the Store brings the game up instead of a black screen',async()=>{
      await H.loadData({heroes:true,shops:true});
      const store={};
      globalThis.window.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
      H.runFile('js/character/roster.js');
      const R=Fable.character.roster;
      store['dicebound.progress.v1']=JSON.stringify({v:1,heroes:{'human-fighter':{xp:10,currency:{gp:7},inventory:[{item:'dagger',qty:2},{item:'potion-of-healing',qty:2}],victory:{owned:['victory-spin'],selected:'victory-spin'}}}});
      R.forget();store['dicebound.progress.v1']=JSON.stringify({v:1,heroes:{'human-fighter':{xp:10,currency:{gp:7},inventory:[{item:'dagger',qty:2},{item:'potion-of-healing',qty:2}],victory:{owned:['victory-spin'],selected:'victory-spin'}}}});
      const b=R.build('human-fighter');
      assert.strictEqual(b.xp,10);assert.strictEqual(R.purseCp('human-fighter'),700);
      assert.ok(b.inventory.some(e=>e.item==='potion-of-healing'&&e.qty===2));
      delete globalThis.window.localStorage;
    });
    test('the potion model shows its liquid (the glass does not hide it)',()=>{
      const js=read('js/engine/gear-models.js'),i=js.indexOf('G.families.potion'),body=js.slice(i,js.indexOf('/* ---------- sling and whip'));
      assert.ok(/S\(g,'ell',0,h\*\.3,0,r\*2,h\*\.56,r\*2,C\.liquid\)/.test(body),'the flask body is the liquid');
      assert.ok(!/S\(g,'ell',0,h\*\.3[^\n]*C\.glass/.test(body),'no glass shell wraps the liquid');
    });
    test('the result screen has no frame: the plate is stripped and the title is on the right',()=>{
      const css=read('css/hud-combat.css');
      assert.ok(/\.prm\.results>\.plate>\.edge\{[^}]*background:none/.test(css));
      assert.ok(/\.rs-title\{[^}]*right:/.test(css)&&!/\.rs-title\{[^}]*left:0/.test(css));
    });
    test('the victory stage keeps the hero left of the result column',()=>{
      const js=read('js/presentation/director.js');
      assert.ok(/win:\{[^}]*shift:\.2\}/.test(js));
    });
  });
};
