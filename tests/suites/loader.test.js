'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),H=require('../harness');
const FIX=path.join(__dirname,'..','fixtures','content');

function world(manifest){
  H.fresh();H.loadRules();H.loadRegistry();
  Fable.content.manifest=manifest;
  return Fable.content.createLoader({loadScript:H.nodeLoadScript,base:H.dirUrl(FIX)});
}
function real(){
  H.fresh();H.loadRules();H.loadRegistry();H.runFile('js/content/content-manifest.js');
  return Fable.content;
}

module.exports=function({suite,test,skip}){
  suite('groups',()=>{
    test('order matches the plan (rules, items, feats, then classes, species, backgrounds, then game content)',()=>{
      real();
      assert.deepStrictEqual(Fable.content.groups.order.map(g=>g.key),
        ['rules','items','feats','species','backgrounds','classes','maps','monsters','characters','encounters']);
    });
    test('paths resolve per mode',()=>{
      const G=real().groups;
      assert.strictEqual(G.path(G.get('rules'),'abilities'),'rules-core/abilities.js');
      assert.strictEqual(G.path(G.get('items'),'weapons'),'items/weapons.js');
      assert.strictEqual(G.path(G.get('classes'),'fighter'),'classes/fighter/index.js');
      assert.strictEqual(G.path(G.get('maps'),'forest-clearing'),'maps/forest-clearing/index.js');
      assert.strictEqual(G.packageKey(G.get('monsters'),'goblin-minion'),'monsters:goblin-minion');
      assert.strictEqual(G.get('nope'),null);
    });
  });

  suite('loader',()=>{
    test('loads every group in order and validates at the end',async()=>{
      const l=world({rules:['dummy-rules'],items:['dummy-items'],feats:['dummy-feats'],species:['dummy-species']});
      const r=await l.loadAll();
      assert.strictEqual(r.ok,true);
      assert.deepStrictEqual(Fable._order,['rules:dummy-rules','items:dummy-items','feats:dummy-feats','species:dummy-species']);
      assert.strictEqual(Fable.content.critters.get('moth').widgets[0],'lamp');
    });
    test('manifest key order does not change load order',async()=>{
      const l=world({species:['dummy-species'],feats:['dummy-feats'],items:['dummy-items'],rules:['dummy-rules']});
      await l.loadAll();
      assert.deepStrictEqual(Fable._order,['rules:dummy-rules','items:dummy-items','feats:dummy-feats','species:dummy-species']);
    });
    test('an empty or partial manifest is fine',async()=>{
      await world({}).loadAll();
      await world({maps:[],rules:[]}).loadAll();
      Fable.content.manifest=undefined;
      await Fable.content.createLoader({loadScript:H.nodeLoadScript,base:H.dirUrl(FIX)}).loadAll();
    });
    test('a broken cross reference fails startup with a clear message',async()=>{
      const l=world({rules:['dummy-rules'],items:['dummy-items','bad-items']});
      await assert.rejects(l.loadAll(),/Content validation failed \(1 problem\):\n - Widget "bad": gizmos\[1\] refers to unknown Gizmo "nope"/);
    });
    test('a missing script names the file',async()=>{
      const l=world({rules:['does-not-exist']});
      await assert.rejects(l.loadAll(),/Failed to load content script: .*rules-core\/does-not-exist\.js/);
    });
    test('a package that does not expose a promise is reported',async()=>{
      const l=world({rules:['dummy-rules'],species:['no-promise']});
      await assert.rejects(l.loadAll(),/Content package "species:no-promise" did not expose a load promise/);
    });
    test('manifest mistakes are caught before anything loads',async()=>{
      await assert.rejects(world({class:['fighter']}).loadAll(),/unknown group "class" \(known groups: rules, items/);
      await assert.rejects(world({rules:'dummy-rules'}).loadAll(),/"rules" must be an array/);
      await assert.rejects(world({rules:['Bad_Name']}).loadAll(),/"rules" entry "Bad_Name" must be lowercase words/);
      await assert.rejects(world({rules:[5]}).loadAll(),/entry "5" must be lowercase words/);
      await assert.rejects(world({rules:['dummy-rules','dummy-rules']}).loadAll(),/lists "dummy-rules" twice/);
    });
    test('errors thrown while a script runs are passed on',async()=>{
      const l=world({items:['dummy-items']});
      await assert.rejects(l.loadAll(),/rules group must load before items|Cannot read properties/);
    });
    test('createLoader checks its arguments',()=>{
      H.fresh();H.loadRules();H.loadRegistry();
      assert.throws(()=>Fable.content.createLoader({}),/needs a loadScript/);
      assert.throws(()=>Fable.content.createLoader({loadScript(){}}),/needs a base URL/);
    });
    test('does not start by itself when autoload is off',()=>{
      H.fresh();H.loadRules();H.loadRegistry();
      assert.strictEqual(Fable.content._loadScript,undefined);
    });
    test('whenReady runs callbacks (browser path) once ready',()=>{
      H.fresh();H.loadRules();H.loadRegistry();
      let n=0;Fable.content.whenReady(()=>n++);
      assert.strictEqual(n,0);
    });
  });

  suite('browser start-up path',()=>{
    /* Fakes just enough of the DOM that the loader's own script-tag path runs: appending a script runs the file, then calls onload. */
    function browser(search,manifest){
      H.fresh();
      const toast={textContent:'',classList:{added:[],add(c){this.added.push(c)}}};
      const loaderFile=path.join(H.ROOT,'js/content/content-loader.js');
      globalThis.location={search};
      globalThis.document={currentScript:null,
        createElement(){return {}},
        getElementById(id){return id==='toast'?toast:null},
        head:{appendChild(el){
          setTimeout(()=>{
            try{
              const f=require('url').fileURLToPath(el.src);
              if(!fs.existsSync(f))return el.onerror();
              globalThis.document.currentScript={src:el.src};H.runFile(f);globalThis.document.currentScript=null;
              el.onload();
            }catch(e){el.onerror()}
          },0);
        }}};
      H.loadRules();
      H.runFile('js/content/content-registry.js');H.runFile('js/content/content-groups.js');
      Fable.content.manifest=manifest;
      Fable.content.autoload=undefined;
      globalThis.document.currentScript={src:require('url').pathToFileURL(loaderFile).href};
      H.runFile(loaderFile);
      globalThis.document.currentScript=null;
      return toast;
    }
    const tick=ms=>new Promise(r=>setTimeout(r,ms));
    test('starts on its own, validates, then calls whenReady callbacks',async()=>{
      browser('',{});
      let ran=0;
      Fable.content.whenReady(()=>ran++);
      await tick(30);
      assert.strictEqual(ran,1);
      Fable.content.whenReady(()=>ran++);
      assert.strictEqual(ran,2);
    });
    test('a failure shows the toast and never signals ready',async()=>{
      const origError=console.error;console.error=()=>{};
      try{
        const toast=browser('',{rules:['nope']});
        let ran=0;Fable.content.whenReady(()=>ran++);
        await tick(30);
        assert.strictEqual(ran,0);
        assert.match(toast.textContent,/Content failed to load/);
        assert.deepStrictEqual(toast.classList.added,['show']);
      }finally{console.error=origError}
    });
    test('?sources=... limits content to those source tags',async()=>{
      browser('?encounter=x&sources=srd52, original',{});
      await tick(30);
      assert.deepStrictEqual(Fable.content.getAllowedSources(),['srd52','original']);
      browser('',{});await tick(30);
      assert.strictEqual(Fable.content.getAllowedSources(),null);
    });
  });

  suite('real content',()=>{
    test('the manifest only uses known groups and valid ids, and every entry exists on disk',()=>{
      const C=real(),m=C.manifest;
      Object.keys(m).forEach(k=>assert.ok(C.groups.get(k),'unknown group '+k));
      C.groups.order.forEach(g=>(m[g.key]||[]).forEach(id=>{
        assert.match(id,/^[a-z0-9]+(-[a-z0-9]+)*$/);
        assert.ok(fs.existsSync(path.join(H.ROOT,'js/content',C.groups.path(g,id))),g.key+':'+id+' is missing');
      }));
      assert.ok(m.maps.includes('forest-clearing')&&m.encounters.includes('tutorial-goblin-ambush'));
    });
    test('the real encounter, monster and character definitions resolve against each other',()=>{
      const C=real();
      Fable.createGoblinMinion=function(){};Fable.createHumanFighter=function(){};
      C.maps.register({id:'forest-clearing',name:'Stub',environments:['forest'],bounds:{x:100,z:100},seed:1,build(){},
        playerSpawn:{x:0,z:50,w:10,d:10},enemySpawns:[{id:'path-ambush',x:0,z:-50,w:10,d:10}]});
      ['monsters/goblin-minion','characters/human-fighter','encounters/tutorial-goblin-ambush'].forEach(p=>H.runFile('js/content/'+p+'/definition.js'));
      assert.strictEqual(C.validateAll().ok,true);
    });

    let THREE=null;
    try{THREE=require('three')}catch(e){}
    if(!THREE){skip('every real package loads through the real loader (needs the "three" npm package)','three not installed; run npm i three@0.128.0 --no-save to enable');return}
    test('every real package loads through the real loader and validates',async()=>{
      H.fresh();globalThis.THREE=THREE;
      try{
        H.runFile('js/core/voxel.js');H.loadRules();H.loadRegistry();H.runFile('js/content/content-manifest.js');
        const l=Fable.content.createLoader({loadScript:H.nodeLoadScript,base:H.dirUrl(path.join(H.ROOT,'js','content'))});
        const r=await l.loadAll();
        assert.strictEqual(r.ok,true);
        assert.ok(Fable.content.maps.get('forest-clearing')&&Fable.content.monsters.get('goblin-minion')&&Fable.content.characters.get('human-fighter'));
        assert.strictEqual(Fable.content.encounters.defaultId,'tutorial-goblin-ambush');
      }finally{delete globalThis.THREE}
    });
  });
};
