/* Defines the kinds for character options: species, backgrounds, classes and subclasses (implementation plan, section 5).
   Species, backgrounds and classes are packages (one folder each) that load after the feats group, so these kinds are
   defined here, with the other shared kinds, before any package runs. Must come after feat-kind.js in manifest.feats.

   species     id, name, description, creatureType, size ('Medium' or {choose:['Medium','Small']}), speed (feet),
               features [feature ids], languages {fixed:[ids], choose:{count, from}}, senses {darkvision:60}
   backgrounds id, name, description, abilityScoreOptions [3 ability ids], originFeat, skills [2 ids],
               tool {fixed:id} or {choose:{count, from}}, startingEquipment
   classes     id, name, description, hitDie, primaryAbility [ids], savingThrows [2 ids], skills {count, from [ids]},
               armorTraining [armor category ids], weaponProficiency [weapon category ids], startingEquipment,
               features {<level>:[feature ids]} for levels 1 to 20, implementedLevel (the highest level whose features
               are fully implemented, the rest are stubs), subclassLevel, subclasses [ids], spellcasting (reserved: null)
   subclasses  id, name, description, class, features {<level>:[feature ids]}

   startingEquipment is {options:[{id:'a', label, items:[{item, qty}], gold:{gp:4}}]}: the player picks one option.
   An item entry is {item, qty} or, for a background, {fromChoice:'tool', qty} (the item is the tool the player chose).
   A class feature id that appears at several levels (Ability Score Improvement) means the player gets it again. */
