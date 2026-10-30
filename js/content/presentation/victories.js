/* Victory animations (implementation plan, section 17.5): data rows the director reads, so the Store can sell more of them later.
   Each names a clip per character, the effect and sound that go with it, and how the hero rises into it. */
(function(){
var C=Fable.content;
C.victoryAnimations.registerAll([
  {id:'raised-blade',name:'Raised Blade',description:'A short hop, then the blade held high. Every hero knows it.',source:'original',default:true,cost:null,
   clips:{'human-fighter':'fighter-victory'},effect:'fx-victory',sound:'sfx-surge',rise:{to:12,dur:1.9,at:.5,bob:.55}},
  {id:'victory-spin',name:'Victory Spin',description:'A leap, a full turn in the air and both arms thrown up to the crowd.',source:'original',cost:{gp:40},
   clips:{'human-fighter':'fighter-victory-spin'},effect:'fx-victory',sound:'sfx-surge',rise:{to:14,dur:2.2,at:.45,bob:.7}}
]);
})();
