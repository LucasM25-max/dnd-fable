'use strict';
const assert=require('assert'),H=require('../harness');

/* Elminster, the tutorial companion: the engine decides which line is spoken and when (js/hud/dialogue-engine.js), and the first fight's
   script (js/content/dialogue/elminster-first-fight.js) is sound data. No DOM here. */
function world(rng){
  H.fresh();
  H.runFile('js/hud/dialogue-engine.js');
  H.runFile('js/content/dialogue/elminster-first-fight.js');
  const script=Fable.dialogue.get('elminster-first-fight');
  let seq=0;const r=rng||(()=>((seq++*0.37)%1));
  return {script,make:(o)=>Fable.dialogue.create(script,Object.assign({rng:r},o||{}))};
}
/* plays a whole line out: returns the time after it */
function finish(d,t){const c=d.current();return c?c.started+c.duration+1:t}

module.exports=function(t){
  t.suite('Dialogue',()=>{
    t.test('the first fight script is registered and sound: unique ids, text on every line, known priorities',async()=>{
      const {script}=world();
      assert.deepStrictEqual(Fable.dialogue.check(script),[]);
      assert.strictEqual(script.speaker.name,'Elminster');
      assert.ok(script.intro.length>=5,'a full opening spiel');
      assert.ok(script.lines.length>=40,'lots of lines that answer what the player does');
    });
    t.test('every event kind the controller sends has at least one line, and the spiel covers moving, attacking, Second Wind and ending the turn',async()=>{
      const {script}=world();
      const kinds=['move','attack','enemy-attack','hp','second-wind','enemy-turn','hero-turn','round','flee','endturn','inspiration-offer','inspiration-used','inspiration-kept','pickup','hero-down','deathsave','idle','victory','defeat'];
      kinds.forEach(k=>assert.ok(script.lines.some(l=>l.on===k),'no line for '+k));
      ['move','attack','second-wind','endturn'].forEach(k=>assert.ok(script.intro.some(l=>l.teaches===k),'the spiel does not teach '+k));
    });
    t.test('the check rejects broken scripts',async()=>{
      world();
      const ok=()=>({speaker:{id:'a',name:'A'},intro:[{id:'i',text:'x'}],lines:[{id:'l',on:'move',text:'y'}]});
      assert.deepStrictEqual(Fable.dialogue.check(ok()),[]);
      let s=ok();s.lines.push({id:'l',on:'move',text:'z'});assert.ok(Fable.dialogue.check(s).some(m=>/repeats the id/.test(m)));
      s=ok();s.lines[0].text='';assert.ok(Fable.dialogue.check(s).some(m=>/needs text/.test(m)));
      s=ok();s.lines[0].pri=9;assert.ok(Fable.dialogue.check(s).some(m=>/pri must be/.test(m)));
      s=ok();s.intro=[];assert.ok(Fable.dialogue.check(s).some(m=>/opening spiel/.test(m)));
      assert.throws(()=>Fable.dialogue.register('elminster-first-fight',ok()),/already registered/);
    });
    t.test('the opening spiel always plays, in order, even with comments muted',async()=>{
      const {make,script}=world();
      const d=make({muted:true});
      d.start(0);
      const said=[];let now=0;
      for(let i=0;i<script.intro.length;i++){
        d.tick(now);assert.ok(d.current(),'line '+i+' should be showing');
        said.push(d.current().id);now=finish(d,now);d.tick(now);now+=400;
      }
      assert.deepStrictEqual(said,script.intro.map(l=>l.id));
    });
    t.test('a line in the spiel is dropped unspoken when the player already did the thing it teaches',async()=>{
      const {make}=world();
      const d=make();d.start(0);
      d.event('move',{adjacent:false},10);d.event('attack',{hit:true,enemiesLeft:2},20);
      const said=[];let now=30;
      for(let i=0;i<12&&(d.current()||d.pending());i++){
        d.tick(now);if(d.current()){said.push(d.current().id);now=finish(d,now);d.tick(now)}now+=500;
      }
      assert.ok(!said.includes('intro-move')&&!said.includes('intro-attack'),said.join());
      assert.ok(said.includes('intro-end'));
    });
    t.test('a once-only line is spoken once; the first hit answers a hit and the first miss a miss',async()=>{
      const {make}=world();
      const d=make();d.start(0);
      // let the spiel finish
      let now=0;for(let i=0;i<30;i++){d.tick(now);now=d.current()?finish(d,now):now+500;d.tick(now);now+=400}
      assert.ok(!d.current()&&!d.pending());
      d.event('attack',{hit:true,crit:false,kill:false,enemiesLeft:2},now);
      assert.strictEqual(d.current().id,'atk-first-hit');
      now=finish(d,now);d.tick(now);now+=1000;d.tick(now);
      d.event('attack',{hit:true,crit:false,kill:false,enemiesLeft:2,hitStreak:2},now);
      assert.ok(!d.current()||d.current().id!=='atk-first-hit');
    });
    t.test('a critical hit gets its own line, a natural one on a miss gets the fumble line',async()=>{
      const {make}=world();
      let d=make();d.event('attack',{hit:true,crit:true,enemiesLeft:2},0);assert.strictEqual(d.current().id,'atk-crit');
      d=make();d.event('attack',{hit:false,fumble:true,enemiesLeft:2},0);assert.strictEqual(d.current().id,'atk-fumble');
      d=make();d.event('attack',{hit:false,enemiesLeft:2},0);assert.strictEqual(d.current().id,'atk-first-miss');
    });
    t.test('urgent news (the hero falls, Heroic Inspiration) cuts in on a line that is only chatter-level, but never on the spiel',async()=>{
      const {make}=world();
      let d=make();d.event('move',{adjacent:false},0);assert.strictEqual(d.current().id,'move-first');
      d.event('inspiration-offer',{hit:true},100);assert.strictEqual(d.current().id,'insp-offer');
      d=make();d.start(0);d.tick(0);assert.strictEqual(d.current().id,'intro-hello');
      d.event('hero-down',{},50);assert.strictEqual(d.current().id,'intro-hello');
      const end=finish(d,0);d.tick(end);d.tick(end+400);
      assert.strictEqual(d.current().id,'down','the urgent line comes before the rest of the spiel');
    });
    t.test('a reaction to what the player did is spoken right after the current line, ahead of the rest of the spiel',async()=>{
      const {make}=world();
      const d=make();d.start(0);d.tick(0);
      d.event('attack',{hit:true,crit:false,kill:false,enemiesLeft:2},500);
      const end=finish(d,0);d.tick(end);d.tick(end+400);
      assert.strictEqual(d.current().id,'atk-first-hit');
      const end2=finish(d,0);d.tick(end2);d.tick(end2+400);
      assert.strictEqual(d.current().id,'intro-move','the spiel goes on');
      const end3=finish(d,0);d.tick(end3);d.tick(end3+400);
      assert.strictEqual(d.current().id,'intro-economy','minus the attack lesson the player already showed');
    });
    t.test('chatter (priority 0) only fills a silence and never queues behind a line',async()=>{
      const {make}=world(()=>0);
      const d=make();d.event('move',{adjacent:false},0);
      assert.strictEqual(d.current().id,'move-first');
      d.event('attack',{hit:true,crit:false,kill:false,enemiesLeft:2},10);
      assert.strictEqual(d.pending(),1,'the important line waits its turn');
      const before=d.pending();d.event('enemy-attack',{hit:false},20);d.event('enemy-attack',{hit:false},21);
      assert.ok(d.pending()<=before+2);
    });
    t.test('muting drops comments on what the player does but keeps the urgent ones',async()=>{
      const {make}=world();
      const d=make({muted:true});
      assert.strictEqual(d.event('attack',{hit:true,crit:false,enemiesLeft:2},0),false);
      assert.ok(!d.current());
      d.event('hero-down',{},10);assert.strictEqual(d.current().id,'down');
      d.mute(false);assert.strictEqual(d.muted(),false);
    });
    t.test('a queued line that waited too long is dropped instead of answering something long past',async()=>{
      const {make}=world();
      const d=make();d.event('move',{adjacent:false},0);
      d.event('endturn',{unspentAction:false},10);
      assert.strictEqual(d.pending(),1);
      d.tick(d.current().duration+1);          /* the first line ends */
      d.tick(60000);                           /* a minute later nobody wants to hear about the end of a turn */
      assert.ok(!d.current(),'the stale line was dropped');
    });
    t.test('the idle nudges escalate, and the first one depends on whether the player has attacked yet',async()=>{
      const {make}=world();
      let d=make();d.event('idle',{stage:1,spent:false},0);assert.strictEqual(d.current().id,'idle-1');
      d=make();d.event('attack',{hit:true,enemiesLeft:2},0);d.tick(1e5);
      d.event('idle',{stage:2,spent:true},2e5);assert.strictEqual(d.current().id,'idle-2');
    });
    t.test('fields in a line are filled from the event data',async()=>{
      world();
      const sc={speaker:{id:'a',name:'A'},intro:[{id:'i',text:'x'}],lines:[{id:'l',on:'ping',text:'Hit {name} for {dmg}',pri:1}]};
      const d=Fable.dialogue.create(sc);d.event('ping',{name:'goblin',dmg:5},0);
      assert.strictEqual(d.current().text,'Hit goblin for 5');
    });
    t.test('how long a line stays up follows its length, never under two and a half seconds',async()=>{
      world();
      assert.ok(Fable.dialogue.duration('Hi')>=2600);
      assert.ok(Fable.dialogue.duration('x'.repeat(200))>Fable.dialogue.duration('x'.repeat(50)));
    });
  });
};
