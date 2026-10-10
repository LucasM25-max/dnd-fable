/* Defines the one "items" kind that every weapon, armor, gear item, pack and tool is registered in, so a
   startingEquipment or inventory entry refers to any of them by id: {item:'longsword', qty:1}.
   Must be the first entry of manifest.items. The data files (weapons.js, armor.js, gear.js, packs.js, tool-items.js)
   only register rows.

   Common fields: id, name, source, type, cost (coins, for example {gp:15}), weight (pounds, 0 when the SRD lists none).
   normalize adds costCp, the cost in whole copper pieces (see Fable.money), so prices are always exact integers.

   type 'weapon'  category (weaponCategories id), kind 'melee'|'ranged', damage {dice,type}, properties [ids],
                  versatile (two handed dice, with the Versatile property), range {normal,long} (feet, with Thrown or Ammunition),
                  ammoType (with Ammunition), mastery (weaponMasteries id), twoHandedUnlessMounted (Lance)
   type 'armor'   category (armorCategories id), ac {base, dex:'full'|'cap'|'none', dexCap} or, for a Shield, ac {bonus},
                  strengthRequirement (score or null), stealthDisadvantage, don and doff (copied from the category when not given)
   type 'gear'    description; optional amount, ammoType and storage (ammunition), uses, magic, asWeapon
   type 'pack'    description, contents [{item, qty}] (gear only), weight (the SRD's total, checked against the contents)
   type 'tool'    tool (tools id); cost and weight come from the tool, see tool-items.js

   Dex rules for armor: 'full' adds the whole Dexterity modifier (Light), 'cap' adds it up to dexCap (Medium, +2),
   'none' ignores Dexterity altogether (Heavy), so a negative Dexterity modifier never lowers Heavy armor. */
