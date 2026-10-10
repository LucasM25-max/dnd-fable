/* Defines the "feats" kind (SRD 5.2.1, "Feats", pp. 87-88). A feat has the same body as a feature (see feature-kind.js:
   resources, actions, effects, choices, grants, onRest) plus:
     category      origin | general | fighting-style | epic-boon
     prerequisite  null, or an object with any of
                     level        minimum character level
                     class        a class id the character has levels in
                     abilityScore {<ability id>:<minimum score>}
                     featureTag   the character has a feature carrying this tag (Defense needs 'fighting-style')
                     feats        feat ids the character must already have
     repeatable    true when the feat can be taken more than once (default false)
   A class feature picks feats with a choice such as {kind:'feats', category:'fighting-style'}, so a new Fighting Style is
   one more feat row and nothing else. Must come after feature-kind.js in manifest.feats. */
(function(){
var C=Fable.content,B=C.featureBody;
if(!B)throw new Error('feats/feat-kind.js needs feats/feature-kind.js to be loaded first');
var CATEGORIES=['origin','general','fighting-style','epic-boon'];
var PREREQ_KEYS=['level','class','abilityScore','featureTag','feats'];

function checkPrerequisite(p,fail){
  if(p===null)return;
  if(!B.isObj(p)){fail('prerequisite must be null or an object');return}
  var keys=Object.keys(p);
  if(!keys.length)fail('prerequisite must be null or name at least one requirement');
  keys.forEach(function(k){if(PREREQ_KEYS.indexOf(k)<0)fail('prerequisite has an unknown requirement "'+k+'" (known: '+PREREQ_KEYS.join(', ')+')')});
  if(p.level!==undefined&&(!B.isInt(p.level)||p.level<1||p.level>20))fail('prerequisite.level must be a whole number from 1 to 20');
  if(p.class!==undefined&&(typeof p.class!=='string'||!B.ID_RE.test(p.class)))fail('prerequisite.class must be a class id');
  if(p.featureTag!==undefined&&(typeof p.featureTag!=='string'||!B.ID_RE.test(p.featureTag)))fail('prerequisite.featureTag must be an id');
  if(p.feats!==undefined&&!B.isIdList(p.feats))fail('prerequisite.feats must be a non-empty list of feat ids');
  if(p.abilityScore!==undefined){
    var a=p.abilityScore;
    if(!B.isObj(a)||!Object.keys(a).length)fail('prerequisite.abilityScore must be {<ability id>:<minimum score>}');
    else Object.keys(a).forEach(function(k){if(!B.isInt(a[k])||a[k]<1||a[k]>30)fail('prerequisite.abilityScore.'+k+' must be a score from 1 to 30')});
  }
}

C.defineKind('feats',{
  label:'Feat',
  required:['category'],
  refs:B.refs.concat([{path:'prerequisite.feats.*',kind:'feats'},{path:'prerequisite.class',kind:'classes'}]),
  normalize:function(def){
    if(def.prerequisite===undefined)def.prerequisite=null;
    if(def.repeatable===undefined)def.repeatable=false;
  },
  validate:function(def,fail){
    if(CATEGORIES.indexOf(def.category)<0)fail('category must be one of '+CATEGORIES.join(', '));
    if(typeof def.repeatable!=='boolean')fail('repeatable must be true or false');
    checkPrerequisite(def.prerequisite,fail);
    if(def.category==='fighting-style'&&def.prerequisite===null)fail('a Fighting Style feat needs a prerequisite (featureTag "fighting-style")');
    B.validate(def,fail);
  },
  crossCheck:function(def,ctx){
    B.crossCheck(def,ctx,'feats:'+def.id);
    var p=def.prerequisite;
    if(p&&p.abilityScore)Object.keys(p.abilityScore).forEach(function(k){if(!ctx.has('abilities',k))ctx.fail('prerequisite.abilityScore names unknown Ability "'+k+'"')});
    if(p&&p.featureTag&&!ctx.list('features').some(function(f){return (f.tags||[]).indexOf(p.featureTag)>=0}))ctx.fail('prerequisite.featureTag "'+p.featureTag+'" is not carried by any feature');
  }
});
C.feats.CATEGORIES=CATEGORIES.slice();
})();
