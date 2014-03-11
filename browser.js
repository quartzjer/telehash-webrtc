var rtc = require("webrtc-peer");

// initialize pch when needed
function init(chan, to) {
  var initiate = false;
  if(!chan)
  {
    chan = to.start("webrtc", {bare:true, js:{open:true}});
    initiate = true;
  }
  var pch = new rtc.peer({initiate:true, _self:"self", _peer:to.hashname});
  pch.DEBUG = true;
  
  // dummy return function to cache last packet until webrtc signalling is done
  var cached;
  var ret = {send:function(data){cached = data}};

  chan.wrap("TS"); // takes over channel callbacks, creates chan.socket
  chan.socket.onmessage = function(data) {
    console.log("RTC IN", data);
    try {
      data = JSON.parse(data.data)
    } catch (E) {
      return log("rtc parse error", E, data.data)
    }
    pch.signal(data);
  }

  pch.onsignal = function(signal) {
    console.log("RTC OUT", signal);
    chan.socket.send(JSON.stringify(signal));
  }

  pch.onconnection = function() {
    console.log("RTC CONNECTED");
    ret.send = function(data){
      pch.send(data.toString("base64"));
    }
    if(cached)
    {
      ret.send(cached);
      cached = false;
    }
  }

  pch.onmessage = function(data) {
    ret.receive(new Buffer(data, "base64"));
  }

  return ret;
}

exports.install = function(self)
{
  if(!rtc.hasWebRTC) return false;

  var sockets = {};
  self.deliver("webrtc", function(path, msg, to) {
    if(!sockets[path.id]){
      path.id = self.randomHEX(16); // we control the path ids
      sockets[path.id] = init(false,to);
      sockets[path.id].receive = function(msg){
        self.receive(msg,path);
      }
    }
    sockets[path.id].send(msg);
  });
  self.paths.webrtc = true;
  self.rels["webrtc"] = function(err, packet, chan, cb) {
    cb();
    chan.send({js:{open:true}});
    var path = {type:"webrtc",id:self.randomHEX(16)};
    sockets[path.id] = init(chan,packet.from);
    sockets[path.id].receive = function(msg){
      self.receive(msg,path);
    }
  }
}

