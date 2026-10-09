/* Test fixture: registers widgets, which refer to gizmos from the rules group. */
(function(){
var C=Fable.content;
if(!C.gizmos||!C.gizmos.has('spark'))throw new Error('rules group must load before items');
Fable._order.push('items:dummy-items');
C.widgets.register({id:'lamp',name:'Lamp',source:'original',gizmos:['spark']});
})();
