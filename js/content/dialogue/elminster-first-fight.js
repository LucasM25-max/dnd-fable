/* Elminster's walk through the first fight (the Goblin Ambush). The encounter names this script (dialogue: 'elminster-first-fight'),
   and js/hud/elminster.js plays it. Elminster Aumar is the Sage of Shadowdale, a Chosen of Mystra, a pipe smoker and a famously
   rambling teacher; he is fond of a joke at his own expense and never quite stops lecturing. The voice here is his, kept short so each
   line fits the box and can be read in a few seconds.

   The opening spiel always plays (it is the lesson); a line in it is dropped unspoken if the player has already shown they know it.
   Everything else answers what the player does. The controller sends these events, with this data:
     start                                            the fight begins (the opening spiel is queued on this)
     hero-turn {round, hpPct}                         the hero's turn begins
     enemy-turn {round}                               a goblin's turn begins
     round {n}                                        a new round begins
     move {adjacent, attacked, enemiesLeft}           the hero walked; adjacent: an enemy is now next to him
     attack {hit, crit, fumble, kill, ranged, thrown, nat, enemiesLeft, missStreak, hitStreak}     the hero attacked
     enemy-attack {hit, crit, ranged, dmg, hpPct, who}                      a goblin attacked the hero
     hp {pct, bloodied, low, windLeft}                the hero's hit points changed
     second-wind {healed}                             the hero used Second Wind
     endturn {unspentAction, unspentMove}             the hero ended the turn
     inspiration-offer {hit}                          the Heroic Inspiration question is on screen
     inspiration-used {from, to, hit}                 the hero rerolled
     inspiration-kept {hit}                           the hero kept the roll
     pickup                                           the hero picked something up
     flee                                             a goblin runs away
     hero-down / deathsave {outcome}                  the hero is at 0 hit points
     idle {stage, spent}                              the hero's turn has waited (stage 1, 2, 3); spent: Action already used
     victory {hpPct, rounds} / defeat                 the fight is over
   pri: 0 chatter, 1 normal, 2 important, 3 urgent (see js/hud/dialogue-engine.js). */
