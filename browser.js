var rtc = require("webrtc-peer");

exports.name = 'webrtc';

exports.mesh = function(mesh, cbExt)
{
  if(!rtc.hasWebRTC) return cbExt();

  var args = mesh.args||{};
  var telehash = mesh.lib;

  var tp = {open:{}};

  // static path
  tp.paths = function(){
    return [{type:"webrtc"}];
  }

  // create/init/return the rtc and pipe
  function rtcPipe(link, initiate)
  {
    // existing noop
    if(link.rtcPipe) return link.rtcPipe;

    // outgoing signal cache and sender
    var signals = [];
    function signal(sig){
      if(signals.indexOf(sig) == -1) signals.push(sig);
      if(!link.x) return;
      // send each signal as an individual lossy channel
      var json = {type:'webrtc',c:link.x.cid()};
      json.signal = sig;
      log.debug('sending signal to',link.hashname,json);
      link.x.send({json:json});
    }

    // new pipe
    var pipe = link.rtcPipe = new telehash.Pipe('webrtc');
    pipe.cloaked = true;
    pipe.id = link.hashname;
    pipe.path = {type:'webrtc'};
    
    // handle outgoing packets based on rtc state
    pipe.onSend = function(packet, link, cb){
      if(!packet) return cb('no packet');
      var safe = packet.toString('base64')
      if(link.rtc.connected)
      {
        link.rtc.send(safe);
        return cb();
      }
      // cache most recent packet
      link.rtc.cached = safe;
      if(!link.up) return cb('not connected');
      // if there's signals yet, resend them as they could have been lost
      signals.forEach(signal);
    }

    // new webrtc connection
    link.rtc = new rtc.peer({initiate:initiate, _self:'self', _peer:link.hashname});
    link.rtc.DEBUG = true;
    link.rtc.onsignal = signal;
    link.rtc.onconnection = function() {
      console.log('RTC CONNECTED');
      link.rtc.connected = true;
      if(link.rtc.cached) link.rtc.send(chan.cached);
      link.rtc.cached = false;
      signals = []; // empty any cached signals too
    }
    link.rtc.onmessage = function(safe) {
      var packet = lob.decloak(new Buffer(safe,'base64'));
      if(!packet) return mesh.log.info('dropping invalid packet',safe);
      mesh.receive(packet,pipe);
    }
    
    return pipe;
  }
  
  // turn a path into a pipe (on a link)
  tp.pipe = function(link, path, cbPipe){
    if(typeof path != 'object' || path.type != 'webrtc') return false;
    // initiate if needed
    cbPipe(rtcPipe(link,true));
  }

  // handle individual incoming webrtc signals
  tp.open.webrtc = function(args, open, cbOpen){
    var link = this;
    // create if needed
    rtcPipe(link,false);
    if(open.signal) link.rtc.signal(open.signal);
  }

  return cbExt(tp);

}

