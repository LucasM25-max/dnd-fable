/* The content groups, in load order. Pure data plus a path helper, shared by the browser loader and the Node tests.
   mode 'file':    manifest entries are script names, loaded from <dir>/<name>.js (table style content: rules, items, feats)
   mode 'package': manifest entries are ids, loaded from <dir>/<id>/index.js, which exposes a promise in Fable.content._packages */
window.Fable=window.Fable||{};
(function(){
var C=Fable.content=Fable.content||{};
var order=[
  {key:'rules',dir:'rules-core',mode:'file'},
  {key:'items',dir:'items',mode:'file'},
  {key:'feats',dir:'feats',mode:'file'},
  {key:'species',dir:'species',mode:'package'},
  {key:'backgrounds',dir:'backgrounds',mode:'package'},
  {key:'classes',dir:'classes',mode:'package'},
  {key:'maps',dir:'maps',mode:'package'},
  {key:'monsters',dir:'monsters',mode:'package'},
  {key:'characters',dir:'characters',mode:'package'},
  {key:'encounters',dir:'encounters',mode:'package'}
];
C.groups={
  order:order,
  get:function(key){for(var i=0;i<order.length;i++)if(order[i].key===key)return order[i];return null},
  path:function(group,id){return group.dir+'/'+id+(group.mode==='package'?'/index.js':'.js')},
  packageKey:function(group,id){return group.key+':'+id}
};
})();
