/* Central content registries. Core systems work with stable IDs instead of specific maps or monsters. */
window.Fable=window.Fable||{};
(function(){
var C=Fable.content=Fable.content||{};

function fail(kind,id,msg){throw new Error(kind+' "'+id+'": '+msg)}
function num(v){return typeof v==='number'&&isFinite(v)}

function zoneContains(zn,x,z,pad){
  pad=pad||0;
  return Math.abs(x-zn.x)<=zn.w/2+pad&&Math.abs(z-zn.z)<=zn.d/2+pad;
}
function zoneOverlaps(a,b){
  return Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2;
}
function randomPoint(zn,rnd,margin){
  margin=margin||0;
  var hw=Math.max(0,zn.w/2-margin),hd=Math.max(0,zn.d/2-margin);
  return {x:zn.x+(rnd()*2-1)*hw,z:zn.z+(rnd()*2-1)*hd};
}
function checkZone(id,what,zn,b){
  if(!zn||!num(zn.x)||!num(zn.z)||!num(zn.w)||!num(zn.d)||zn.w<=0||zn.d<=0)
    fail('Map',id,what+' needs numeric x, z, w, d (w and d above 0)');
  if(Math.abs(zn.x)+zn.w/2>b.x||Math.abs(zn.z)+zn.d/2>b.z)
    fail('Map',id,what+' sticks out of the map bounds');
}

C.zones={
  contains:zoneContains,
  overlaps:zoneOverlaps,
  randomPoint:randomPoint
};

var ENVIRONMENTS=['forest','grassland','desert','snow','swamp','mountain','cave','dungeon','coast','urban','ruins'];

var maps={},mapOrder=[];
C.maps={
  ENVIRONMENTS:ENVIRONMENTS,
  defaultId:null,
  register:function(def){
    var id=def&&def.id;
    if(typeof id!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))
      fail('Map',id||'(missing)','id must be lowercase words joined by hyphens');
    if(maps[id])fail('Map',id,'already registered');
    if(typeof def.name!=='string'||!def.name)fail('Map',id,'needs a display name');
    if(!Array.isArray(def.environments)||!def.environments.length)fail('Map',id,'needs at least one environment tag');
    def.environments.forEach(function(t){
      if(ENVIRONMENTS.indexOf(t)<0)fail('Map',id,'unknown environment tag "'+t+'" (allowed: '+ENVIRONMENTS.join(', ')+')');
    });
    if(!def.bounds||!num(def.bounds.x)||!num(def.bounds.z)||def.bounds.x<=0||def.bounds.z<=0)
      fail('Map',id,'needs bounds {x,z} (half-extents of the playable area)');
    if(!num(def.seed))fail('Map',id,'needs a numeric seed so the layout is the same every time');
    if(typeof def.build!=='function')fail('Map',id,'needs a build(ctx) function');
    checkZone(id,'playerSpawn',def.playerSpawn,def.bounds);
    if(!num(def.playerSpawn.facing))def.playerSpawn.facing=Math.PI;
    if(!Array.isArray(def.enemySpawns))fail('Map',id,'enemySpawns must be an array');
    var seen={};
    def.enemySpawns.forEach(function(e,i){
      if(typeof e.id!=='string'||!e.id)fail('Map',id,'enemySpawns['+i+'] needs an id');
      if(seen[e.id])fail('Map',id,'duplicate enemy spawn id "'+e.id+'"');
      seen[e.id]=1;
      checkZone(id,'enemy spawn "'+e.id+'"',e,def.bounds);
      if(zoneOverlaps(e,def.playerSpawn))fail('Map',id,'enemy spawn "'+e.id+'" overlaps the player spawn');
    });
    maps[id]=def;
    mapOrder.push(id);
    if(!C.maps.defaultId)C.maps.defaultId=id;
    return def;
  },
  get:function(id){return maps[id]||null},
  list:function(){return mapOrder.map(function(id){return maps[id]})},
  byEnvironment:function(tag){return mapOrder.filter(function(id){return maps[id].environments.indexOf(tag)>=0}).map(function(id){return maps[id]})}
};

/* Models are registered separately from their rules/metadata so the engine can instantiate by ID. */
function entityRegistry(kind){
  var items={},order=[];
  return {
    register:function(def){
      var id=def&&def.id;
      if(typeof id!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))fail(kind,id||'(missing)','id must be lowercase words joined by hyphens');
      if(items[id])fail(kind,id,'already registered');
      if(typeof def.name!=='string'||!def.name)fail(kind,id,'needs a display name');
      if(typeof def.factory!=='function')fail(kind,id,'needs a factory function');
      items[id]=def;order.push(id);
      return def;
    },
    get:function(id){return items[id]||null},
    list:function(){return order.map(function(id){return items[id]})},
    create:function(id){
      var def=items[id];
      if(!def)throw new Error('Unknown '+kind.toLowerCase()+' "'+id+'"');
      return def.factory();
    }
  };
}

C.monsters=entityRegistry('Monster');
C.characters=entityRegistry('Character');

var encounters={},encounterOrder=[];
C.encounters={
  defaultId:null,
  register:function(def){
    var id=def&&def.id;
    if(typeof id!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))fail('Encounter',id||'(missing)','id must be lowercase words joined by hyphens');
    if(encounters[id])fail('Encounter',id,'already registered');
    if(typeof def.name!=='string'||!def.name)fail('Encounter',id,'needs a display name');
    if(typeof def.map!=='string'||!def.map)fail('Encounter',id,'needs a map id');
    if(!Array.isArray(def.enemies))fail('Encounter',id,'enemies must be an array');
    def.enemies.forEach(function(group,i){
      if(!group||typeof group.monster!=='string')fail('Encounter',id,'enemies['+i+'] needs a monster id');
      if(typeof group.spawnZone!=='string')fail('Encounter',id,'enemies['+i+'] needs a spawnZone id');
      if(!num(group.count)||group.count<1||Math.floor(group.count)!==group.count)fail('Encounter',id,'enemies['+i+'] needs a positive integer count');
    });
    if(def.enabled===undefined)def.enabled=true;
    encounters[id]=def;encounterOrder.push(id);
    if(def.enabled&&C.encounters.defaultId===null)C.encounters.defaultId=id;
    return def;
  },
  get:function(id){return encounters[id]||null},
  list:function(){return encounterOrder.map(function(id){return encounters[id]})},
  enabled:function(){return encounterOrder.filter(function(id){return encounters[id].enabled!==false}).map(function(id){return encounters[id]})},
  byMap:function(mapId){return encounterOrder.filter(function(id){return encounters[id].map===mapId&&encounters[id].enabled!==false}).map(function(id){return encounters[id]})}
};

/* Backwards-compatible alias for small external experiments that used Fable.maps. */
Fable.maps=C.maps;
})();
