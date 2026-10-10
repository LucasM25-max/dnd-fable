/* Money helpers. Pure: no DOM, no Three.js.
   All money is stored as a whole number of copper pieces (cp) so nothing ever hits floating point error.
   Costs in content are written as coin objects, for example {gp:15}, {sp:5} or {gp:1,sp:5}.
   Coin values follow the SRD 5.2.1 Coin Values table (100 cp = 1 gp). */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var M=Fable.money={};

var COINS=Object.freeze([
  Object.freeze({id:'cp',name:'Copper Piece',abbr:'CP',cp:1}),
  Object.freeze({id:'sp',name:'Silver Piece',abbr:'SP',cp:10}),
  Object.freeze({id:'ep',name:'Electrum Piece',abbr:'EP',cp:50}),
  Object.freeze({id:'gp',name:'Gold Piece',abbr:'GP',cp:100}),
  Object.freeze({id:'pp',name:'Platinum Piece',abbr:'PP',cp:1000})
]);
var VALUE={};
COINS.forEach(function(c){VALUE[c.id]=c.cp});

M.COINS=COINS;
M.COINS_PER_POUND=50; /* "fifty coins weigh a pound" */

function isCount(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n&&n>=0&&n<=Number.MAX_SAFE_INTEGER}
var hasOwn=Object.prototype.hasOwnProperty;

/* Returns null when the cost object is valid, otherwise the reason it is not. */
M.checkCost=function(cost){
  if(!cost||typeof cost!=='object'||Array.isArray(cost))return 'a cost must be an object of coins, for example {gp:15}';
  var keys=Object.keys(cost),total=0;
  if(!keys.length)return 'a cost needs at least one coin, for example {gp:15}';
  for(var i=0;i<keys.length;i++){
    var k=keys[i];
    if(!hasOwn.call(VALUE,k))return 'unknown coin "'+k+'" (allowed: '+COINS.map(function(c){return c.id}).join(', ')+')';
    if(!isCount(cost[k]))return 'coin "'+k+'" must be a whole number of 0 or more, got '+String(cost[k]);
    total+=cost[k]*VALUE[k];
  }
  if(!isCount(total))return 'the cost is too large';
  return null;
};
M.isCost=function(cost){return M.checkCost(cost)===null};

/* {gp:1,sp:5} -> 150. Throws on anything that is not a valid coin object. */
M.toCp=function(cost){
  var why=M.checkCost(cost);
  if(why)throw new Error('Money: '+why);
  var total=0;
  Object.keys(cost).forEach(function(k){total+=cost[k]*VALUE[k]});
  return total;
};

/* 150 -> {gp:1,sp:5,cp:0}. Uses gold, silver and copper only, which is how prices are shown. */
M.fromCp=function(cp){
  if(!isCount(cp))throw new Error('Money: copper must be a whole number of 0 or more, got '+String(cp));
  return {gp:Math.floor(cp/100),sp:Math.floor((cp%100)/10),cp:cp%10};
};

function withCommas(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',')}

/* 150 -> "1 gp 5 sp", 150000 -> "1,500 gp", 0 -> "0 gp". */
M.format=function(cp){
  var c=M.fromCp(cp),parts=[];
  if(c.gp)parts.push(withCommas(c.gp)+' gp');
  if(c.sp)parts.push(c.sp+' sp');
  if(c.cp)parts.push(c.cp+' cp');
  return parts.length?parts.join(' '):'0 gp';
};

/* Weight in pounds of a number of coins. */
M.coinWeight=function(count){
  if(!isCount(count))throw new Error('Money: a coin count must be a whole number of 0 or more, got '+String(count));
  return count/M.COINS_PER_POUND;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