(function(){
var C=Fable.content,M=Fable.money;
if(!M)throw new Error('items/item-kind.js needs js/rules/money.js to be loaded first');
var TYPES=['weapon','armor','gear','pack','tool'];
var DEX_RULES=['full','cap','none'];
var EPS=1e-9;

function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}
function isText(s){return typeof s==='string'&&s.length>0}
function isDonDoff(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  var keys=Object.keys(v);
  if(keys.length!==1)return false;
  if(keys[0]==='action')return v.action==='utilize';
  return keys[0]==='minutes'&&isInt(v.minutes)&&v.minutes>=1;
}
function checkDice(expr,fail,what){
  if(typeof expr!=='string'||!expr){fail(what+' must be a dice expression such as "1d8"');return}
  if(Fable.dice){var why=Fable.dice.validate(expr);if(why)fail(what+' "'+expr+'" is not valid dice: '+why)}
}
function checkDamage(d,fail,what){
  if(!d||typeof d!=='object'){fail(what+' needs {dice, type}');return}
  checkDice(d.dice,fail,what+'.dice');
  if(!isText(d.type))fail(what+'.type must be a damage type id');
}
function checkRange(r,fail){
  if(!r||!isInt(r.normal)||!isInt(r.long)||r.normal<1||r.long<=r.normal)fail('range needs whole numbers {normal, long} in feet, with long above normal');
}

function validateWeapon(def,fail){
  if(['melee','ranged'].indexOf(def.kind)<0)fail('kind must be "melee" or "ranged"');
  if(!isText(def.category))fail('category must be a weapon category id');
  checkDamage(def.damage,fail,'damage');
  var props=def.properties;
  if(!Array.isArray(props)||props.some(function(p){return !isText(p)}))fail('properties must be a list of weapon property ids (use [] for none)');
  else{
    if(props.some(function(p,i){return props.indexOf(p)!==i}))fail('properties lists the same property twice');
    var has=function(p){return props.indexOf(p)>=0};
    if(has('versatile')!==(def.versatile!==undefined))fail(has('versatile')?'a Versatile weapon needs a versatile dice value':'versatile dice only make sense with the Versatile property');
    if(def.versatile!==undefined)checkDice(def.versatile,fail,'versatile');
    var ranged=has('thrown')||has('ammunition');
    if(ranged!==(def.range!==undefined))fail(ranged?'a Thrown or Ammunition weapon needs a range':'range only makes sense with the Thrown or Ammunition property');
    if(def.range!==undefined)checkRange(def.range,fail);
    if(has('ammunition')!==(def.ammoType!==undefined))fail(has('ammunition')?'an Ammunition weapon needs an ammoType':'ammoType only makes sense with the Ammunition property');
    if(def.ammoType!==undefined&&!isText(def.ammoType))fail('ammoType must be text');
    if(has('ammunition')&&def.kind!=='ranged')fail('an Ammunition weapon must be Ranged');
    if(def.kind==='ranged'&&!ranged)fail('a Ranged weapon needs the Thrown or Ammunition property');
    if(def.twoHandedUnlessMounted!==undefined&&(def.twoHandedUnlessMounted!==true||!has('two-handed')))fail('twoHandedUnlessMounted only makes sense with the Two-Handed property');
  }
  if(!isText(def.mastery))fail('mastery must be a weapon mastery id');
}

function validateArmor(def,fail){
  if(!isText(def.category))fail('category must be an armor category id');
  var ac=def.ac;
  if(!ac||typeof ac!=='object')fail('ac is needed');
  else if(def.category==='shield'){
    if(Object.keys(ac).join()!=='bonus'||!isInt(ac.bonus)||ac.bonus<1)fail('a Shield needs ac {bonus:N}');
  }else{
    if(!isInt(ac.base)||ac.base<1)fail('ac needs a whole number base');
    if(DEX_RULES.indexOf(ac.dex)<0)fail('ac.dex must be one of '+DEX_RULES.join(', '));
    if(ac.dex==='cap'){if(!isInt(ac.dexCap)||ac.dexCap<0)fail('ac.dex "cap" needs a whole number dexCap')}
    else if(ac.dexCap!==undefined)fail('dexCap only makes sense with ac.dex "cap"');
    var extra=Object.keys(ac).filter(function(k){return ['base','dex','dexCap'].indexOf(k)<0});
    if(extra.length)fail('ac has an unknown field "'+extra[0]+'"');
  }
  if(def.strengthRequirement!==null&&(!isInt(def.strengthRequirement)||def.strengthRequirement<1||def.strengthRequirement>30))fail('strengthRequirement must be a score from 1 to 30, or null');
  if(typeof def.stealthDisadvantage!=='boolean')fail('stealthDisadvantage must be true or false');
  /* don and doff are filled in from the category, so they are only missing when the category itself is not loaded; validateAll reports that. */
  if(def.don!==undefined&&!isDonDoff(def.don))fail('don must be {minutes:N} or {action:"utilize"}');
  if(def.doff!==undefined&&!isDonDoff(def.doff))fail('doff must be {minutes:N} or {action:"utilize"}');
}

function validateGear(def,fail){
  if(!isText(def.description))fail('needs a description');
  if(def.amount!==undefined&&(!isInt(def.amount)||def.amount<1))fail('amount must be a whole number of 1 or more');
  if(def.ammoType!==undefined){
    if(!isText(def.ammoType))fail('ammoType must be text');
    if(def.amount===undefined||def.storage===undefined)fail('an ammunition item needs an amount and a storage item');
  }else if(def.amount!==undefined||def.storage!==undefined)fail('amount and storage are only for ammunition (give it an ammoType)');
  if(def.storage!==undefined&&!isText(def.storage))fail('storage must be an item id');
  if(def.uses!==undefined&&(!isInt(def.uses)||def.uses<1))fail('uses must be a whole number of 1 or more');
  if(def.magic!==undefined&&def.magic!==true)fail('magic must be true when given');
  if(def.asWeapon!==undefined){
    var a=def.asWeapon;
    if(!a||!isText(a.category)||a.kind!=='melee')fail('asWeapon needs a category and kind "melee"');
    else checkDamage(a.damage,fail,'asWeapon.damage');
  }
}

function validatePack(def,fail){
  if(!isText(def.description))fail('needs a description');
  var c=def.contents;
  if(!Array.isArray(c)||!c.length)fail('contents needs at least one entry');
  else c.forEach(function(e,i){
    if(!e||!isText(e.item)||!isInt(e.qty)||e.qty<1)fail('contents['+i+'] needs an item id and a whole number qty of 1 or more');
  });
}

C.defineKind('items',{
  label:'Item',
  required:['type','cost','weight'],
  refs:[
    {path:'damage.type',kind:'damageTypes'},
    {path:'asWeapon.damage.type',kind:'damageTypes'},
    {path:'properties.*',kind:'weaponProperties'},
    {path:'mastery',kind:'weaponMasteries'},
    {path:'storage',kind:'items'},
    {path:'contents.*.item',kind:'items'},
    {path:'tool',kind:'tools'}
  ],
  normalize:function(def){
    if(M.isCost(def.cost))def.costCp=M.toCp(def.cost);
    if(def.type==='armor'){
      if(def.strengthRequirement===undefined)def.strengthRequirement=null;
      if(def.stealthDisadvantage===undefined)def.stealthDisadvantage=false;
      var cat=C.armorCategories&&typeof def.category==='string'?C.armorCategories.get(def.category):null;
      if(cat){
        if(def.don===undefined)def.don=cat.don;
        if(def.doff===undefined)def.doff=cat.doff;
      }
    }
  },
  validate:function(def,fail){
    if(TYPES.indexOf(def.type)<0)fail('type must be one of '+TYPES.join(', '));
    var why=M.checkCost(def.cost);
    if(why)fail(why);
    if(typeof def.weight!=='number'||!isFinite(def.weight)||def.weight<0)fail('weight must be a number of pounds, 0 or more');
    if(def.type==='weapon')validateWeapon(def,fail);
    else if(def.type==='armor')validateArmor(def,fail);
    else if(def.type==='gear')validateGear(def,fail);
    else if(def.type==='pack')validatePack(def,fail);
    else if(def.type==='tool'&&!isText(def.tool))fail('tool must be a tools id');
  },
  crossCheck:function(def,ctx){
    if(def.type==='weapon'){
      if(!ctx.has('weaponCategories',def.category))ctx.fail('unknown weapon category "'+def.category+'"');
      def.properties.forEach(function(p){
        var row=ctx.get('weaponProperties',p);
        if(row&&row.onWeapons===false)ctx.fail('"'+p+'" is a rule, not a property a weapon can list');
      });
      if(def.ammoType!==undefined){
        var ammo=ctx.list('items').filter(function(i){return i.type==='gear'&&i.ammoType===def.ammoType});
        if(!ammo.length)ctx.fail('no ammunition item has ammoType "'+def.ammoType+'"');
      }
    }else if(def.type==='armor'){
      var cat=ctx.get('armorCategories',def.category);
      if(!cat)ctx.fail('unknown armor category "'+def.category+'"');
    }else if(def.type==='gear'){
      if(def.asWeapon&&!ctx.has('weaponCategories',def.asWeapon.category))ctx.fail('unknown weapon category "'+def.asWeapon.category+'" in asWeapon');
      if(def.storage!==undefined){
        var st=ctx.get('items',def.storage);
        if(st&&st.type!=='gear')ctx.fail('storage "'+def.storage+'" must be a gear item');
      }
    }else if(def.type==='pack'){
      var total=0,ok=true;
      def.contents.forEach(function(e){
        var it=ctx.get('items',e.item);
        if(!it){ok=false;return}
        if(it.type==='pack'){ctx.fail('a pack cannot contain another pack ("'+e.item+'")');ok=false;return}
        total+=it.weight*e.qty;
      });
      if(ok&&Math.abs(total-def.weight)>EPS)ctx.fail('weight is '+def.weight+' lb but its contents weigh '+total+' lb');
    }
  }
});
})();
