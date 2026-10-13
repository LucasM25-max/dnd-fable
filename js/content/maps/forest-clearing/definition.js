/* Forest clearing map definition. */
(function(){
var FC=Fable.forestClearing;
Fable.content.maps.register({
  id:'forest-clearing',
  name:'Forest Clearing',
  environments:['forest','grassland'],
  bounds:FC.BOUNDS,
  seed:20261007,
  sky:0xa7c7e0,
  fog:{near:260,far:900},
  groundColor:0x4d7740,
  playerSpawn:FC.PLAYER_SPAWN,
  enemySpawns:FC.ENEMY_SPAWNS,
  isReserved:FC.isReserved,
  build:function(ctx){
    FC.buildTerrain(ctx);FC.buildFlora(ctx);FC.buildOutpost(ctx);FC.buildLandmarks(ctx);FC.buildProps(ctx);
  }
});
})();
