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

/* ---------- Generalized kinds (rules data) ----------
   Fable.content.defineKind(name, spec) creates Fable.content.<name> with register/registerAll/get/has/list/ids/size/filter.
   Cross references between kinds are checked once, after everything is loaded, by Fable.content.validateAll().
   See implementation-plan.md section 4.3. The registries above (maps, monsters, characters, encounters) keep their own code. */
var ID_RE=/^[a-z0-9]+(-[a-z0-9]+)*$/;
var KIND_NAME_RE=/^[a-z][A-Za-z0-9]*$/;
var RESERVED=['manifest','groups','kinds','config','zones','autoload','createLoader','whenReady'];
var hasOwn=Object.prototype.hasOwnProperty;
var kinds={},kindOrder=[],allowedSources=null,seenCount=0;

/* Shipping builds can limit content to some sources, for example ['srd52']. Call before any content is registered. */
C.setAllowedSources=function(list){
  if(list!==null&&(!Array.isArray(list)||list.some(function(s){return typeof s!=='string'||!s})))
    throw new Error('setAllowedSources expects null or an array of source tags');
  if(seenCount)throw new Error('setAllowedSources must be called before any content is registered');
  allowedSources=list?list.slice():null;
};
C.getAllowedSources=function(){return allowedSources?allowedSources.slice():null};
C.isSourceAllowed=function(src){return allowedSources===null||allowedSources.indexOf(src)>=0};

function deepFreeze(o){
  if(o&&typeof o==='object'&&!Object.isFrozen(o)){
    Object.freeze(o);
    Object.keys(o).forEach(function(k){deepFreeze(o[k])});
  }
  return o;
}

function checkRefSpecs(name,refs){
  if(refs===undefined)return [];
  if(!Array.isArray(refs))throw new Error('defineKind "'+name+'": refs must be an array');
  refs.forEach(function(r,i){
    if(!r||typeof r.path!=='string'||!r.path||typeof r.kind!=='string'||!r.kind)
      throw new Error('defineKind "'+name+'": refs['+i+'] needs a path and a kind');
  });
  return refs;
}

C.defineKind=function(name,spec){
  spec=spec||{};
  if(typeof name!=='string'||!KIND_NAME_RE.test(name))
    throw new Error('defineKind: the kind name must be a camelCase word, got "'+name+'"');
  if(kinds[name]||C[name]!==undefined||RESERVED.indexOf(name)>=0)
    throw new Error('defineKind "'+name+'": the name is already used on Fable.content');
  var label=spec.label;
  if(typeof label!=='string'||!label)throw new Error('defineKind "'+name+'": needs a label such as "Class"');
  if(spec.validate!==undefined&&typeof spec.validate!=='function')throw new Error('defineKind "'+name+'": validate must be a function');
  if(spec.crossCheck!==undefined&&typeof spec.crossCheck!=='function')throw new Error('defineKind "'+name+'": crossCheck must be a function');
  if(spec.normalize!==undefined&&typeof spec.normalize!=='function')throw new Error('defineKind "'+name+'": normalize must be a function');
  var required=spec.required===undefined?[]:spec.required;
  if(!Array.isArray(required)||required.some(function(k){return typeof k!=='string'}))
    throw new Error('defineKind "'+name+'": required must be an array of field names');
  var refs=checkRefSpecs(name,spec.refs),sourced=spec.sourced!==false,freeze=spec.freeze!==false;

  var items={},seen={},order=[],skipped=[];
  var reg={
    name:name,
    label:label,
    register:function(def){
      var id=def&&def.id;
      if(!def||typeof def!=='object'||Array.isArray(def))fail(label,'(unknown)','a definition must be an object');
      if(typeof id!=='string'||!ID_RE.test(id))fail(label,id||'(missing)','id must be lowercase words joined by hyphens');
      if(seen[id])fail(label,id,'already registered');
      if(typeof def.name!=='string'||!def.name)fail(label,id,'needs a display name');
      if(sourced&&(typeof def.source!=='string'||!def.source))fail(label,id,'needs a source tag (for example "srd52" or "original")');
      required.forEach(function(k){if(def[k]===undefined||def[k]===null)fail(label,id,'needs "'+k+'"')});
      if(spec.normalize)spec.normalize(def);
      if(spec.validate)spec.validate(def,function(msg){fail(label,id,msg)});
      seen[id]=1;seenCount++;
      if(sourced&&!C.isSourceAllowed(def.source)){skipped.push(id);return null}
      if(freeze)deepFreeze(def);
      items[id]=def;order.push(id);
      return def;
    },
    registerAll:function(defs){
      if(!Array.isArray(defs))fail(label,'(registerAll)','expects an array of definitions');
      defs.forEach(function(d){reg.register(d)});
      return defs;
    },
    get:function(id){return hasOwn.call(items,id)?items[id]:null},
    has:function(id){return hasOwn.call(items,id)},
    list:function(){return order.map(function(id){return items[id]})},
    ids:function(){return order.slice()},
    size:function(){return order.length},
    filter:function(fn){return reg.list().filter(fn)},
    skipped:function(){return skipped.slice()}
  };
  reg._refs=refs;
  reg._crossCheck=spec.crossCheck||null;
  kinds[name]=reg;kindOrder.push(name);
  C[name]=reg;
  return reg;
};
C.kindNames=function(){return kindOrder.slice()};
C.getKind=function(name){return kinds[name]||null};

