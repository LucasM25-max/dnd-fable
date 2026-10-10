/* Content manifest: adding content means adding one ID here, not editing engine or UI code.
   rules, items and feats list script names (js/content/<dir>/<name>.js); every other group lists package ids.
   Groups load in the order set in content-groups.js. Unknown group names are an error. */
window.Fable=window.Fable||{};
Fable.content=Fable.content||{};
Fable.content.manifest={
  rules:['abilities','skills','damage-types','conditions','weapon-properties','weapon-mastery','languages','coins','weapon-categories','armor-categories','progression','tools'],
  items:['item-kind','weapons','armor','gear','packs','tool-items'],
  feats:[],
  species:[],
  backgrounds:[],
  classes:[],
  maps:['forest-clearing'],
  monsters:['goblin-minion'],
  characters:['human-fighter'],
  encounters:['tutorial-goblin-ambush']
};
