/* Presentation presets for the weapons, armor and shield in the items tables (implementation plan, sections 9 and 15.4).
   One row per item look, with the same id as the item that uses it. family names a builder in js/engine/gear-models.js;
   params and palette feed it. mount is where the item sits when equipped (hand, forearm for a shield, body for armor) and
   stow is where it hangs while carried but not held (hip, belt, back-flat, back-diag, or null to draw nothing).
   This file is data only, so the rules tests load it without Three.js. Presentation art is original and not licensed rules content, so the kind has no source tag and the SRD source filter keeps it.
   Palette colors are numbers (0xRRGGBB). Cosmetics (Phase 12) will point an item at a different row, or override
   params and palette on the item's own visual, and can never change a rule. */
(function(){
var C=Fable.content;
var STEEL={blade:0xe2e8ef,fuller:0x9aa5b1};
function row(id,name,family,mount,stow,params,palette){
  var r={id:id,name:name,family:family,mount:mount,stow:stow};
  if(params)r.params=params;
  if(palette)r.palette=palette;
  return r;
}
function H(id,name,family,stow,params,palette){return row(id,name,family,'hand',stow,params,palette)}
function A(id,name,params,palette){return row(id,name,'armor','body',null,params,palette)}

C.itemModels.registerAll([
  /* Simple melee */
  H('club','Club','bludgeon','hip',{style:'club',shaft:9,head:3}),
  H('dagger','Dagger','blade','belt',{blade:5,width:1.1,guard:2.6,grip:1.8,pommel:1.2,thick:.5},STEEL),
  H('greatclub','Greatclub','bludgeon','back-diag',{style:'club',shaft:17,head:4.2}),
  H('handaxe','Handaxe','axe','belt',{shaft:8,head:'single',size:3.4}),
  H('javelin','Javelin','polearm','back-diag',{length:22,head:'javelin',blade:4}),
  H('light-hammer','Light Hammer','bludgeon','belt',{style:'hammer',shaft:7,head:2.8}),
  H('mace','Mace','bludgeon','hip',{style:'mace',shaft:10,head:3.2}),
  H('quarterstaff','Quarterstaff','staff','back-diag',{length:26}),
  H('sickle','Sickle','axe','belt',{shaft:6,head:'sickle'}),
  H('spear','Spear','polearm','back-diag',{length:26,head:'spear',blade:5}),
  /* Simple ranged */
  H('dart','Dart','polearm','belt',{length:6,head:'dart'}),
  H('light-crossbow','Light Crossbow','crossbow','back-diag',{span:10,stock:9}),
  H('shortbow','Shortbow','bow','back-diag',{height:18}),
  H('sling','Sling','sling','belt'),
  /* Martial melee */
  H('battleaxe','Battleaxe','axe','hip',{shaft:12,head:'single',size:4.6}),
  H('flail','Flail','bludgeon','hip',{style:'flail',shaft:7,head:2.8}),
  H('glaive','Glaive','polearm','back-diag',{length:30,head:'glaive'}),
  H('greataxe','Greataxe','axe','back-diag',{shaft:20,head:'double',size:5.2}),
  H('greatsword','Greatsword','blade','back-diag',{blade:20,width:2.2,guard:7,grip:4.5,pommel:2.2},STEEL),
  H('halberd','Halberd','polearm','back-diag',{length:30,head:'halberd'}),
  H('lance','Lance','polearm','back-diag',{length:36,head:'lance',blade:6}),
  H('longsword','Longsword','blade','hip',{blade:13,width:1.4,guard:5.6,grip:3,pommel:1.7},STEEL),
  H('maul','Maul','bludgeon','back-diag',{style:'hammer',shaft:17,head:4.4}),
  H('morningstar','Morningstar','bludgeon','hip',{style:'morningstar',shaft:10,head:3.2}),
  H('pike','Pike','polearm','back-diag',{length:40,head:'pike',blade:5}),
  H('rapier','Rapier','blade','hip',{blade:15,width:.8,guard:3.2,grip:2.6,pommel:1.3,cup:true},STEEL),
  H('scimitar','Scimitar','blade','hip',{blade:11,width:1.7,guard:4.2,grip:2.6,pommel:1.5,curve:1},STEEL),
  H('shortsword','Shortsword','blade','hip',{blade:9,width:1.3,guard:4.2,grip:2.4,pommel:1.5},STEEL),
  H('trident','Trident','polearm','back-diag',{length:26,head:'trident'}),
  H('warhammer','Warhammer','bludgeon','hip',{style:'hammer',shaft:10,head:3.2}),
  H('war-pick','War Pick','axe','hip',{shaft:10,head:'pick',size:4}),
  H('whip','Whip','whip','belt'),
  /* Martial ranged */
  H('blowgun','Blowgun','staff','belt',{length:14,cap:false}),
  H('hand-crossbow','Hand Crossbow','crossbow','belt',{span:7,stock:6}),
  H('heavy-crossbow','Heavy Crossbow','crossbow','back-diag',{span:13,stock:11}),
  H('longbow','Longbow','bow','back-diag',{height:24}),
  H('musket','Musket','firearm','back-diag',{barrel:20,stock:true}),
  H('pistol','Pistol','firearm','belt',{barrel:6,stock:false}),
  /* Shield: strapped on the forearm, carried on the back */
  row('shield','Shield','shield','forearm','back-flat',{w:7.4,h:9.6},{rim:0xf0b94d,face:0x2f5d9e,mark:0xe8dcc0,boss:0xf0b94d}),
  /* Light armor */
  A('padded-armor','Padded Armor',{style:'cloth',depth:5.6,width:9.6,sleeve:5,pauldrons:false},{main:0xc9b48a,alt:0xa8946a}),
  A('leather-armor','Leather Armor',{style:'leather',depth:5.5,width:9.5,sleeve:4,pauldrons:false},{main:0x7a4a2a,alt:0x5a3418,trim:0xc39438}),
  A('studded-leather-armor','Studded Leather Armor',{style:'leather',depth:5.6,width:9.6,sleeve:4.4,pauldrons:true},{main:0x6a4226,alt:0x4a2c16,trim:0xc2cbd0}),
  /* Medium armor */
  A('hide-armor','Hide Armor',{style:'hide',depth:5.8,width:10,sleeve:5,pauldrons:true},{main:0x8a6a48,alt:0x6a4a30,trim:0xe8dcc0}),
  A('chain-shirt','Chain Shirt',{style:'mail',depth:5.4,width:9.4,height:8,sleeve:3,pauldrons:false},{main:0xb8c2cc,alt:0x8a95a0}),
  A('scale-mail','Scale Mail',{style:'scale',depth:5.8,width:9.8,sleeve:5,pauldrons:true,skirt:1.2},{main:0xb08a4a,alt:0x8a6a30,trim:0xd6b26a}),
  A('breastplate','Breastplate',{style:'plate',depth:5.8,width:9.6,sleeve:0,pauldrons:false},{main:0xc8d0d8,alt:0x9aa5b1,trim:0xf0b94d}),
  A('half-plate-armor','Half Plate Armor',{style:'plate',depth:6,width:10,sleeve:5,pauldrons:true,skirt:1.4},{main:0xc0c8d0,alt:0x8a95a0,trim:0xf0b94d}),
  /* Heavy armor */
  A('ring-mail','Ring Mail',{style:'mail',depth:5.8,width:9.8,sleeve:5,pauldrons:false},{main:0x8a8f96,alt:0x5d6670}),
  A('chain-mail','Chain Mail',{style:'mail',depth:5.8,width:9.8,sleeve:6.4,pauldrons:true,tabard:true},{main:0xaab4c0,alt:0x7d8896,trim:0xf0b94d,tabard:0xa8322b,tabardTrim:0xf0b94d}),
  A('splint-armor','Splint Armor',{style:'plate',depth:6,width:10,sleeve:6.4,pauldrons:true,skirt:1.6,tabard:true},{main:0x9aa3ad,alt:0x6a737d,trim:0xc2cbd0,tabard:0x2f5d9e,tabardTrim:0xe8dcc0}),
  A('plate-armor','Plate Armor',{style:'plate',depth:6.2,width:10.2,sleeve:6.4,pauldrons:true,skirt:2,cuirass:1},{main:0xd2dae2,alt:0x9aa5b1,trim:0xf0b94d})
]);
})();
