/* The twelve standard actions (SRD 5.2.1, "Actions", pp. 14-15), defined once so every character, and later every
   monster, offers them and the combat HUD can list them uniformly (implementation plan, section 8).
   cost is the action economy slot they use, always the Action here; Nimble Escape style features reuse Disengage and Hide
   as Bonus Actions through their own feature data. targeting is what the HUD asks the player to pick (none, self,
   creature, point). handler is the dormant id of the code that carries the action out (Phase 5 and 6).
   Descriptions are paraphrased summaries of the SRD rules, not the book text. */
(function(){
var C=Fable.content;
var COSTS=['action','bonus','reaction','free'];
var TARGETING=['none','self','creature','point'];
C.defineKind('standardActions',{
  label:'Standard action',
  required:['cost','targeting','description','handler'],
  validate:function(def,fail){
    if(COSTS.indexOf(def.cost)<0)fail('cost must be one of '+COSTS.join(', '));
    if(TARGETING.indexOf(def.targeting)<0)fail('targeting must be one of '+TARGETING.join(', '));
    if(typeof def.description!=='string'||!def.description)fail('description must be text');
    if(def.handler!=='action.'+def.id)fail('handler must be "action.'+def.id+'"');
  }
});
function A(id,name,targeting,description){return {id:id,name:name,source:'srd52',cost:'action',targeting:targeting,handler:'action.'+id,description:description}}
C.standardActions.registerAll([
  A('attack','Attack','creature',"Make one attack roll with a weapon or an Unarmed Strike. Some features, such as Extra Attack, let one Attack action include more attacks."),
  A('dash','Dash','self',"Gain extra movement for the turn equal to your Speed after modifiers."),
  A('disengage','Disengage','self',"Your movement does not provoke Opportunity Attacks for the rest of the turn."),
  A('dodge','Dodge','self',"Until the start of your next turn, attack rolls against you have Disadvantage if you can see the attacker, and you make Dexterity saving throws with Advantage. You lose this if you are Incapacitated or your Speed is 0."),
  A('help','Help','creature',"Aid an ally's next ability check, or an ally's next attack roll against a creature within 5 feet of you."),
  A('hide','Hide','self',"Make a DC 15 Dexterity (Stealth) check while Heavily Obscured or behind sufficient cover and out of every enemy's sight. On a success you have the Invisible condition until you make noise, an enemy finds you, or you attack."),
  A('influence','Influence','creature',"Make a Charisma (Deception, Intimidation, Performance or Persuasion) or Wisdom (Animal Handling) check to sway a creature's attitude."),
  A('magic','Magic','none',"Cast a spell, use a magic item, or use a magical feature."),
  A('ready','Ready','none',"Choose a trigger and an action to take in response to it, using your Reaction when the trigger happens."),
  A('search','Search','none',"Make a Wisdom (Insight, Medicine, Perception or Survival) check to find something."),
  A('study','Study','none',"Make an Intelligence (Arcana, History, Investigation, Nature or Religion) check to recall or work out information."),
  A('utilize','Utilize','none',"Use a nonmagical object that needs an action, such as donning or doffing a Shield.")
]);
})();
