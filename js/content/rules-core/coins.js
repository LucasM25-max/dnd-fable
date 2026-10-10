/* Coins (SRD 5.2.1, "Coins", p. 89). The values come from Fable.money, the one place that does the arithmetic,
   so this table and the money helpers can never disagree. valueCp is the worth of one coin in copper pieces. */
(function(){
var C=Fable.content;
C.defineKind('coins',{
  label:'Coin',
  required:['abbr','valueCp'],
  validate:function(def,fail){
    if(typeof def.abbr!=='string'||!/^[A-Z]{2}$/.test(def.abbr))fail('abbr must be two capital letters, for example "GP"');
    if(!Number.isInteger(def.valueCp)||def.valueCp<1)fail('valueCp must be a whole number of copper pieces');
  }
});
if(!Fable.money)throw new Error('rules-core/coins.js needs js/rules/money.js to be loaded first');
C.coins.registerAll(Fable.money.COINS.map(function(c){
  return {id:c.id,name:c.name,abbr:c.abbr,valueCp:c.cp,source:'srd52'};
}));
})();
