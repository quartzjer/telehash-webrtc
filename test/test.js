// all this really tests is syntax at the moment
// TODO, figure out how to use the background browser testing stuff based on other webrtc modules?
var c = require("../browser.js");
c.mesh({},function(ext){
  console.log("EXT",ext);
  console.log(ext.paths());
});
