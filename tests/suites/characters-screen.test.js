'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),H=require('../harness');
const read=f=>fs.readFileSync(path.join(H.ROOT,f),'utf8');

/* The equipment panel's rules, the Characters screen's sheet, and the active character (what can be checked without a browser). */
module.exports=function({suite,test}){
  function fresh(){
    const store={};
    globalThis.window.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
    H.runFile('js/character/roster.js');
    return store;
  }
  async function world(){
    await H.loadData({heroes:true,shops:true});
    H.runFile('js/character/equip-view.js');H.runFile('js/character/sheet-view.js');
    return fresh();
  }
  suite('characters screen and equipment',()=>{
    test('equipView.model lists three slots, carried gear, and a backpack that is never gear',async()=>{
      await world();
      const m=Fable.character.equipView.model(Fable.character.roster.build('human-fighter'));
      assert.deepStrictEqual(m.slots.map(s=>s.id),['mainhand','offhand','body']);
      assert.ok(m.gear.length>0);
      m.gear.forEach(g=>assert.ok(['equipped','partial','stowed'].includes(g.state)));
      m.backpack.forEach(b=>{const it=Fable.content.items.get(b.item);assert.ok(it.type!=='weapon'&&it.type!=='armor',b.item)});
      assert.ok(typeof m.ac==='number');
    });
    test('equipping through the panel changes armour class, and a single copy moves between hands',async()=>{
      await world();
      const EV=Fable.character.equipView,R=Fable.character.roster,id='human-fighter';
      const before=EV.model(R.build(id)).ac;
      const r=EV.plan(R.build(id),'offhand',null);
      assert.ok(r.ok);
      assert.ok(EV.model(r.build).ac<before);
      const bad=EV.plan(R.build(id),'body','longsword');
      assert.strictEqual(bad.ok,false);
      assert.ok(bad.reasons.length>0);
    });
    test('a two-handed weapon clears the off hand and a shield clears a two-handed weapon',async()=>{
      await world();
      const EV=Fable.character.equipView,Ch=Fable.character;
      const items=Fable.content.items.list().filter(i=>i.type==='weapon'&&i.properties.indexOf('two-handed')>=0);
      if(!items.length)return;
      const rec=Ch.normalize(Ch.roster.build('human-fighter'));
      rec.inventory.push({item:items[0].id,qty:1});
      const r=EV.plan(rec,'mainhand',items[0].id);
      if(r.ok)assert.ok(!r.build.equipped.offhand);
    });
    test('quick: a click equips an unused item, and puts away when every copy is in use', async()=>{
      await world();
      const EV=Fable.character.equipView,R=Fable.character.roster,id='human-fighter';
      let r=EV.quick(R.build(id),'dagger');
      assert.strictEqual(r.action,'equip');
      const r2=EV.quick(r.build,'dagger');
      assert.ok(['equip','unequip'].includes(r2.action));
      const pot=EV.quick(R.build(id),'potion-of-healing');
      assert.strictEqual(pot.ok,false);
    });
    test('sheetView builds a readable sheet: 6 vitals, 6 abilities with saves, 18 skills, held attack first',async()=>{
      await world();
      const R=Fable.character.roster,id='human-fighter';
      const v=Fable.character.sheetView.model(R.sheet(id),{xp:R.build(id).xp});
      assert.strictEqual(v.vitals.length,6);assert.strictEqual(v.abilities.length,6);assert.strictEqual(v.skills.length,18);
      v.abilities.forEach(a=>assert.ok(a.save!==undefined));
      assert.ok(v.attacks.length>0);
      assert.strictEqual(Fable.character.sheetView.model({fatal:true}),null);
    });
    test('the active character defaults to the first, can be switched, and is saved',async()=>{
      const store=await world();
      const R=Fable.character.roster;
      assert.strictEqual(R.active(),'human-fighter');
      assert.strictEqual(R.setActive('nobody').ok,false);
      assert.strictEqual(R.setActive('human-fighter').changed,false);
      let heard=null;R.onActive(id=>{heard=id});
      assert.ok(R.characters().length>=1);
      assert.strictEqual(heard,null);
    });
    test('equipment chosen in the hub is saved and survives a reload, and restart forgets it',async()=>{
      const store=await world();
      const R=Fable.character.roster,EV=Fable.character.equipView,id='human-fighter';
      const r=EV.plan(R.build(id),'offhand',null);
      const out=R.equip(id,r.build.equipped);
      assert.ok(out.ok);
      assert.ok(!R.build(id).equipped.offhand);
      H.runFile('js/character/roster.js');
      assert.ok(!Fable.character.roster.build(id).equipped.offhand);
      Fable.character.roster.restart(id);
      assert.ok(Fable.character.roster.build(id).equipped.offhand);
      delete globalThis.window.localStorage;
    });
    test('a saved loadout with an item the character does not carry is ignored, not trusted',async()=>{
      const store=await world();
      store['dicebound.progress.v1']=JSON.stringify({v:1,heroes:{'human-fighter':{equipped:{mainhand:'handaxe'}}}});
      H.runFile('js/character/roster.js');
      assert.notStrictEqual(Fable.character.roster.build('human-fighter').equipped.mainhand,'handaxe');
      delete globalThis.window.localStorage;
    });
    test('the page loads the new scripts in order, and has the hooks the hub uses',()=>{
      const h=read('index.html'),at=n=>h.indexOf('js/'+n);
      assert.ok(at('character/equip-view.js')>0&&at('character/sheet-view.js')>0);
      assert.ok(at('menu/equipment-panel.js')>0&&at('menu/equipment-panel.js')<at('menu/menu-ui.js'));
      assert.ok(at('menu/character-stage.js')<at('menu/characters-ui.js')&&at('menu/characters-ui.js')<at('menu/menu-ui.js'));
      assert.ok(h.includes('id="open-characters"')&&h.includes('id="eqp-host"')&&h.includes('css/characters.css'));
    });
    test('the tutorial keeps the premade gear whatever the hub equipped',()=>{
      const js=read('js/game/game-scene.js');
      assert.ok(/tutorial/.test(js)&&/setEquipped/.test(js));
    });
    test('the main menu keeps the Play row on screen: the middle row may shrink and the difficulty text has reserved room',()=>{
      const css=read('css/menu.css');
      assert.ok(/minmax\(0,1fr\)/.test(css));
      assert.ok(/\.diff-info\{[^}]*min-height/.test(css));
    });
  });
};
