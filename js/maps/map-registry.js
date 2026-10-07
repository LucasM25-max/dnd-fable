/* Map registry. Every map lives in js/maps/<id>/ and calls Fable.maps.register({...}) once.
   The registry checks the definition up front, so a mistake shows as a clear console error.
   See js/maps/README.md for how to add a map. */
window.Fable=window.Fable||{};
(function(){
/* allowed environment tags; add to this list when a new kind of map needs one */
var ENVIRONMENTS=['forest','grassland','desert','snow','swamp','mountain','cave','dungeon','coast','urban','ruins'];
var maps={},order=[];

/* Zones are axis-aligned rectangles {x,z,w,d} (centre and size, world units). */
Fable.zones={
  contains:function(zn,x,z,pad){pad=pad||0;return Math.abs(x-zn.x)<=zn.w/2+pad&&Math.abs(z-zn.z)<=zn.d/2+pad},
  overlaps:function(a,b){return Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2},
  /* uniform random point inside the zone, kept `margin` away from its edges; rnd is a () => [0,1) function */
  randomPoint:function(zn,rnd,margin){margin=margin||0;
    var hw=Math.max(0,zn.w/2-margin),hd=Math.max(0,zn.d/2-margin);
    return {x:zn.x+(rnd()*2-1)*hw,z:zn.z+(rnd()*2-1)*hd}}
};

function fail(id,msg){throw new Error('Map "'+id+'": '+msg)}
function num(v){return typeof v==='number'&&isFinite(v)}
function checkZone(id,what,zn,b){
  if(!zn||!num(zn.x)||!num(zn.z)||!num(zn.w)||!num(zn.d)||zn.w<=0||zn.d<=0)fail(id,what+' needs numeric x, z, w, d (w and d above 0)');
  if(Math.abs(zn.x)+zn.w/2>b.x||Math.abs(zn.z)+zn.d/2>b.z)fail(id,what+' sticks out of the map bounds');
}

Fable.maps={
  ENVIRONMENTS:ENVIRONMENTS,
  /* the map loaded when the URL has no ?map=<id>; the first one registered unless set otherwise */
  defaultId:null,
  register:function(def){
    var id=def&&def.id;
    if(typeof id!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))fail(id,'id must be lowercase words joined by hyphens, e.g. "forest-clearing"');
    if(maps[id])fail(id,'already registered');
    if(typeof def.name!=='string'||!def.name)fail(id,'needs a display name');
    if(!Array.isArray(def.environments)||!def.environments.length)fail(id,'needs at least one environment tag');
    def.environments.forEach(function(t){if(ENVIRONMENTS.indexOf(t)<0)fail(id,'unknown environment tag "'+t+'" (allowed: '+ENVIRONMENTS.join(', ')+')')});
    if(!def.bounds||!num(def.bounds.x)||!num(def.bounds.z)||def.bounds.x<=0||def.bounds.z<=0)fail(id,'needs bounds {x,z} (half-extents of the playable area)');
    if(!num(def.seed))fail(id,'needs a numeric seed so the layout is the same every time');
    if(typeof def.build!=='function')fail(id,'needs a build(ctx) function');
    checkZone(id,'playerSpawn',def.playerSpawn,def.bounds);
    if(!num(def.playerSpawn.facing))def.playerSpawn.facing=Math.PI;
    if(!Array.isArray(def.enemySpawns))fail(id,'enemySpawns must be an array (it may be empty)');
    var seen={};
    def.enemySpawns.forEach(function(e,i){
      if(typeof e.id!=='string'||!e.id)fail(id,'enemySpawns['+i+'] needs an id');
      if(seen[e.id])fail(id,'duplicate enemy spawn id "'+e.id+'"');seen[e.id]=1;
      checkZone(id,'enemy spawn "'+e.id+'"',e,def.bounds);
      if(Fable.zones.overlaps(e,def.playerSpawn))fail(id,'enemy spawn "'+e.id+'" overlaps the player spawn');
    });
    maps[id]=def;order.push(id);if(!Fable.maps.defaultId)Fable.maps.defaultId=id;
    return def;
  },
  get:function(id){return maps[id]||null},
  list:function(){return order.map(function(id){return maps[id]})},
  byEnvironment:function(tag){return order.filter(function(id){return maps[id].environments.indexOf(tag)>=0}).map(function(id){return maps[id]})}
};
})();