(function(){
Fable.dialogue.register('elminster-first-fight',{
  speaker:{id:'elminster',name:'Elminster',title:'Sage of Shadowdale'},

  /* ---------- the opening spiel: always plays, in this order ---------- */
  intro:[
    {id:'intro-hello',text:'Ah, there you are. Elminster, of Shadowdale. Do not mind the pipe. A band of goblins has been rude to the road, and I thought you might care to teach them manners. I shall talk you through it.'},
    {id:'intro-move',teaches:'move',text:'First, your feet. Click any square on the ground to walk there. Blue means you can reach it, red means you cannot, and every five feet you walk comes out of your Speed for the turn.'},
    {id:'intro-attack',teaches:'attack',text:'Now, steel. Press 2 to ready your longsword, then click a goblin. An attack is a d20 plus your bonuses: equal their Armor Class or beat it, and you hit.'},
    {id:'intro-economy',text:'Each turn you have your movement, one Action and one Bonus Action, to spend in any order. Walk, strike, walk again. A wise fighter uses all three.'},
    {id:'intro-wind',teaches:'second-wind',text:'Should you get hurt, Second Wind on your hotbar is a Bonus Action that mends you. A fighter gets back on his feet faster than most. Spend it when you need it, not before.'},
    {id:'intro-end',teaches:'endturn',text:'When you are done, press Space or the End Turn button and the goblins take their turn. Hover anything on screen for a hint. Off you go, and do try not to die. Mystra would never let me hear the end of it.'}
  ],

  lines:[
    /* ---------- moving ---------- */
    {id:'move-first',on:'move',once:true,pri:1,text:'Splendid. Walking: the oldest and most underrated of the martial arts.'},
    {id:'move-adjacent-first',on:'move',once:true,pri:1,when:function(d){return d.adjacent},text:'Toe to toe with the enemy. Press 2 and strike while you hold your Action.'},
    {id:'move-after-attack',on:'move',once:true,pri:1,when:function(d,c){return d.attacked&&c.count('move')>1},text:'You may move after you strike, too. Many a fighter has danced out of reach once the deed was done.'},
    {id:'move-chatter',on:'move',pri:0,chance:.35,text:[
      'Good footing matters more than good steel.',
      'The forest does not mind your boots, though the goblins surely do.',
      'I once walked from Shadowdale to Waterdeep in a fortnight. Spells are quicker, naturally.'
    ]},

    /* ---------- the hero attacks ---------- */
    {id:'atk-first-hit',on:'attack',once:true,pri:2,when:function(d){return d.hit&&!d.crit},text:'A palpable hit! Your roll met their Armor Class, and the damage came off their hit points. When those reach zero, the goblin is done. Simple arithmetic.'},
    {id:'atk-first-miss',on:'attack',once:true,pri:2,when:function(d){return !d.hit&&!d.fumble},text:'A miss. It happens to the finest of us. I once missed a dragon at ten paces. It was very large, which rather ruins the excuse.'},
    {id:'atk-crit',on:'attack',once:true,pri:2,when:function(d){return d.crit},text:'A natural twenty! A critical hit: the damage dice are doubled. Mystra smiles on you, and she seldom bothers.'},
    {id:'atk-crit-again',on:'attack',pri:1,cooldown:60000,when:function(d,c){return d.crit&&c.seen('atk-crit')},text:['Another one! Show off.','Twice! I shall have to begin taking notes.']},
    {id:'atk-fumble',on:'attack',once:true,pri:2,when:function(d){return d.fumble},text:'Ah. A natural one. Never mind: it is simply a miss, whatever the tavern tales claim. A one never helps, but it never hurts you either.'},
    {id:'atk-kill-first',on:'attack',once:true,pri:2,when:function(d){return d.kill&&d.enemiesLeft>0},text:'One goblin fewer, and one more story for the tavern. Watch the other: it will not stand so politely.'},
    {id:'atk-kill',on:'attack',pri:1,when:function(d){return d.kill&&d.enemiesLeft>0},text:['Down it goes. Tidy work.','Very good. Very good indeed.','That goblin will not be bothering the road again.']},
    {id:'atk-miss-streak',on:'attack',pri:1,cooldown:40000,when:function(d){return !d.hit&&d.missStreak>=2},text:['Patience. The dice are fickle creatures, and they tire of cruelty eventually.','Twice in a row. Keep swinging; fortune likes persistence.']},
    {id:'atk-hit-streak',on:'attack',pri:1,cooldown:40000,when:function(d){return d.hit&&d.hitStreak>=3&&d.enemiesLeft>0},text:'You are in your stride, I see. Keep it up.'},
    {id:'atk-thrown',on:'attack',once:true,pri:1,when:function(d){return d.thrown},text:'Throwing your weapon? Bold. It lands near the target, so remember to walk over and pick it up afterwards.'},
    {id:'atk-ranged',on:'attack',once:true,pri:1,when:function(d){return d.ranged&&!d.thrown},text:'From a distance, then. Sensible. Remember a ranged attack is clumsier when an enemy stands right next to you.'},
    {id:'atk-hit',on:'attack',pri:0,chance:.4,when:function(d){return d.hit&&!d.kill},text:['That will leave a mark.','Hm. Painful, I should think.','Again, if you please.']},
    {id:'atk-miss',on:'attack',pri:0,chance:.4,when:function(d){return !d.hit},text:['Close. Not close enough.','The goblin lives, for now.','Shake it off.']},

    /* ---------- the goblins attack ---------- */
    {id:'enemy-hit-first',on:'enemy-attack',once:true,pri:2,when:function(d){return d.hit&&!d.crit},text:'Ouch. That is the price of standing in the open. Your Armor Class is what stands between you and such indignities, so keep an eye on it.'},
    {id:'enemy-miss-first',on:'enemy-attack',once:true,pri:2,when:function(d){return !d.hit},text:'Missed you! That is what Armor Class is for: it is the number an enemy must roll to hurt you.'},
    {id:'enemy-ranged',on:'enemy-attack',once:true,pri:1,when:function(d){return d.ranged},text:'Thrown from range! The little cowards. Close the distance, or step out of their sight.'},
    {id:'enemy-crit',on:'enemy-attack',once:true,pri:2,when:function(d){return d.crit},text:'A critical hit against you. Do not dwell on it. Breathe, steady, and take a look at your hit points.'},
    {id:'enemy-hit',on:'enemy-attack',pri:0,chance:.3,when:function(d){return d.hit},text:['Hm. That stung.','They have teeth, I will give them that.']},
    {id:'enemy-miss',on:'enemy-attack',pri:0,chance:.3,when:function(d){return !d.hit},text:['Ha! Too slow.','Armor earns its weight.']},

    /* ---------- hit points ---------- */
    {id:'hp-bloodied',on:'hp',once:true,pri:2,when:function(d){return d.bloodied&&!d.low},text:'You are Bloodied: below half your hit points. If you have a Second Wind left, now would be a fine moment to reach for it.'},
    {id:'hp-bloodied-no-wind',on:'hp',once:true,pri:2,when:function(d){return d.bloodied&&d.windLeft===0},text:'Bloodied, and no Second Wind left. Mind your steps and think about where the goblins can reach.'},
    {id:'hp-low',on:'hp',once:true,pri:2,when:function(d){return d.low},text:'Steady, now. One more good hit and we shall be having a rather different sort of conversation.'},

    /* ---------- Second Wind ---------- */
    {id:'wind-first',on:'second-wind',once:true,pri:2,when:function(d){return d.healed>0},text:'There. Second Wind is a Bonus Action, so you can still attack this turn. It comes back after a short rest.'},
    {id:'wind-wasted',on:'second-wind',once:true,pri:2,when:function(d){return !(d.healed>0)},text:'Hm. You were at full strength, so that mended nothing. You may keep it until you are hurt.'},

    /* ---------- the turn order ---------- */
    {id:'turn-enemy-first',on:'enemy-turn',once:true,pri:1,text:'Now it is their turn. Watch what they do: goblins are cunning. They strike, and slip away.'},
    {id:'turn-hero-second',on:'hero-turn',once:true,pri:1,when:function(d,c){return c.count('hero-turn')===2},text:'Your turn again. That ribbon at the top left shows who acts next. Everyone takes one turn per round, in initiative order.'},
    {id:'round-2',on:'round',once:true,pri:0,when:function(d){return d.n===2},text:'Round two. Rounds are six seconds long, you know. It is astonishing how much trouble fits into six seconds.'},
    {id:'round-4',on:'round',once:true,pri:0,when:function(d){return d.n===4},text:'Still at it? Good. A long fight is only a short fight that somebody is losing slowly.'},
    {id:'goblin-flee',on:'flee',once:true,pri:2,text:'They run! Cowards. Chase them if you like, but mind their friends. Not every retreat is a defeat for them.'},

    /* ---------- ending the turn ---------- */
    {id:'end-first',on:'endturn',once:true,pri:1,text:'And so the turn passes to the goblins. Anything you leave unspent is lost, so never end a turn with your Action still in your hand if there is a goblin in reach.'},
    {id:'end-unspent',on:'endturn',pri:1,cooldown:45000,when:function(d,c){return d.unspentAction&&c.count('endturn')>1},text:['You kept your Action in your pocket. It does not carry over, you know.','An unused Action is a wasted Action, my friend.']},

    /* ---------- Heroic Inspiration ---------- */
    {id:'insp-offer',on:'inspiration-offer',once:true,pri:3,text:'Heroic Inspiration! A gift of fortune: throw that d20 again, but you must keep the new roll, better or worse. Use it when a miss costs you dearly.'},
    {id:'insp-better',on:'inspiration-used',once:true,pri:2,when:function(d){return d.to>d.from},text:'Better! Fortune favours the bold, or at least the bold with Inspiration.'},
    {id:'insp-worse',on:'inspiration-used',once:true,pri:2,when:function(d){return d.to<=d.from},text:'Alas, no better. That is the nature of dice. They were never loyal to anybody.'},
    {id:'insp-kept',on:'inspiration-kept',once:true,pri:1,when:function(d){return d.hit},text:'Quite right. A hit is a hit; keep your Inspiration for a rainier day.'},

    /* ---------- loot ---------- */
    {id:'pickup',on:'pickup',once:true,pri:1,text:'A fine habit, collecting one\'s tools. A thrown dagger is no use to anyone in the grass.'},

    /* ---------- the hero falls ---------- */
    {id:'down',on:'hero-down',once:true,pri:3,text:'You fall! Do not despair. At zero hit points you make death saving throws: three successes and you live, three failures and you do not. Roll well.'},
    {id:'ds-success',on:'deathsave',pri:2,cooldown:8000,when:function(d){return d.outcome==='success'},text:['One success. Hold on.','Good. Keep breathing.']},
    {id:'ds-fail',on:'deathsave',pri:2,cooldown:8000,when:function(d){return d.outcome==='fail'||d.outcome==='fail2'},text:['A failure. Come, come, do not give up on me now.','Stay with me.']},
    {id:'ds-revive',on:'deathsave',pri:3,when:function(d){return d.outcome==='revive'},text:'A natural twenty! Back on your feet. You are a stubborn one.'},
    {id:'ds-stable',on:'deathsave',pri:3,when:function(d){return d.outcome==='stable'},text:'Stable. You will keep your life, if nothing else. Well done.'},

    /* ---------- waiting around ---------- */
    {id:'idle-1',on:'idle',pri:1,cooldown:1e9,when:function(d,c){return d.stage===1&&c.count('attack')===0},text:'Take your time. The goblins certainly will. Click a square to walk, or press 2 and click a goblin.'},
    {id:'idle-1b',on:'idle',pri:1,cooldown:30000,when:function(d,c){return d.stage===1&&c.count('attack')>0&&!d.spent},text:'Still thinking? Press 2 to ready your longsword, then click a goblin.'},
    {id:'idle-2',on:'idle',pri:1,cooldown:30000,when:function(d){return d.stage===2&&d.spent},text:'Nothing left to do? Press Space or the End Turn button, and let the goblins have their go.'},
    {id:'idle-3',on:'idle',pri:1,cooldown:30000,when:function(d){return d.stage>=2&&!d.spent},text:'The hotbar is along the bottom, and Space ends the turn. I can wait. I have had a great deal of practice.'},

    /* ---------- the end ---------- */
    {id:'win-clean',on:'victory',pri:3,when:function(d){return d.hpPct>=75},text:'Hardly a scratch! That is how it is done. The road is safe for another day, and I shall not need to cast anything at all.'},
    {id:'win-hurt',on:'victory',pri:3,when:function(d){return d.hpPct<75},text:'Bloody, but unbowed. The goblins are done, and so are the road\'s worries. Rest, and drink something warm.'},
    {id:'lose',on:'defeat',pri:3,text:'Ah. Well. That did not go as I hoped. Do not be discouraged; every hero falls at least once before they learn. Try again.'}
  ]
});
})();
