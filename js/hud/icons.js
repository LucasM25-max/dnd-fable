/* HUD icons: small solid glyphs on a 24 by 24 grid, drawn with currentColor so a plate can tint them (implementation plan,
   section 13.2). Fable.hudIcons.svg(name, cls) returns an <svg> string; an unknown name draws a plain diamond. */
(function(){
var P={
  sword:'<path d="M20.500 2.500l1 1-.5 3.500L11 17.500 8.500 15 17 5.500z"/><path d="M5.500 12.500 11.500 18.500 10 20 4 14z"/><path d="M7 17l-3.500 3.500L2 19l3.500-3.500z"/>',
  dagger:'<path d="M19 3l2 2-1 3-8 8-3-3 8-8z"/><path d="M6.500 13.500 10.500 17.500 9 19 5 15z"/><path d="M6 17.500 3.500 20 2.500 19 5 16.500z"/>',
  javelin:'<path d="M3.500 20.500 16 8" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="square"/><path d="M15 3l6-.5.500 6-2.500-1.500-4-.5z"/>',
  'throw-dagger':'<path d="M20 4l1.500 1.500-1 2.500-6.500 6.500-2.500-2.500L18 5z"/><path d="M10.500 12.500 13.500 15.500 12.500 16.500 9.500 13.500z"/><path d="M2 9h6M1 13h5M3 17h5" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="square"/>',
  'throw-javelin':'<path d="M9 19 19 9" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="square"/><path d="M17.500 4.500l4-.5.500 4-2-1.200-2.500-.5z"/><path d="M2 10h5M1 14h4M3 18h4" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="square"/>',
  fist:'<path d="M6 10V6.500a1.600 1.600 0 0 1 3.200 0V6a1.600 1.600 0 0 1 3.200 0v.5a1.600 1.600 0 0 1 3.200 0V8a1.600 1.600 0 0 1 3.200 0v5.500c0 4-2.600 7.500-7 7.500-3.400 0-6-2-6-5.500V12z"/>',
  heart:'<path d="M12 21C5 15.500 2.500 12 2.500 8.500A5 5 0 0 1 12 6.500 5 5 0 0 1 21.500 8.500C21.500 12 19 15.500 12 21z"/><path d="M11 8.500h2v2.500h2.500v2H13v2.500h-2V13H8.500v-2H11z" fill="#000" opacity=".45"/>',
  boots:'<path d="M5 3h7v8.500l7 2.500c1.500.5 2 1.500 2 3V20H4V3z"/><path d="M4 17h17" stroke="#000" stroke-opacity=".4" stroke-width="1.500"/>',
  step:'<path d="M3 12h13M11 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="square"/><path d="M20 5v14" stroke="currentColor" stroke-width="2.600" stroke-dasharray="2.500 2"/>',
  guard:'<path d="M12 2.500 20.500 5.500V12c0 4.500-3.500 8.200-8.500 9.500C7 20.200 3.500 16.500 3.500 12V5.500z"/><path d="M12 6v12" stroke="#000" stroke-opacity=".4" stroke-width="1.600"/>',
  swap:'<path d="M4 8h13l-3.500-3.500L15 3l6.500 6.500L15 16l-1.500-1.500L17 11H4zM20 16H7l3.500 3.500L9 21l-6.500-6.500L9 8l1.500 1.500L7 13h13z"/>',
  star:'<path d="M12 2l2.900 6.600 7.100.7-5.300 4.800 1.500 7L12 17.500 5.800 21l1.500-7L2 9.300l7.100-.7z"/>',
  d20:'<path d="M12 1.500 21.500 7v10L12 22.500 2.500 17V7z"/><path d="M12 6 17.500 16h-11z" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.400"/>',
  skull:'<path d="M12 2.500c-4.500 0-8 3-8 7.500 0 2.500 1 4 2.500 5V19h3v-2h1v2h3v-2h1v2h3v-4c1.500-1 2.500-2.500 2.500-5 0-4.500-3.500-7.500-8-7.500z"/><circle cx="8.700" cy="10.500" r="1.900" fill="#000"/><circle cx="15.300" cy="10.500" r="1.900" fill="#000"/>',
  book:'<path d="M4 3.500h12.500A3.500 3.500 0 0 1 20 7v13.500H7.500A3.500 3.500 0 0 1 4 17z"/><path d="M8 7.500h8M8 11h8" stroke="#000" stroke-opacity=".45" stroke-width="1.600"/>',
  scroll:'<path d="M6 3h12a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6H3V5a2 2 0 0 1 2-2z"/><path d="M9 8h8M9 12h8M9 16h5" stroke="#000" stroke-opacity=".45" stroke-width="1.600"/>',
  gear:'<path d="M10 2h4l.6 2.600 2 .9 2.300-1.400 2.800 2.800-1.400 2.300.9 2 2.600.6v4l-2.600.6-.9 2 1.400 2.300-2.800 2.800-2.300-1.400-2 .9L14 22h-4l-.6-2.600-2-.9-2.300 1.400-2.800-2.800 1.400-2.300-.9-2L2 12.200v-4l2.600-.6.9-2L4.100 3.300 6.900.5 9.200 1.900z" transform="translate(0 1) scale(.96)"/><circle cx="12" cy="12" r="3.200" fill="#000" opacity=".55"/>',
  menu:'<path d="M3 5h18v3H3zm0 5.500h18v3H3zM3 16h18v3H3z"/>',
  help:'<path d="M12 2.500a9.500 9.500 0 1 0 0 19 9.500 9.500 0 0 0 0-19zm-1 14v-2h2v2zm3.500-6.800c-.5 1.700-2 1.800-2.500 3.300h-2c.1-2.200 1.500-2.800 2.300-3.700.5-.6.300-1.800-.9-1.800-.9 0-1.400.6-1.600 1.400l-1.900-.5c.4-1.800 1.800-2.900 3.600-2.900 2.700 0 3.800 2.100 3 4.200z"/>',
  close:'<path d="M5 3.500 12 10.500 19 3.500 20.500 5 13.500 12 20.500 19 19 20.500 12 13.500 5 20.500 3.500 19 10.500 12 3.500 5z"/>',
  hide:'<path d="M12 3c-4 0-7 3-7 7v8l2.500-2 2 2 2.500-2 2.500 2 2-2 2.500 2v-8c0-4-3-7-6-7z"/><path d="M8 10.500h2M14 10.500h2" stroke="#000" stroke-opacity=".6" stroke-width="2" stroke-linecap="square"/>',
  search:'<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.600"/><path d="M14.500 14.500 21 21" stroke="currentColor" stroke-width="3" stroke-linecap="square"/>',
  pickup:'<path d="M12 3v11M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="square"/><path d="M4 19h16v2H4z"/>',
  move:'<path d="M12 2l4 4h-3v5h5V8l4 4-4 4v-3h-5v5h3l-4 4-4-4h3v-5H6v3l-4-4 4-4v3h5V6H8z"/>',
  pin:'<path d="M9 2h6l-1 6 3 3v2h-4v7l-1 2-1-2v-7H7v-2l3-3z"/>',
  chevron:'<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.800" stroke-linecap="square"/>',
  check:'<path d="M3.500 12.500 9 18 20.500 6.500 19 5 9 15 5 11z"/>'
};
Fable.hudIcons={
  names:Object.keys(P),
  svg:function(name,cls){
    var body=P[name]||'<path d="M12 3 21 12 12 21 3 12z"/>';
    return '<svg class="ico'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">'+body+'</svg>';
  }
};
})();