/* Looks an id up in any kind, including the older registries (maps, monsters, characters, encounters). */
function registryOf(kind){
  if(hasOwn.call(kinds,kind))return kinds[kind];
  var r=C[kind];
  return r&&typeof r.get==='function'&&typeof r.list==='function'?r:null;
}
C.lookup=function(kind,id){var r=registryOf(kind);return r?r.get(id):null};
C.has=function(kind,id){return !!C.lookup(kind,id)};

/* Reference paths are dotted field names. "*" walks every item of a list or every value of an object, so
   "features.*" reaches {1:['a','b'],2:['c']} and "startingEquipment.*.item" reaches each entry's item field.
   Missing fields are skipped, so optional references need no special case. */
function joinPath(base,seg){return base?base+'.'+seg:seg}
function collect(node,parts,idx,path,out){
  if(node===undefined||node===null)return;
  if(idx===parts.length){out.push({path:path,value:node});return}
  var p=parts[idx];
  if(p==='*'){
    if(Array.isArray(node))node.forEach(function(v,i){collect(v,parts,idx+1,path+'['+i+']',out)});
    else if(typeof node==='object')Object.keys(node).forEach(function(k){collect(node[k],parts,idx+1,joinPath(path,k),out)});
    else out.push({path:path,bad:'expected a list or object here'});
    return;
  }
  /* A named field met on a list applies to every item of it, so "startingEquipment.*.item" also reaches {a:[{item:'x'}]}. */
  if(Array.isArray(node)){node.forEach(function(v,i){collect(v,parts,idx,path+'['+i+']',out)});return}
  if(typeof node!=='object'||!hasOwn.call(node,p))return;
  collect(node[p],parts,idx+1,joinPath(path,p),out);
}

function checkRefs(where,def,refs,errors,reportedKinds){
  refs.forEach(function(r){
    var reg=registryOf(r.kind);
    if(!reg){
      if(!reportedKinds[r.kind]){reportedKinds[r.kind]=1;errors.push('a reference points at "'+r.kind+'", which is not a known kind (used by '+where+')')}
      return;
    }
    var hits=[];
    collect(def,r.path.split('.'),0,'',hits);
    hits.forEach(function(h){
      if(h.bad){errors.push(where+': '+h.path+' '+h.bad);return}
      var vals=Array.isArray(h.value)?h.value:[h.value];
      vals.forEach(function(v,i){
        var p=Array.isArray(h.value)?h.path+'['+i+']':h.path;
        if(typeof v!=='string')errors.push(where+': '+p+' must be an id (text), got '+(v&&typeof v==='object'?'an object':typeof v));
        else if(!reg.get(v))errors.push(where+': '+p+' refers to unknown '+(reg.label||r.kind)+' "'+v+'"');
      });
    });
  });
}

/* Cross references for the older registries, checked by the same machinery. */
var BUILTIN_REFS=[
  {kind:'encounters',label:'Encounter',refs:[
    {path:'map',kind:'maps'},
    {path:'playerCharacter',kind:'characters'},
    {path:'enemies.*.monster',kind:'monsters'}
  ]}
];

/* Checks every cross reference. Returns {ok, errors, warnings} and never throws. */
C.validate=function(){
  var errors=[],warnings=[],reported={};
  kindOrder.forEach(function(name){
    var k=kinds[name];
    k.list().forEach(function(def){
      var where=k.label+' "'+def.id+'"';
      checkRefs(where,def,k._refs,errors,reported);
      if(k._crossCheck){
        try{
          k._crossCheck(def,{
            has:C.has,get:C.lookup,
            list:function(kind){var r=registryOf(kind);return r?r.list():[]},
            fail:function(msg){errors.push(where+': '+msg)}
          });
        }catch(e){errors.push(where+': '+e.message)}
      }
    });
    if(k.skipped().length)warnings.push(k.skipped().length+' '+k.label+' definition(s) skipped by the source filter');
  });
  BUILTIN_REFS.forEach(function(b){
    var r=registryOf(b.kind);
    if(!r)return;
    r.list().forEach(function(def){checkRefs(b.label+' "'+def.id+'"',def,b.refs,errors,reported)});
  });
  return {ok:errors.length===0,errors:errors,warnings:warnings};
};

/* Same as validate(), but throws one error listing every problem. The loader calls this after all packages are loaded. */
C.validateAll=function(){
  var r=C.validate();
  if(!r.ok)throw new Error('Content validation failed ('+r.errors.length+' problem'+(r.errors.length===1?'':'s')+'):\n - '+r.errors.join('\n - '));
  return r;
};

/* Backwards-compatible alias for small external experiments that used Fable.maps. */
Fable.maps=C.maps;
})();
