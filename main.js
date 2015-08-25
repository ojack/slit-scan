 var Peer = require('peerjs');
 var SlitScan= require('./js/SlitScan.js');
 var CombinedSlitScan= require('./js/CombinedSlitScan.js');
var FPS = 10;

var peer_api_key = '00gwj72654mfgvi';

var slit, peer, dataChannel, localStream, remoteStream, slit, id, host;
var communication = document.getElementById("communication");
  // Compatibility shim
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
     window.AudioContext = window.AudioContext||window.webkitAudioContext;
     
    // PeerJS object
 document.getElementById("go-create").addEventListener("click", function(){
    
    id = document.getElementById('create-name').value;
    host = true;
    console.log(id, host);
    initLocalStream();
    
});

 document.getElementById("go-join").addEventListener("click", function(){
    id = document.getElementById('join-name').value;
    host = false;
     console.log(id, host);
    initLocalStream();
});
  function hideLanding(){
    var element = document.getElementById("landing");
element.parentNode.removeChild(element);
document.onkeydown = checkKey;
   // alert("hey");
  }
  //  initLocalStream();
    function initLocalStream(){
      communication.innerHTML = "Click 'allow' to share webcam";
       navigator.getUserMedia({audio: true, video: true}, function(stream){
          localStream = stream;
          
        //  $('#my-video').prop('src', URL.createObjectURL(stream));
             if(host) {
              initHost(stream);
          } else {
             initParticipant(stream);
          }
        }, function(err){
          console.log(err);
        });
    
    }
function initHost(stream){
    peer = new Peer(id, {key: peer_api_key, debug: 3});
                console.log(peer);
           communication.innerHTML = "Created session '"+ id + "'. Waiting for someone else to join";
                /*Data channel for sending extra info*/
                peer.on('connection', function(conn){
                   dataChannel = conn;
                   // initDataEvents();
                    dataChannel.on('data', function(data) {
                     // console.log("received "+ data);
                      if(slit!=null){
                        slit.addData(data);
                      }
                        
                });
                    
              });
                peer.on('call', function(call){
                  console.log("got call");
                // Answer the call automatically (instead of prompting user) for demo purposes
                    call.answer(localStream);
                    initVideoEvents(call, stream);
                     
      
              });
                 peer.on('error', function(error){
                      communication.innerHTML = error;
                      alert(error);
              });
}

function initParticipant(stream){
   peer = new Peer({key: peer_api_key, debug: 3});
              dataChannel = peer.connect(id);
              dataChannel.on('open', function(){
                 dataChannel.send('hi!');
                  dataChannel.on('data', function(data) {
                     // console.log("received "+ data);
                      if(slit!=null){
                        slit.addData(data);
                      }
                        
                });
              });
              
              var call = peer.call(id, localStream);
              initVideoEvents(call, stream);
              initDataEvents();
                peer.on('error', function(error){
                      communication.innerHTML = error;
                      alert(error);
              });
                

}

function initVideoEvents(call, stream){
   call.on('stream', function(theirStream){
                      //$('#their-video').prop('src', URL.createObjectURL(theirStream));
    
                      slit = new CombinedSlitScan(stream, theirStream);
                      hideLanding();
                      

                      addFrame();
                 });
}

function initDataEvents(){
 

}

function addFrame(){
  // console.log("adding remote");
   setTimeout(function() {
      addFrame();
       //console.log(dataChannel);
       var vol = slit.getVolume();
     //  console.log("sending "+ vol);
       dataChannel.send(slit.getVolume());
         slit.addFrame();
        // Drawing code goes here
    }, 1000/FPS);
}

function toggleMute(){
  var m = document.getElementById("remote-stream").muted;
  document.getElementById("remote-stream").muted = m==true ? false: true;
  console.log("muted " + document.getElementById("remote-stream").muted);
}

function toggleVideo(){
  var v = document.getElementById("vid-container").style.visibility;
  v = v=="hidden" ? "visible": "hidden";
  document.getElementById("vid-container").style.visibility = v;
}
function checkKey(e){
  e = e || window.event;
  
  console.log(e);
  if(slit!=null){
    e.preventDefault();
    //arrow keys change step size
    if(e.keyCode==38){
      slit.increaseStep();
    } else if(e.keyCode==40){
      slit.decreaseStep();
    } else if(e.keyCode==83){
       if(FPS>0.1){
        if(FPS<=1){
          FPS-=0.1;
        } else {
          FPS--;
        }
      }
      console.log(FPS);
    } else if(e.keyCode==70){ 
      FPS++;
      console.log(FPS);
    } else if(e.keyCode==77){
      //m to change mode
      slit.changeMode();
    } else if(e.keyCode==73){
      //show or hide instructions
    } else if(e.keyCode==8){
      slit.restart();
      //show or hide instructions
     } else if(e.keyCode==65){
     toggleMute();
      //a for toggle mute
    } else if(e.keyCode==86){
      toggleVideo();
    }

  }
}
