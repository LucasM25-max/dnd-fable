/* Choice resolution (implementation plan, sections 3.3 and 7.2, steps 1 and 2).
   Fable.character.resolve(build) walks everything a character owns, in a fixed order, and returns what the sheet needs:

     features   every feature the character has, each {id, def, source, level, instance}. Features gained from several
                places or levels appear once per copy (instance 1, 2, ...), so a repeated choice gets its own key.
     feats      every feat, each {id, def, source}
     grants     proficiencies by kind: {armorTraining, weaponProficiency, savingThrows, skills, tools, languages}, each a
                map id -> [labels of the sources that granted it]
     choices    every decision the content asks for, each {key, id, label, source, pick, options, chosen, status, ...}
                status is 'ok' (made and legal), 'pending' (not made, or not made fully) or 'invalid' (illegal)
     pending    the choices that are not 'ok': what the builder UI has to ask next
     selections key -> chosen ids, for every choice that is not pending
     issues     problems found on the way, [{severity, code, message, path}]

   Order matters for "excludeOwned" (a skill cannot be picked twice): the background's fixed skills first, then the class's
   skill choice, then the species and the class features in level order, then the feats that were chosen along the way.
   A choice whose pick count is 0 at the character's level (a table that has not started yet) is skipped.

   Choice effects follow from what a choice picks from: skills grant a proficiency, languages and tools do the same for
   their kind, feats add a feat (with its own grants and choices), subclasses add the subclass features. Picks from any
   other kind (Weapon Mastery picks items) are only recorded in selections. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var hasOwn=Object.prototype.hasOwnProperty;

var GRANT_KINDS=['armorTraining','weaponProficiency','savingThrows','skills','tools','languages'];
var KIND_TO_GRANT={skills:'skills',languages:'languages',tools:'tools'};

function titleCase(id){return String(id).split('-').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1)}).join(' ')}

function content(){
  var C=Fable.content;
  ['species','backgrounds','classes','subclasses','features','feats','items'].forEach(function(k){
    if(!C||!C[k])throw new Error('Character: content is not loaded yet ("'+k+'" is missing). Wait for Fable.content.whenReady.');
  });
  return C;
}

Ch.resolve=function(rec){
  var C=content();
  var R={
    issues:[],features:[],feats:[],choices:[],pending:[],selections:{},
    grants:{},tags:{},species:null,background:null,classes:[],classLevels:{},level:0,
    size:null,speed:0,senses:{},preScores:{},fatal:false
  };
  GRANT_KINDS.forEach(function(k){R.grants[k]={}});
  function issue(severity,code,message,path){R.issues.push({severity:severity,code:code,message:message,path:path||''})}

  /* ---- who the character is ---- */
  R.species=C.species.get(rec.species);
  if(!R.species){issue('error','unknown-species','Unknown species "'+rec.species+'"','species');R.fatal=true}
  R.background=C.backgrounds.get(rec.background);
  if(!R.background){issue('error','unknown-background','Unknown background "'+rec.background+'"','background');R.fatal=true}
  rec.classLevels.forEach(function(en,i){
    var def=C.classes.get(en.class);
    if(!def){issue('error','unknown-class','Unknown class "'+en.class+'"','classLevels['+i+'].class');R.fatal=true;return}
    R.classes.push({entry:en,def:def,level:en.level,first:R.classes.length===0});
    R.classLevels[en.class]=en.level;
    R.level+=en.level;
  });
  if(!R.classes.length)R.fatal=true;
  if(R.fatal)return R;
  if(R.classes.length>1)issue('warning','multiclass','Multiclassing is only groundwork so far: proficiencies come from the first class and no multiclass prerequisites are checked','classLevels');

  /* Ability scores before any effects, for feat prerequisites. */
  Ch.ABILITIES.forEach(function(a){
    R.preScores[a]=((rec.abilityScores.base||{})[a]|0)+((rec.backgroundAsi||{})[a]|0);
  });

  /* ---- ownership ---- */
  var featureCount={},queue=[],usedKeys={};
  function addGrant(kind,id,source){
    var map=R.grants[kind];
    (map[id]=map[id]||[]);
    var label=source.name;
    if(map[id].indexOf(label)<0)map[id].push(label);
  }
  function ownsFeat(id){return R.feats.some(function(f){return f.id===id})}
  function owned(kind,id){
    if(KIND_TO_GRANT[kind])return hasOwn.call(R.grants[KIND_TO_GRANT[kind]],id);
    if(kind==='feats')return ownsFeat(id);
    return false;
  }
  function ownFeature(id,source,level){
    var def=C.features.get(id);
    if(!def){issue('error','unknown-feature','Unknown feature "'+id+'" (from '+source.name+')');return}
    featureCount[id]=(featureCount[id]||0)+1;
    var item={id:id,def:def,source:source,level:level||1,instance:featureCount[id]};
    R.features.push(item);queue.push({kind:'feature',item:item});
  }
  function ownFeat(id,source){
    var def=C.feats.get(id);
    if(!def){issue('error','unknown-feat','Unknown feat "'+id+'" (from '+source.name+')');return}
    if(ownsFeat(id)&&!def.repeatable){issue('warning','duplicate-feat','"'+def.name+'" is granted more than once ('+source.name+') and does not stack');return}
    var item={id:id,def:def,source:source};
    R.feats.push(item);queue.push({kind:'feat',item:item});
  }

  /* ---- prerequisites for feats ---- */
  function meetsPrerequisite(def){
    var p=def.prerequisite;
    if(!p)return true;
    if(p.level!==undefined&&R.level<p.level)return false;
    if(p.class!==undefined&&!(R.classLevels[p.class]>0))return false;
    if(p.abilityScore!==undefined&&Object.keys(p.abilityScore).some(function(a){return (R.preScores[a]|0)<p.abilityScore[a]}))return false;
    if(p.featureTag!==undefined&&!hasOwn.call(R.tags,p.featureTag))return false;
    if(p.feats!==undefined&&p.feats.some(function(f){return !ownsFeat(f)}))return false;
    return true;
  }

  /* ---- choices ---- */
  function optionsFor(c){
    var defs;
    if(c.literal)defs=c.literal.map(function(v){return {id:v,name:v}});
    else defs=C.choiceOptions(c.from);
    return defs.filter(function(d){
      if(c.excludeOwned&&owned(c.from&&c.from.kind,d.id))return false;
      if(c.from&&c.from.kind==='feats'&&!meetsPrerequisite(d))return false;
      return true;
    });
  }
  /* c: {sourceId, source, instance, id, pick, from | literal, excludeOwned, recommended, changeOn, changeLimit, label} */
  function resolveChoice(c){
    var key=Ch.choiceKey(c.sourceId,c.id,c.instance);
    var pick=typeof c.pick==='number'?c.pick:C.valueAtLevel(c.pick,R.classLevels);
    if(pick<1)return;
    if(usedKeys[key])return;
    usedKeys[key]=true;
    var opts=optionsFor(c);
    var raw=rec.choices[key];
    var chosen=raw===undefined||raw===null?[]:(Array.isArray(raw)?raw.slice():[raw]);
    var choice={
      key:key,id:c.id,label:c.label||titleCase(c.id),source:c.source,pick:pick,
      kind:c.from?c.from.kind:'literal',
      options:opts.map(function(o){return {id:o.id,name:o.name}}),
      chosen:[],status:'pending',excludeOwned:!!c.excludeOwned
    };
    ['recommended','changeOn','changeLimit'].forEach(function(f){if(c[f]!==undefined)choice[f]=c[f]});
    var bad=null;
    if(chosen.some(function(id,i){return chosen.indexOf(id)!==i}))bad='lists the same option twice';
    else if(chosen.length>pick)bad='has '+chosen.length+' picks but only '+pick+' are allowed';
    else{
      chosen.some(function(id){
        if(opts.some(function(o){return o.id===id}))return false;
        /* Say why an option is not allowed, not just that it is not. */
        var all=c.literal?c.literal.map(function(v){return {id:v}}):C.choiceOptions(c.from);
        if(!all.some(function(o){return o.id===id}))bad='"'+id+'" is not one of the options';
        else if(c.excludeOwned&&owned(c.from&&c.from.kind,id))bad='"'+id+'" is already owned';
        else bad='"'+id+'" does not meet its prerequisite';
        return true;
      });
    }
    if(bad){
      choice.status='invalid';choice.message='The choice "'+choice.label+'" ('+c.source.name+') '+bad;
      issue('error','invalid-choice',choice.message,'choices.'+key);
    }else{
      choice.chosen=chosen;
      choice.status=chosen.length===pick?'ok':'pending';
      if(choice.status==='pending'){
        choice.message=(pick-chosen.length)+' more pick'+(pick-chosen.length===1?'':'s')+' needed for "'+choice.label+'" ('+c.source.name+')';
        if(chosen.length===0&&opts.length<pick)issue('error','empty-choice','"'+choice.label+'" ('+c.source.name+') offers '+opts.length+' option(s) but needs '+pick,'choices.'+key);
      }
      if(chosen.length)R.selections[key]=chosen.slice();
      /* Apply what was chosen, even from a partly finished pick. */
      var from=c.from&&c.from.kind;
      chosen.forEach(function(id){
        if(KIND_TO_GRANT[from])addGrant(KIND_TO_GRANT[from],id,c.source);
        else if(from==='feats')ownFeat(id,{type:'feat-choice',id:c.sourceId,name:c.source.name});
        else if(from==='subclasses')choice.subclass=id;
      });
    }
    R.choices.push(choice);
    if(choice.status!=='ok')R.pending.push(choice);
    return choice;
  }

  function chooseFrom(spec,base){
    return resolveChoice(Object.assign({},base,{pick:spec.count,from:spec.from,excludeOwned:true}));
  }

  /* ---- 1. the background: fixed skills, origin feat, tool ---- */
  var bg=R.background,bgSource={type:'background',id:bg.id,name:bg.name};
  bg.skills.forEach(function(s){addGrant('skills',s,bgSource)});
  ownFeat(bg.originFeat,bgSource);
  if(bg.tool.fixed)addGrant('tools',bg.tool.fixed,bgSource);

  /* ---- 2. the first class: training and the skill choice ---- */
  var first=R.classes[0],clsSource={type:'class',id:first.def.id,name:first.def.name};
  first.def.savingThrows.forEach(function(a){addGrant('savingThrows',a,clsSource)});
  first.def.armorTraining.forEach(function(a){addGrant('armorTraining',a,clsSource)});
  first.def.weaponProficiency.forEach(function(a){addGrant('weaponProficiency',a,clsSource)});
  resolveChoice({sourceId:first.def.id,source:clsSource,id:'skills',label:'Skills',pick:first.def.skills.count,
    from:{kind:'skills',ids:first.def.skills.from},excludeOwned:true});

  /* ---- 3. the species ---- */
  var sp=R.species,spSource={type:'species',id:sp.id,name:sp.name};
  R.speed=sp.speed;R.senses=Object.assign({},sp.senses||{});
  sp.languages.fixed.forEach(function(l){addGrant('languages',l,spSource)});
  if(typeof sp.size==='string')R.size=sp.size;
  else{
    var sizeChoice=resolveChoice({sourceId:sp.id,source:spSource,id:'size',label:'Size',pick:1,literal:sp.size.choose});
    R.size=sizeChoice&&sizeChoice.chosen.length?sizeChoice.chosen[0]:null;
  }
  if(sp.languages.choose)chooseFrom(sp.languages.choose,{sourceId:sp.id,source:spSource,id:'languages',label:'Languages'});
  if(bg.tool.choose)chooseFrom(bg.tool.choose,{sourceId:bg.id,source:bgSource,id:'tool',label:'Tool proficiency'});
  sp.features.forEach(function(f){ownFeature(f,spSource,1)});

  /* ---- 4. class features, level by level ---- */
  R.classes.forEach(function(cl){
    var src={type:'class',id:cl.def.id,name:cl.def.name};
    Object.keys(cl.def.features).map(Number).sort(function(a,b){return a-b}).forEach(function(lv){
      if(lv>cl.level)return;
      cl.def.features[lv].forEach(function(id){ownFeature(id,src,lv)});
    });
    if(cl.level>cl.def.implementedLevel)issue('warning','unimplemented-level',cl.def.name+' level '+cl.level+' is above the implemented level '+cl.def.implementedLevel+'; the later features are placeholders without rules','classLevels');
    /* Subclass: chosen at the subclass level, once the class has any. */
    if(cl.def.subclassLevel&&cl.level>=cl.def.subclassLevel&&cl.def.subclasses.length){
      var sc=resolveChoice({sourceId:cl.def.id,source:src,id:'subclass',label:'Subclass',pick:1,from:{kind:'subclasses',ids:cl.def.subclasses}});
      if(sc&&sc.subclass){
        var sub=C.subclasses.get(sc.subclass),subSrc={type:'subclass',id:sub.id,name:sub.name};
        cl.subclass=sub;
        Object.keys(sub.features).map(Number).sort(function(a,b){return a-b}).forEach(function(lv){
          if(lv>cl.level)return;
          sub.features[lv].forEach(function(id){ownFeature(id,subSrc,lv)});
        });
      }
    }
  });

  /* ---- 5. drain the queue: grants, tags and choices of everything owned, including what choices add ---- */
  var guard=0;
  while(queue.length){
    if(++guard>2000){issue('error','grant-loop','Features grant each other in a loop');break}
    var w=queue.shift(),item=w.item,def=item.def,src=item.source;
    var selfSource=w.kind==='feature'?{type:'feature',id:item.id,name:def.name}:{type:'feat',id:item.id,name:def.name};
    if(w.kind==='feature'&&def.status==='stub')continue;
    (def.tags||[]).forEach(function(t){(R.tags[t]=R.tags[t]||[]).push(item.id)});
    var g=def.grants||{};
    GRANT_KINDS.forEach(function(k){(g[k]||[]).forEach(function(id){addGrant(k,id,selfSource)})});
    (g.features||[]).forEach(function(id){ownFeature(id,selfSource,item.level)});
    (g.feats||[]).forEach(function(id){ownFeat(id,selfSource)});
    (def.choices||[]).forEach(function(c){
      resolveChoice({sourceId:item.id,instance:w.kind==='feature'?item.instance:1,source:selfSource,id:c.id,label:titleCase(c.id),
        pick:c.pick,from:c.from,excludeOwned:c.excludeOwned,recommended:c.recommended,changeOn:c.changeOn,changeLimit:c.changeLimit});
    });
  }

  /* ---- 6. choices in the record that nothing asks for ---- */
  Object.keys(rec.choices).forEach(function(k){
    if(!usedKeys[k])issue('warning','unused-choice','The build records a choice "'+k+'" that nothing asks for at this level',  'choices.'+k);
  });
  return R;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
