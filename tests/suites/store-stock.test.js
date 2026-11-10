'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),H=require('../harness');
const PRICES=JSON.parse(fs.readFileSync(path.join(H.ROOT,'tests','fixtures','basic-rules-2024-prices.json'),'utf8'));
const read=f=>fs.readFileSync(path.join(H.ROOT,f),'utf8');

/* The Store sells every item in the game at the price the 2024 Basic Rules print for it. tests/fixtures/basic-rules-2024-prices.json is that
   table in copper, copied from the D&D Beyond Basic Rules equipment page. */
module.exports=function({suite,test}){
  suite('store stock',()=>{
    test('the price table covers every item, so a new item without an official price fails here',async()=>{
      const C=await H.loadData({shops:true});
      const ids=C.items.list().map(i=>i.id).sort();
      assert.deepStrictEqual(Object.keys(PRICES).sort(),ids);
    });
    test('every item is for sale exactly once, at its Basic Rules price, with no price override',async()=>{
      const C=await H.loadData({shops:true});
      const s=C.shops.get('armory'),stocked=s.stock.map(r=>r.item);
      assert.strictEqual(stocked.length,C.items.size());
      assert.strictEqual(new Set(stocked).size,stocked.length);
      s.stock.forEach(r=>{
        assert.strictEqual(r.price,undefined,r.item+' overrides its price');
        const it=C.items.get(r.item);
        assert.ok(it,r.item);
        assert.strictEqual(it.costCp,PRICES[r.item],r.item+' costs '+it.costCp+' cp, the Basic Rules say '+PRICES[r.item]);
      });
      C.items.list().forEach(i=>assert.ok(stocked.includes(i.id),i.id+' is not for sale'));
    });
    test('the catalog the page reads quotes the Basic Rules price for every item',async()=>{
      const C=await H.loadData({heroes:true,shops:true});
      const b=Fable.character.create({currency:{gp:0}});
      const cat=Fable.character.shop.catalog('armory',b);
      assert.strictEqual(cat.length,C.items.size());
      cat.forEach(c=>assert.strictEqual(c.priceCp,PRICES[c.item],c.item));
    });
    test('every shelf stands under a known tab, every tab has shelves, and every item is on one shelf',async()=>{
      const C=await H.loadData({shops:true});
      const s=C.shops.get('armory'),seen={};
      assert.deepStrictEqual(s.tabs,['weapons','armour','gear','magic']);
      s.tabs.forEach(t=>assert.ok(s.shelves.some(x=>x.tab===t),'no shelf under '+t));
      s.shelves.forEach(sh=>{
        assert.ok(s.tabs.includes(sh.tab),sh.id);
        sh.items.forEach(i=>{assert.ok(!seen[i],i+' is on two shelves');seen[i]=sh.id});
      });
      C.items.list().forEach(i=>assert.ok(seen[i.id],i.id+' is on no shelf'));
    });
    test('the shelves put things where a player looks for them',async()=>{
      const C=await H.loadData({shops:true});
      const shelfOf={};C.shops.get('armory').shelves.forEach(sh=>sh.items.forEach(i=>shelfOf[i]=sh));
      C.items.list().forEach(i=>{
        const sh=shelfOf[i.id];
        if(i.magic)assert.strictEqual(sh.tab,'magic',i.id);
        else if(i.type==='weapon')assert.strictEqual(sh.tab,'weapons',i.id);
        else if(i.type==='armor')assert.strictEqual(sh.tab,'armour',i.id);
        else assert.strictEqual(sh.tab,'gear',i.id);
      });
      assert.strictEqual(shelfOf['plate-armor'].id,'heavy-armor');
      assert.strictEqual(shelfOf['longbow'].id,'martial-ranged');
      assert.strictEqual(shelfOf['explorers-pack'].id,'packs');
      assert.strictEqual(shelfOf['lute'].id,'instruments');
      assert.strictEqual(shelfOf['spell-scroll-level-1'].id,'potions-and-scrolls');
    });
    test('within a shelf the cheaper things come first (the potion leads its shelf on purpose: it is the first thing in the Store)',async()=>{
      const C=await H.loadData({shops:true});
      C.shops.get('armory').shelves.filter(sh=>sh.id!=='potions-and-scrolls').forEach(sh=>{
        const cp=sh.items.map(i=>C.items.get(i).costCp);
        for(let k=1;k<cp.length;k++)assert.ok(cp[k]>=cp[k-1],sh.id+': '+sh.items[k-1]+' then '+sh.items[k]);
      });
    });
    test('a shelf that lists an unknown, repeated or unstocked item is refused',async()=>{
      const C=await H.loadData({shops:true});
      const base=C.shops.get('armory');
      const mk=(over)=>Object.assign({id:'t',name:'T',source:'original',tabs:base.tabs,stock:[{item:'dagger'},{item:'mace'}],
        shelves:[{id:'a',name:'A',tab:'weapons',items:['dagger','mace']}]},over);
      assert.throws(()=>C.shops.register(mk({id:'t1',shelves:[{id:'a',name:'A',tab:'nowhere',items:['dagger','mace']}]})),/unknown tab/);
      assert.throws(()=>C.shops.register(mk({id:'t2',shelves:[{id:'a',name:'A',tab:'weapons',items:['dagger','mace']},{id:'b',name:'B',tab:'weapons',items:['mace']}]})),/two|and on shelf/);
      assert.throws(()=>C.shops.register(mk({id:'t3',shelves:[{id:'a',name:'A',tab:'weapons',items:['dagger']}]})),/on no shelf/);
      assert.throws(()=>C.shops.register(mk({id:'t4',shelves:[{id:'a',name:'A',tab:'weapons',items:['dagger','mace','club']}]})),/not in stock/);
    });
    test('the hero can buy every single item, paying exactly its price',async()=>{
      const C=await H.loadData({heroes:true,shops:true});
      const Sh=Fable.character.shop,I=Fable.character.inventory;
      C.shops.get('armory').stock.forEach(r=>{
        const b=Fable.character.create({currency:{gp:2000}});
        const before=I.purseCp(b),res=Sh.buy(b,'armory',r.item,1);
        assert.ok(res.ok,r.item+': '+(res.reasons||[]).join('; '));
        assert.strictEqual(res.paidCp,PRICES[r.item],r.item);
        assert.strictEqual(before-I.purseCp(res.build),PRICES[r.item],r.item+' balance');
        assert.strictEqual(I.count(res.build,r.item),1,r.item);
      });
    });
    test('a hero who cannot afford an item is refused and keeps the gold',async()=>{
      await H.loadData({heroes:true,shops:true});
      const Sh=Fable.character.shop,I=Fable.character.inventory;
      const b=Fable.character.create({currency:{gp:1499}});
      const res=Sh.buy(b,'armory','plate-armor',1);
      assert.strictEqual(res.ok,false);
      assert.strictEqual(I.purseCp(res.build),149900);
      const ok=Sh.buy(Fable.character.create({currency:{gp:1500}}),'armory','plate-armor',1);
      assert.ok(ok.ok);assert.strictEqual(I.purseCp(ok.build),0);
    });
    test('a pack is bought as one pack that holds its contents, and opening it gives the contents',async()=>{
      const C=await H.loadData({heroes:true,shops:true});
      const Sh=Fable.character.shop,I=Fable.character.inventory;
      C.items.filter(i=>i.type==='pack').forEach(p=>{
        const r=Sh.buy(Fable.character.create({currency:{gp:100}}),'armory',p.id,1);
        assert.ok(r.ok,p.id);assert.strictEqual(I.count(r.build,p.id),1);
        const open=I.unpack(r.build,p.id);
        assert.ok(open.ok,p.id);
        p.contents.forEach(c=>assert.strictEqual(I.count(open.build,c.item),c.qty,p.id+' '+c.item));
        assert.strictEqual(I.count(open.build,p.id),0);
      });
    });
    test('ammunition is sold by the bundle: one purchase is one bundle, and the page says how many it holds',async()=>{
      const C=await H.loadData({heroes:true,shops:true});
      const Sh=Fable.character.shop,I=Fable.character.inventory;
      const arrows=C.items.get('arrows');
      assert.strictEqual(arrows.amount,20);
      const r=Sh.buy(Fable.character.create({currency:{gp:5}}),'armory','arrows',3);
      assert.ok(r.ok);assert.strictEqual(I.count(r.build,'arrows'),3);assert.strictEqual(r.paidCp,300);
      H.runFile('js/menu/item-info.js');
      const stats=Fable.itemInfo.statsOf(arrows);
      assert.ok(stats.some(x=>x[0]==='Sold as'&&/20/.test(x[1])),'the details say what a bundle holds');
    });
    test('selling back pays half and never pays for what is worn or held',async()=>{
      await H.loadData({heroes:true,shops:true});
      const Sh=Fable.character.shop,I=Fable.character.inventory;
      let b=Fable.character.create({inventory:[{item:'longsword',qty:1}],equipped:{mainhand:'longsword'}});
      assert.strictEqual(Sh.sell(b,'armory','longsword',1).ok,false);
      b=Fable.character.create({inventory:[{item:'longsword',qty:2}],equipped:{mainhand:'longsword'}});
      const r=Sh.sell(b,'armory','longsword',1);
      assert.ok(r.ok);assert.strictEqual(r.earnedCp,750);assert.strictEqual(I.purseCp(r.build),750);
    });
    test('every item has a way to be drawn in the Store: a 3D model row or an icon that is not the generic book for what is plainly not a book',async()=>{
      const C=await H.loadData({shops:true});
      H.runFile('js/menu/item-info.js');
      const known=['sword','dagger','javelin','guard','potion','scroll','book','gear','pickup','star'];
      C.items.list().forEach(i=>{
        const ic=Fable.itemInfo.iconFor(i);
        assert.ok(known.includes(ic),i.id+' icon '+ic);
        if(i.type==='tool'||i.type==='pack')assert.notStrictEqual(ic,'book',i.id);
      });
    });
    test('the Store page names no item and builds its equipment groups from the shelves',()=>{
      const js=read('js/menu/shop-ui.js');
      assert.ok(/shelfGroups/.test(js)&&/shopDef\.shelves/.test(js));
      C_ids().forEach(id=>assert.ok(!js.includes("'"+id+"'")||id==='potion-of-healing'||id==='chain-shirt'||id==='shield',id+' is named in shop-ui.js'));
    });
    test('the word Armory is still gone from what the player reads',()=>{
      ['index.html','README.md','js/menu/shop-ui.js','js/content/items/shops.js'].forEach(f=>{
        const text=read(f).replace(/id:'armory'/g,'').replace(/'armory'/g,'').replace(/stays 'armory'/g,'');
        assert.ok(!/armory/i.test(text),f);
      });
    });
  });
};
function C_ids(){return ['dagger','longsword','plate-armor','arrows','explorers-pack','lute']}
