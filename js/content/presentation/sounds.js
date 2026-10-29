/* Sound recipes (implementation plan, section 15.7), synthesised by Fable.createAudio from these rows: no audio files ship. */
(function(){
var S=Fable.content.sounds;
function snd(id,name,bus,dur,layers,more){return Object.assign({id:id,name:name,source:'original',bus:bus,dur:dur,layers:layers},more||{})}
var N=function(color,ft,f,q,env,gain,delay,dur){return {type:'noise',color:color,filter:{type:ft,freq:f,q:q},env:env,gain:gain,delay:delay||0,dur:dur}};
var O=function(wave,f,env,gain,delay,dur){return {type:'osc',wave:wave,freq:f,env:env,gain:gain,delay:delay||0,dur:dur}};
S.registerAll([
  snd('sfx-whoosh','Blade whoosh','sfx',.18,[N('pink','bandpass',[500,2600],1.2,[.03,.06,.5,.08],.5,0,.12)],{variation:{pitch:.12,gain:.1},priority:1}),
  snd('sfx-whoosh-heavy','Heavy whoosh','sfx',.26,[N('brown','bandpass',[300,1500],1,[.05,.08,.5,.12],.8,0,.18),O('sine',[140,70],[.01,.1,.3,.1],.25,0,.16)],{variation:{pitch:.1}}),
  snd('sfx-whoosh-thrust','Thrust hiss','sfx',.14,[N('white','highpass',[2200,5000],.8,[.01,.04,.4,.05],.3,0,.1)]),
  snd('sfx-hit','Blade on flesh','sfx',.3,[N('pink','lowpass',[3200,500],.8,[.002,.05,.2,.12],.8,0,.1),O('sine',[190,60],[.002,.08,.2,.1],.55,0,.12),N('white','highpass',[4500,4500],.5,[.001,.02,0,.04],.35,0,.03)],{variation:{pitch:.1,gain:.1},priority:3}),
  snd('sfx-hit-steel','Blade on armor','sfx',.5,[N('white','highpass',[3000,3000],.5,[.001,.03,.1,.1],.5,0,.06),O('square',[2200,2200],[.001,.1,.15,.35],.12,0,.05),O('triangle',[1500,1480],[.001,.2,.1,.3],.15,0,.1),O('sine',[160,70],[.002,.07,.2,.08],.4,0,.1)],{variation:{pitch:.08},priority:3}),
  snd('sfx-crit','Critical hit','sfx',.9,[N('pink','lowpass',[4200,400],.7,[.002,.08,.2,.2],1,0,.15),O('sine',[150,38],[.002,.18,.3,.25],.8,0,.25),O('triangle',[1200,2400],[.002,.1,.2,.3],.2,.03,.1),O('triangle',[1800,1790],[.01,.3,.2,.4],.12,.06,.2)],{variation:{pitch:.05,gain:.05},priority:4,duck:.35}),
  snd('sfx-hit-heavy','Heavy blow','sfx',.7,[N('brown','lowpass',[2500,200],.7,[.002,.1,.3,.3],1,0,.2),O('sine',[110,30],[.002,.2,.3,.3],.9,0,.3)],{priority:4}),
  snd('sfx-miss','Missed blow','sfx',.22,[N('pink','bandpass',[1800,600],1.5,[.02,.06,.3,.1],.22,0,.1)]),
  snd('sfx-block','Shield block','sfx',.6,[N('white','highpass',[2500,2500],.6,[.001,.03,.1,.12],.5,0,.05),O('triangle',[760,740],[.001,.18,.15,.3],.22,0,.1),O('sine',[130,60],[.002,.08,.25,.1],.5,0,.1)],{priority:3}),
  snd('sfx-step','Footstep','sfx',.12,[N('brown','lowpass',[900,300],.6,[.003,.04,.1,.06],.5,0,.05),N('white','highpass',[3500,3500],.5,[.001,.02,0,.04],.07,.0,.02)],{variation:{pitch:.2,gain:.25},priority:0}),
  snd('sfx-step-armor','Armoured footstep','sfx',.2,[N('brown','lowpass',[900,300],.6,[.003,.05,.1,.07],.55,0,.06),N('white','highpass',[4200,4200],.6,[.001,.03,.1,.08],.12,.01,.03),O('triangle',[2600,2400],[.001,.06,.1,.1],.04,.01,.03)],{variation:{pitch:.2,gain:.25},priority:0}),
  snd('sfx-thud','Body falls','sfx',.6,[N('brown','lowpass',[800,120],.6,[.003,.1,.3,.25],1,0,.12),O('sine',[90,35],[.003,.15,.3,.25],.8,0,.2)],{priority:3}),
  snd('sfx-draw','Draw weapon','sfx',.5,[N('white','highpass',[3000,6000],1.5,[.02,.18,.3,.1],.25,0,.2),O('triangle',[2300,2900],[.01,.1,.1,.2],.06,.1,.1)]),
  snd('sfx-gulp','Drink','sfx',.5,[O('sine',[300,140],[.01,.05,.4,.1],.25,0,.08),O('sine',[260,110],[.01,.05,.4,.1],.25,.2,.08),N('pink','bandpass',[600,900],1,[.02,.1,.2,.1],.1,0,.2)]),
  snd('sfx-heal','Healing chime','sfx',1.2,[{type:'notes',wave:'sine',notes:[['E5',0,.5,1],['G5',.08,.5,.8],['B5',.16,.7,.7],['E6',.24,.9,.5]],env:[.01,.1,.5,.5],gain:.18},N('pink','highpass',[4000,4000],.5,[.1,.3,.2,.4],.04,0,.5)],{priority:2}),
  snd('sfx-surge','Second wind surge','sfx',1.4,[{type:'notes',wave:'triangle',notes:[['C4',0,.3,.7],['G4',.12,.3,.7],['C5',.24,.4,.8],['E5',.36,.5,.8],['G5',.48,.9,.7]],env:[.01,.1,.5,.5],gain:.2},O('sine',[90,180],[.1,.5,.4,.4],.3,0,.8)],{priority:3}),
  snd('sfx-star','Heroic Inspiration','sfx',1.4,[{type:'notes',wave:'sine',notes:[['A5',0,.3,.8],['E6',.07,.3,.8],['A6',.14,.9,.7],['C#7',.21,.9,.4]],env:[.005,.08,.4,.6],gain:.16},N('white','highpass',[7000,7000],.5,[.01,.4,.2,.6],.05,0,.8)],{priority:3,duck:.3}),
  snd('sfx-roll','Dice clatter','sfx',.6,[N('white','bandpass',[3000,2000],3,[.001,.02,0,.02],.25,0,.02),N('white','bandpass',[2600,1800],3,[.001,.02,0,.02],.22,.07,.02),N('white','bandpass',[3200,2200],3,[.001,.02,0,.02],.2,.15,.02),N('white','bandpass',[2800,2000],3,[.001,.02,0,.02],.18,.26,.02)],{priority:1}),
  snd('sfx-turn','Turn chime','sfx',.6,[{type:'notes',wave:'sine',notes:[['D5',0,.3,1],['A5',.1,.5,.8]],env:[.005,.1,.4,.3],gain:.1}],{priority:1}),
  /* coins: a single clink, a handful tumbling and settling, and the quick tick that counts gold up on the results screen */
  snd('sfx-coin','Coin clink','sfx',.5,[O('triangle',[2700,2650],[.001,.05,.15,.3],.14,0,.12),O('sine',[4100,4050],[.001,.04,.1,.25],.07,.012,.1),N('white','highpass',[6000,6000],.5,[.001,.01,0,.02],.08,0,.015)],{variation:{pitch:.18,gain:.15},priority:1}),
  snd('sfx-coins','Coins spill','sfx',.9,[O('triangle',[2500,2450],[.001,.05,.15,.3],.12,0,.1),O('triangle',[3000,2950],[.001,.05,.15,.3],.1,.07,.1),O('triangle',[2200,2150],[.001,.05,.15,.3],.12,.15,.1),O('triangle',[3300,3250],[.001,.05,.15,.3],.08,.23,.1),O('triangle',[2750,2700],[.001,.05,.15,.3],.1,.34,.1),N('white','highpass',[6500,6500],.5,[.001,.02,0,.04],.1,0,.4)],{variation:{pitch:.1,gain:.1},priority:2}),
  snd('sfx-coin-tick','Coin count tick','sfx',.2,[O('triangle',[3200,3150],[.001,.03,.1,.12],.1,0,.06),O('sine',[4800,4700],[.001,.02,.05,.1],.05,0,.04)],{variation:{pitch:.12,gain:.1},priority:0}),
  snd('sfx-pop','Goblin springs out','sfx',.5,[N('pink','bandpass',[400,1600],1,[.02,.1,.3,.15],.5,0,.2),O('sine',[200,60],[.01,.1,.3,.1],.3,0,.1)]),
  snd('sfx-death','Defeat','sfx',.9,[N('brown','lowpass',[1500,150],.7,[.01,.3,.3,.4],.5,0,.4),O('sine',[160,40],[.01,.3,.3,.4],.3,0,.4)]),
  snd('sfx-throw','Throw release','sfx',.25,[N('pink','bandpass',[900,2800],1.4,[.01,.05,.3,.1],.35,0,.12)]),
  snd('sfx-spin','Thrown weapon spin','sfx',.4,[O('sine',[700,500],[.02,.1,.3,.1],.06,0,.3)],{variation:{pitch:.15}}),
  snd('sfx-status','Status applied','sfx',.5,[{type:'notes',wave:'triangle',notes:[['A3',0,.2,.7],['E3',.1,.3,.7]],env:[.01,.08,.4,.2],gain:.14}],{priority:2}),
  snd('sfx-victory','Victory stinger','music',3.6,[{type:'notes',wave:'triangle',notes:[['D4',0,.5,.9],['A4',.18,.5,.8],['D5',.36,.6,.9],['F#5',.54,.6,.8],['A5',.72,1.8,.9],['D4',.72,2,.5],['A4',.72,2,.4]],env:[.02,.2,.6,.9],gain:.22,filter:{type:'lowpass',freq:3600}}],{priority:5}),
  snd('sfx-defeat','Defeat stinger','music',3.6,[{type:'notes',wave:'sawtooth',notes:[['D3',0,1,.8],['C3',.7,1,.8],['A#2',1.4,2,.9],['F2',1.4,2.2,.5]],env:[.05,.3,.6,1],gain:.16,filter:{type:'lowpass',freq:900}}],{priority:5}),
  snd('sfx-fight','Combat begins','music',2.4,[O('sine',[90,40],[.01,.5,.4,.8],.7,0,.9),{type:'notes',wave:'sawtooth',notes:[['D3',0,.4,.8],['D3',.25,.4,.8],['A2',.5,1.2,.9]],env:[.02,.1,.6,.4],gain:.14,filter:{type:'lowpass',freq:1100}}],{priority:5}),
  snd('voice-goblin-a','Goblin voice, high','voice',.7,[{type:'babble',wave:'sawtooth',base:[260,380],formants:[[700,5],[1800,6]],rate:9,gain:.45}],{variation:{pitch:.18},priority:2}),
  snd('voice-goblin-b','Goblin voice, low','voice',.7,[{type:'babble',wave:'sawtooth',base:[170,260],formants:[[550,5],[1300,5]],rate:7,gain:.5}],{variation:{pitch:.18},priority:2}),
  snd('voice-goblin-cackle','Goblin cackle','voice',.9,[{type:'babble',wave:'sawtooth',base:[300,460],formants:[[900,6],[2100,7]],rate:12,gain:.4,syllables:7}],{variation:{pitch:.15},priority:2}),
  snd('voice-goblin-hurt','Goblin yelp','voice',.35,[O('sawtooth',[520,260],[.005,.08,.4,.12],.3,0,.15)],{variation:{pitch:.2},priority:3}),
  snd('voice-goblin-die','Goblin death cry','voice',.8,[O('sawtooth',[480,110],[.005,.2,.4,.3],.32,0,.4),{type:'babble',wave:'sawtooth',base:[260,340],rate:6,gain:.2,syllables:3,delay:.05}],{variation:{pitch:.12},priority:4}),
  snd('voice-hero-effort','Hero effort','voice',.3,[N('pink','bandpass',[700,500],1.5,[.01,.06,.3,.1],.35,0,.12),O('sawtooth',[170,120],[.01,.07,.3,.1],.12,0,.12)],{variation:{pitch:.12}}),
  snd('voice-hero-hurt','Hero grunt','voice',.35,[O('sawtooth',[200,120],[.005,.09,.4,.12],.25,0,.16),N('pink','bandpass',[600,400],1.5,[.005,.06,.2,.1],.2,0,.1)],{variation:{pitch:.1},priority:3}),
  snd('voice-hero-down','Hero falls','voice',.8,[O('sawtooth',[220,70],[.01,.25,.4,.35],.3,0,.4),N('pink','lowpass',[900,200],1,[.02,.2,.2,.3],.2,0,.4)],{priority:4}),
  snd('voice-hero-cheer','Hero shout','voice',.9,[O('sawtooth',[160,230],[.02,.2,.5,.3],.28,0,.4),O('sawtooth',[240,340],[.02,.2,.4,.3],.12,0,.4)],{priority:3}),
  {id:'bed-combat',name:'Combat theme',source:'original',kind:'bed',layers:[],bpm:84,chords:[['D2','A2','D3','F3'],['D2','A2','D3','F3'],['A#1','F2','A#2','D3'],['C2','G2','C3','E3']],arp:['D4','F4','A4','C5','A4','F4']}
]);
})();
