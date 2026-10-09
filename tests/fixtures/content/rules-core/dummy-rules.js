/* Test fixture: defines three dummy kinds, one per group that registers them. */
(function(){
var C=Fable.content;
Fable._order=(Fable._order||[]).concat('rules:dummy-rules');
C.defineKind('gizmos',{label:'Gizmo',required:['power']});
C.defineKind('widgets',{label:'Widget',refs:[{path:'gizmos.*',kind:'gizmos'}]});
C.defineKind('critters',{label:'Critter',refs:[{path:'widgets.*',kind:'widgets'}]});
C.gizmos.register({id:'spark',name:'Spark',source:'original',power:1});
})();