(function(){
var C=Fable.content,B=C.featureBody,M=Fable.money;
if(!B)throw new Error('feats/option-kinds.js needs feats/feature-kind.js to be loaded first');
var SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
var HIT_DICE=[6,8,10,12];
var isInt=B.isInt,isText=B.isText,isObj=B.isObj,isIdList=B.isIdList,ID_RE=B.ID_RE;

function checkSize(s,fail){
  if(typeof s==='string'){if(SIZES.indexOf(s)<0)fail('size must be one of '+SIZES.join(', '));return}
  if(!isObj(s)||Object.keys(s).join()!=='choose'||!Array.isArray(s.choose)||s.choose.length<2||s.choose.some(function(x){return SIZES.indexOf(x)<0})||s.choose.some(function(x,i){return s.choose.indexOf(x)!==i}))
    fail('size must be one size, or {choose:[two or more different sizes]}');
}
function checkChoose(c,fail,what){
  if(!isObj(c)||!isInt(c.count)||c.count<1){fail(what+' needs {count, from} with a whole number count of 1 or more');return}
  B.checkFrom(c.from,fail,what+'.from');
}
function checkFeatureMap(map,fail,what,minLevel){
  if(!isObj(map)||!Object.keys(map).length){fail(what+' must be an object of level -> feature ids');return}
  Object.keys(map).forEach(function(k){
    var n=Number(k);
    if(!isInt(n)||n<minLevel||n>20||String(n)!==k)fail(what+' has a bad level "'+k+'" (levels run from '+minLevel+' to 20)');
    else if(!isIdList(map[k]))fail(what+'['+k+'] must be a non-empty list of feature ids');
    else if(map[k].some(function(id,i){return map[k].indexOf(id)!==i}))fail(what+'['+k+'] lists the same feature twice');
  });
}
function checkEquipment(se,fail,choiceIds){
  if(!isObj(se)||!Array.isArray(se.options)||!se.options.length){fail('startingEquipment needs {options:[...]} with at least one option');return}
  var seen={};
  se.options.forEach(function(o,i){
    var w='startingEquipment.options['+i+']';
    if(!isObj(o)){fail(w+' must be an object');return}
    if(typeof o.id!=='string'||!/^[a-z]$/.test(o.id))fail(w+'.id must be a single lowercase letter such as "a"');
    else if(seen[o.id])fail(w+' repeats the option id "'+o.id+'"');
    seen[o.id]=1;
    if(o.label!==undefined&&!isText(o.label))fail(w+'.label must be text');
    if(!Array.isArray(o.items))fail(w+'.items must be a list (use [] when the option is only gold)');
    else o.items.forEach(function(e,j){
      var x=w+'.items['+j+']';
      if(!isObj(e)||!isInt(e.qty)||e.qty<1){fail(x+' needs a whole number qty of 1 or more');return}
      if(e.item!==undefined){if(!isText(e.item)||e.fromChoice!==undefined)fail(x+' needs an item id (or fromChoice, not both)')}
      else if(typeof e.fromChoice!=='string'||choiceIds.indexOf(e.fromChoice)<0)fail(x+' needs an item id'+(choiceIds.length?' or fromChoice naming one of: '+choiceIds.join(', '):''));
    });
    if(o.gold!==undefined){var why=M.checkCost(o.gold);if(why)fail(w+'.gold: '+why)}
    if(Array.isArray(o.items)&&!o.items.length&&o.gold===undefined)fail(w+' gives nothing');
  });
}
B.checkEquipment=checkEquipment;

/* ---------- species ---------- */
C.defineKind('species',{
  label:'Species',
  required:['description','creatureType','size','speed','features','languages'],
  refs:[{path:'features.*',kind:'features'},{path:'languages.fixed.*',kind:'languages'}],
  validate:function(def,fail){
    if(!isText(def.description))fail('needs a description');
    if(!isText(def.creatureType))fail('creatureType must be text, for example "Humanoid"');
    checkSize(def.size,fail);
    if(!isInt(def.speed)||def.speed<0||def.speed%5!==0)fail('speed must be a whole number of feet, a multiple of 5');
    if(!isIdList(def.features))fail('features must be a non-empty list of feature ids');
    var l=def.languages;
    if(!isObj(l)||!Array.isArray(l.fixed)||l.fixed.some(function(x){return typeof x!=='string'||!ID_RE.test(x)}))fail('languages needs {fixed:[language ids]}');
    else if(l.choose!==undefined)checkChoose(l.choose,fail,'languages.choose');
    if(def.senses!==undefined){
      if(!isObj(def.senses)||!Object.keys(def.senses).length||Object.keys(def.senses).some(function(k){return !isInt(def.senses[k])||def.senses[k]<1}))fail('senses must be an object of ranges in feet, for example {darkvision:60}');
    }
  },
  crossCheck:function(def,ctx){
    var c=def.languages&&def.languages.choose;
    if(c)B.checkFromCross(c.from,c.count,ctx,'languages.choose.from');
  }
});

/* ---------- backgrounds ---------- */
C.defineKind('backgrounds',{
  label:'Background',
  required:['description','abilityScoreOptions','originFeat','skills','tool','startingEquipment'],
  refs:[{path:'abilityScoreOptions',kind:'abilities'},{path:'originFeat',kind:'feats'},{path:'skills',kind:'skills'},{path:'tool.fixed',kind:'tools'},{path:'startingEquipment.options.*.items.*.item',kind:'items'}],
  validate:function(def,fail){
    if(!isText(def.description))fail('needs a description');
    var a=def.abilityScoreOptions;
    if(!isIdList(a)||a.length!==3||a.some(function(x,i){return a.indexOf(x)!==i}))fail('abilityScoreOptions must be three different ability ids');
    if(typeof def.originFeat!=='string'||!ID_RE.test(def.originFeat))fail('originFeat must be a feat id');
    var s=def.skills;
    if(!isIdList(s)||s.length!==2||s[0]===s[1])fail('skills must be two different skill ids');
    var t=def.tool,hasChoice=false;
    if(!isObj(t)||Object.keys(t).length!==1)fail('tool must be {fixed:<tool id>} or {choose:{count, from}}');
    else if(t.fixed!==undefined){if(typeof t.fixed!=='string'||!ID_RE.test(t.fixed))fail('tool.fixed must be a tool id')}
    else if(t.choose!==undefined){hasChoice=true;checkChoose(t.choose,fail,'tool.choose')}
    else fail('tool must be {fixed:<tool id>} or {choose:{count, from}}');
    checkEquipment(def.startingEquipment,fail,hasChoice?['tool']:[]);
  },
  crossCheck:function(def,ctx){
    var feat=ctx.get('feats',def.originFeat);
    if(feat&&feat.category!=='origin')ctx.fail('originFeat "'+def.originFeat+'" must be an Origin feat, not a '+feat.category+' feat');
    var c=def.tool&&def.tool.choose;
    if(c)B.checkFromCross(c.from,c.count,ctx,'tool.choose.from');
  }
});

/* ---------- classes ---------- */
C.defineKind('classes',{
  label:'Class',
  required:['description','hitDie','primaryAbility','savingThrows','skills','armorTraining','weaponProficiency','startingEquipment','features','implementedLevel','subclasses'],
  refs:[
    {path:'primaryAbility',kind:'abilities'},
    {path:'savingThrows',kind:'abilities'},
    {path:'skills.from',kind:'skills'},
    {path:'armorTraining',kind:'armorCategories'},
    {path:'weaponProficiency',kind:'weaponCategories'},
    {path:'startingEquipment.options.*.items.*.item',kind:'items'},
    {path:'features.*',kind:'features'},
    {path:'subclasses',kind:'subclasses'}
  ],
  validate:function(def,fail){
    if(!isText(def.description))fail('needs a description');
    if(HIT_DICE.indexOf(def.hitDie)<0)fail('hitDie must be one of '+HIT_DICE.join(', '));
    if(!isIdList(def.primaryAbility))fail('primaryAbility must be a non-empty list of ability ids');
    if(!isIdList(def.savingThrows)||def.savingThrows.length!==2||def.savingThrows[0]===def.savingThrows[1])fail('savingThrows must be two different ability ids');
    var s=def.skills;
    if(!isObj(s)||!isInt(s.count)||s.count<1||!isIdList(s.from)||s.from.length<s.count)fail('skills needs {count, from} with from a list of skill ids at least as long as count');
    if(!isIdList(def.armorTraining))fail('armorTraining must be a non-empty list of armor category ids');
    if(!isIdList(def.weaponProficiency))fail('weaponProficiency must be a non-empty list of weapon category ids');
    checkEquipment(def.startingEquipment,fail,[]);
    checkFeatureMap(def.features,fail,'features',1);
    if(isObj(def.features)&&!def.features['1'])fail('features needs an entry for level 1');
    if(!isInt(def.implementedLevel)||def.implementedLevel<1||def.implementedLevel>20)fail('implementedLevel must be a whole number from 1 to 20');
    if(def.subclassLevel!==undefined&&(!isInt(def.subclassLevel)||def.subclassLevel<1||def.subclassLevel>20))fail('subclassLevel must be a whole number from 1 to 20');
    if(!Array.isArray(def.subclasses)||def.subclasses.some(function(x){return typeof x!=='string'||!ID_RE.test(x)}))fail('subclasses must be a list of subclass ids (use [] for none yet)');
    if(def.spellcasting!==undefined&&def.spellcasting!==null)fail('spellcasting is reserved for a later phase and must be null');
  },
  crossCheck:function(def,ctx){
    Object.keys(def.features).forEach(function(lv){
      var level=Number(lv);
      def.features[lv].forEach(function(id){
        var f=ctx.get('features',id);
        if(f&&level<=def.implementedLevel&&f.status==='stub')ctx.fail('features['+lv+'] "'+id+'" is a stub but the class says level '+level+' is implemented (implementedLevel '+def.implementedLevel+')');
      });
    });
    ctx.list('subclasses').forEach(function(sc){
      if(sc.class===def.id&&def.subclasses.indexOf(sc.id)<0)ctx.fail('subclass "'+sc.id+'" belongs to this class but is not listed in subclasses');
    });
    def.subclasses.forEach(function(id){
      var sc=ctx.get('subclasses',id);
      if(sc&&sc.class!==def.id)ctx.fail('subclass "'+id+'" belongs to class "'+sc.class+'"');
    });
  }
});

/* ---------- subclasses ---------- */
C.defineKind('subclasses',{
  label:'Subclass',
  required:['description','class','features'],
  refs:[{path:'class',kind:'classes'},{path:'features.*',kind:'features'}],
  validate:function(def,fail){
    if(!isText(def.description))fail('needs a description');
    if(typeof def.class!=='string'||!ID_RE.test(def.class))fail('class must be a class id');
    checkFeatureMap(def.features,fail,'features',1);
  }
});
})();
