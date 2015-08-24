 var Peer = require('peerjs');
 var SlitScan= require('./js/SlitScan.js');
 var CombinedSlitScan= require('./js/CombinedSlitScan.js');

var peer_api_key = '00gwj72654mfgvi';
console.log("id is "+ id + " host "+ host)
var slit, peer, call, localStream, remoteStream, slit;
  // Compatibility shim
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    // PeerJS object
 
   

    // peer.on('open', function(){
    //   $('#my-id').text(peer.id);
    // });
    initLocalStream();
    function initLocalStream(){
       navigator.getUserMedia({audio: false, video: true}, function(stream){
          localStream = stream;
          document.getElementById("local-stream").src = URL.createObjectURL(stream);
        //  $('#my-video').prop('src', URL.createObjectURL(stream));
             if(host) {
                peer = new Peer(id, {key: peer_api_key, debug: 3});
                console.log(peer);
                peer.on('call', function(call){
                  console.log("got call");
                // Answer the call automatically (instead of prompting user) for demo purposes
                    call.answer(localStream);
                     call.on('stream', function(theirStream){
                       document.getElementById("remote-stream").src = URL.createObjectURL(theirStream);
                     // $('#their-video').prop('src', URL.createObjectURL(theirStream));
                       slit = new CombinedSlitScan(document.getElementById("local-stream"), document.getElementById("remote-stream"));
                       addFrame();
                 });
      
              });
          } else {
              peer = new Peer({key: peer_api_key, debug: 3});
              call = peer.call(id, localStream);
                call.on('stream', function(theirStream){
                      //$('#their-video').prop('src', URL.createObjectURL(theirStream));
                       document.getElementById("remote-stream").src = URL.createObjectURL(theirStream);
                      slit = new CombinedSlitScan(document.getElementById("local-stream"), document.getElementById("remote-stream"));
                      addFrame();
                 });
          }
        }, function(err){
          console.log(err);
        });
    
    }

function addFrame(){
  // console.log("adding remote");
   setTimeout(function() {
        requestAnimationFrame(addFrame);
         slit.addFrame();
        // Drawing code goes here
    }, 60);
}
