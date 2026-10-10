/* Turns every tool in rules-core/tools.js into an item, so a tool can be carried, bought and sold like any other
   equipment and referred to as {item:'dice-set'} in an inventory. The tool data stays in one place: this file copies the
   id, name, cost and weight and points back with tool. Must come after the other item files in the manifest, and after the
   rules group has loaded the tools. */
(function(){
var C=Fable.content;
if(!C.tools)throw new Error('items/tool-items.js needs the tools from rules-core to be loaded first');
C.items.registerAll(C.tools.list().map(function(t){
  return {id:t.id,name:t.name,source:t.source,type:'tool',tool:t.id,cost:t.cost,weight:t.weight};
}));
})();
