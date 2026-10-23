/* Bark lines (implementation plan, section 15.9): the goblins are vocal and a little cowardly, the fighter says very little. */
(function(){
Fable.content.barks.registerAll([
{id:'goblin-barks',name:'Goblin barks',source:'original',profile:'goblin-minion',voices:{a:'voice-goblin-a',b:'voice-goblin-b',cackle:'voice-goblin-cackle'},
 chance:{ambush:1,attack:.4,hit:.35,miss:.45,hurt:.5,down:.8,taunt:1,victory:1,flee:1},
 lines:{
  ambush:['Get him!','Fresh meat!','Kill the shiny one!','Hee hee hee!'],
  attack:['Stab stab stab!','Mine now!','Gut him!','Get over here!','Hah!'],
  hit:['Got him!','Bleed, bleed!','Hee hee!','Ha! Tasty!'],
  miss:['Hold still!','Blast!','Slippery one!','Missed?!'],
  hurt:['Ow ow ow!','Not the face!','Ahh!','That hurt!'],
  down:['Ow...','Boss, no...','Urgh!','Not fair...'],
  flee:['Nope nope nope!','Too scary!','Catch me!'],
  victory:['Shiny! Shiny!','He is down! He is down!','We win!'],
  taunt:['Hee hee hee!','Come on then!']}},
{id:'fighter-barks',name:'Fighter barks',source:'original',profile:'human-fighter',voices:{a:'voice-hero-effort',cheer:'voice-hero-cheer'},
 chance:{attack:.12,hit:.1,down:1,victory:1,heal:.6,inspire:.7},
 lines:{
  attack:['Hah!','Take that!','For the road!'],
  hit:['Down!','Stay down!'],
  down:['Not... yet...'],
  victory:['The clearing is ours.','Quiet again.'],
  heal:['Steady... steady.','Breathe.'],
  inspire:['One more chance!','Not today!']}}
]);
})();
