'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),H=require('../harness');

/* One map for every habitat of the 2024 Monster Manual. A map's terrain needs Three.js, but its definition (id, habitats, spawn
   zones, bounds) does not, so these tests register the real definitions with the builder left unused. */
async function maps(){
  const C=await H.loadData({monsters:true});
  Fable.mapKit={};
  H.runFile('js/content/content-manifest.js');
  const ids=Fable.content.manifest.maps;
  H.runFile('js/content/maps/forest-clearing/layout.js');
  ids.forEach(id=>H.runFile('js/content/maps/'+id+'/definition.js'));
  return {C,ids};
}
const cap=z=>Math.floor(z.w/15)*Math.floor(z.d/15);

module.exports=function({suite,test}){
  suite('maps',()=>{
    test('the habitats are the twelve of the 2024 Monster Manual',async()=>{
      const {C}=await maps();
      assert.deepStrictEqual(C.maps.ENVIRONMENTS.slice().sort(),
        ['arctic','coastal','desert','forest','grassland','hill','mountain','planar','swamp','underdark','underwater','urban']);
    });
    test('every habitat has a map that shows it, and every map shows at least one',async()=>{
      const {C}=await maps();
      C.maps.ENVIRONMENTS.forEach(e=>assert.ok(C.maps.byEnvironment(e).length>=1,'no map for '+e));
      C.maps.list().forEach(m=>assert.ok(m.environments.length>=1,m.id));
    });
    test('each new map shows its own habitat, so a creature of that habitat meets a map made for it',async()=>{
      const {C}=await maps();
      const own={'rolling-plains':'grassland','frostbound-pass':'arctic','sunken-coast':'coastal','scorched-dunes':'desert','windswept-heights':'hill',
        'stonespine-ridge':'mountain','sunken-marsh':'swamp','glimmerdeep-cavern':'underdark','drowned-reef':'underwater','gilded-quarter':'urban',
        'shattered-nexus':'planar','forest-clearing':'forest'};
      Object.keys(own).forEach(id=>{const m=C.maps.get(id);assert.ok(m,id);assert.ok(m.environments.includes(own[id]),id+' should show '+own[id])});
      assert.strictEqual(C.maps.list().length,Object.keys(own).length);
    });
    test('every map can seat an encounter: two or more spawn zones, each with room for six, apart from the player and from each other',async()=>{
      const {C}=await maps();
      C.maps.list().filter(m=>m.id!=='forest-clearing').forEach(m=>{
        assert.ok(m.enemySpawns.length>=2,m.id);
        m.enemySpawns.forEach(z=>assert.ok(cap(z)>=6,m.id+' '+z.id+' holds '+cap(z)));
        assert.strictEqual(new Set(m.enemySpawns.map(z=>z.id)).size,m.enemySpawns.length,m.id);
        assert.ok(Math.abs(m.playerSpawn.x)<=m.bounds.x&&m.playerSpawn.z+m.playerSpawn.d/2<=m.bounds.z,m.id+' player spawn');
        assert.ok(m.enemySpawns.every(z=>Fable.content.zones.overlaps(z,m.playerSpawn)===false),m.id);
      });
    });
    test('every map has its own seed, so no two maps scatter their scenery the same way',async()=>{
      const {C}=await maps();
      const seeds=C.maps.list().map(m=>m.seed);
      assert.strictEqual(new Set(seeds).size,seeds.length);
    });
    test('every habitat a monster names is one the game knows',async()=>{
      const {C}=await maps();
      ['goblin-minion','goblin-warrior'].forEach(id=>{
        const d=fs.readFileSync(path.join(H.ROOT,'js/content/monsters/'+id+'/definition.js'),'utf8');
        const tags=(/environments:\[([^\]]*)\]/.exec(d)||[])[1];
        assert.ok(tags,id);
        tags.split(',').map(s=>s.trim().replace(/'/g,'')).forEach(t=>assert.ok(C.maps.ENVIRONMENTS.includes(t),id+' names '+t));
      });
    });
    test('the generator fields goblins on the hill and underdark maps, and keeps off a map none of their habitats touch',async()=>{
      const {C}=await maps();
      H.runFile('js/rules/encounter-gen.js');
      const gob={id:'goblin-minion',name:'Goblin Minion',challenge:{xp:25},hp:{average:7},environments:['forest','grassland','hill','underdark'],family:'goblinoid',role:'skirmisher'};
      const only=id=>[C.maps.get(id)];
      ['windswept-heights','glimmerdeep-cavern','rolling-plains'].forEach(id=>{
        const r=Fable.encounterGen.generate({levels:[1],difficulty:'moderate',seed:5,maps:only(id),monsters:[gob]});
        assert.ok(r.ok,id);assert.strictEqual(r.encounter.map,id);
        assert.strictEqual(r.meta.fallback,false,id);
      });
      const off=Fable.encounterGen.generate({levels:[1],difficulty:'moderate',seed:5,maps:only('drowned-reef'),monsters:[gob]});
      if(off.ok)assert.strictEqual(off.meta.fallback,true,'a goblin does not belong underwater');
    });
    test('the map code uses no randomness but the map seed, so a map is the same every time',()=>{
      fs.readdirSync(path.join(H.ROOT,'js/content/maps')).forEach(id=>{
        const dir=path.join(H.ROOT,'js/content/maps',id);
        fs.readdirSync(dir).filter(f=>f.endsWith('.js')).forEach(f=>{
          assert.ok(!/Math\.random|Date\.now|performance\.now/.test(fs.readFileSync(path.join(dir,f),'utf8')),id+'/'+f);
        });
      });
    });
  });
};
