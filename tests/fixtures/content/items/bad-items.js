/* Test fixture: a widget with a broken cross reference. */
(function(){
Fable.content.widgets.register({id:'bad',name:'Bad',source:'original',gizmos:['spark','nope']});
})();
