(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var WIDTH = 1000;
var HEIGHT = 500;
var STEP = 1;
var VID_STEP = 1;

var SlitScan = function(video){
	this.outIndex= 0;
	this.vidIndex = 0;
	this.video = video;
	var canvas = document.createElement('canvas');
	this.context = canvas.getContext('2d');
	canvas.height = 500;
	canvas.width = WIDTH;
	document.body.insertBefore(canvas, document.body.firstChild);
	console.log("created slit scan");
}

SlitScan.prototype.addFrame = function(){
	//console.log(this.video);
	//console.log(this.context);
	 this.context.drawImage(this.video, this.vidIndex, 0, STEP, HEIGHT, this.outIndex, 0, STEP, HEIGHT);
	 this.context.beginPath();
      this.context.moveTo(100, 150);
      this.context.lineTo(450, 50);
      this.context.stroke();
      this.outIndex += STEP;
      this.vidIndex += VID_STEP;
    //  console.log("vid index " + this.vidIndex + " out index " + this.outIndex);
};

module.exports = SlitScan;

},{}],2:[function(require,module,exports){
 var Peer = require('peerjs');
 var SlitScan= require('./js/SlitScan.js');

var slit;
  // Compatibility shim
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    // PeerJS object
    var peer = new Peer({ key: '00gwj72654mfgvi', debug: 3});

    peer.on('open', function(){
      $('#my-id').text(peer.id);
    });

    // Receiving a call
    peer.on('call', function(call){
      // Answer the call automatically (instead of prompting user) for demo purposes
      call.answer(window.localStream);
      step3(call);
    });
    peer.on('error', function(err){
      alert(err.message);
      // Return to step 2 if error occurs
      step2();
    });

    // Click handlers setup
    $(function(){
      $('#make-call').click(function(){
        // Initiate a call!
        var call = peer.call($('#callto-id').val(), window.localStream);

        step3(call);
      });

      $('#end-call').click(function(){
        window.existingCall.close();
        step2();
      });

      // Retry if getUserMedia fails
      $('#step1-retry').click(function(){
        $('#step1-error').hide();
        step1();
      });

      // Get things started
      step1();
    });

    function step1 () {
      // Get audio/video stream
      navigator.getUserMedia({audio: false, video: true}, function(stream){
        // Set your video displays
        $('#my-video').prop('src', URL.createObjectURL(stream));
     
         slit = new SlitScan(document.getElementById('my-video'));
        window.localStream = stream;
        step2();
        render();
      }, function(){ $('#step1-error').show(); });
    }

    function render(){
     
      
        setTimeout(function() {
        requestAnimationFrame(render);
         slit.addFrame();
        // Drawing code goes here
    }, 10);
    }

    function step2 () {
      $('#step1, #step3').hide();
      $('#step2').show();
    }

    function step3 (call) {
      // Hang up on an existing call if present
      if (window.existingCall) {
        window.existingCall.close();
      }

      // Wait for stream on the call, then set peer video display
      call.on('stream', function(stream){
        $('#their-video').prop('src', URL.createObjectURL(stream));
      

      });

      // UI stuff
      window.existingCall = call;
      $('#their-id').text(call.peer);
      call.on('close', step2);
      $('#step1, #step2').hide();
      $('#step3').show();

      //  var slit = new SlitScan();
    }

},{"./js/SlitScan.js":1,"peerjs":7}],3:[function(require,module,exports){
module.exports.RTCSessionDescription = window.RTCSessionDescription ||
	window.mozRTCSessionDescription;
module.exports.RTCPeerConnection = window.RTCPeerConnection ||
	window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
module.exports.RTCIceCandidate = window.RTCIceCandidate ||
	window.mozRTCIceCandidate;

},{}],4:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');
var Negotiator = require('./negotiator');
var Reliable = require('reliable');

/**
 * Wraps a DataChannel between two Peers.
 */
function DataConnection(peer, provider, options) {
  if (!(this instanceof DataConnection)) return new DataConnection(peer, provider, options);
  EventEmitter.call(this);

  this.options = util.extend({
    serialization: 'binary',
    reliable: false
  }, options);

  // Connection is not open yet.
  this.open = false;
  this.type = 'data';
  this.peer = peer;
  this.provider = provider;

  this.id = this.options.connectionId || DataConnection._idPrefix + util.randomToken();

  this.label = this.options.label || this.id;
  this.metadata = this.options.metadata;
  this.serialization = this.options.serialization;
  this.reliable = this.options.reliable;

  // Data channel buffering.
  this._buffer = [];
  this._buffering = false;
  this.bufferSize = 0;

  // For storing large data.
  this._chunkedData = {};

  if (this.options._payload) {
    this._peerBrowser = this.options._payload.browser;
  }

  Negotiator.startConnection(
    this,
    this.options._payload || {
      originator: true
    }
  );
}

util.inherits(DataConnection, EventEmitter);

DataConnection._idPrefix = 'dc_';

/** Called by the Negotiator when the DataChannel is ready. */
DataConnection.prototype.initialize = function(dc) {
  this._dc = this.dataChannel = dc;
  this._configureDataChannel();
}

DataConnection.prototype._configureDataChannel = function() {
  var self = this;
  if (util.supports.sctp) {
    this._dc.binaryType = 'arraybuffer';
  }
  this._dc.onopen = function() {
    util.log('Data channel connection success');
    self.open = true;
    self.emit('open');
  }

  // Use the Reliable shim for non Firefox browsers
  if (!util.supports.sctp && this.reliable) {
    this._reliable = new Reliable(this._dc, util.debug);
  }

  if (this._reliable) {
    this._reliable.onmessage = function(msg) {
      self.emit('data', msg);
    };
  } else {
    this._dc.onmessage = function(e) {
      self._handleDataMessage(e);
    };
  }
  this._dc.onclose = function(e) {
    util.log('DataChannel closed for:', self.peer);
    self.close();
  };
}

// Handles a DataChannel message.
DataConnection.prototype._handleDataMessage = function(e) {
  var self = this;
  var data = e.data;
  var datatype = data.constructor;
  if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
    if (datatype === Blob) {
      // Datatype should never be blob
      util.blobToArrayBuffer(data, function(ab) {
        data = util.unpack(ab);
        self.emit('data', data);
      });
      return;
    } else if (datatype === ArrayBuffer) {
      data = util.unpack(data);
    } else if (datatype === String) {
      // String fallback for binary data for browsers that don't support binary yet
      var ab = util.binaryStringToArrayBuffer(data);
      data = util.unpack(ab);
    }
  } else if (this.serialization === 'json') {
    data = JSON.parse(data);
  }

  // Check if we've chunked--if so, piece things back together.
  // We're guaranteed that this isn't 0.
  if (data.__peerData) {
    var id = data.__peerData;
    var chunkInfo = this._chunkedData[id] || {data: [], count: 0, total: data.total};

    chunkInfo.data[data.n] = data.data;
    chunkInfo.count += 1;

    if (chunkInfo.total === chunkInfo.count) {
      // Clean up before making the recursive call to `_handleDataMessage`.
      delete this._chunkedData[id];

      // We've received all the chunks--time to construct the complete data.
      data = new Blob(chunkInfo.data);
      this._handleDataMessage({data: data});
    }

    this._chunkedData[id] = chunkInfo;
    return;
  }

  this.emit('data', data);
}

/**
 * Exposed functionality for users.
 */

/** Allows user to close connection. */
DataConnection.prototype.close = function() {
  if (!this.open) {
    return;
  }
  this.open = false;
  Negotiator.cleanup(this);
  this.emit('close');
}

/** Allows user to send data. */
DataConnection.prototype.send = function(data, chunked) {
  if (!this.open) {
    this.emit('error', new Error('Connection is not open. You should listen for the `open` event before sending messages.'));
    return;
  }
  if (this._reliable) {
    // Note: reliable shim sending will make it so that you cannot customize
    // serialization.
    this._reliable.send(data);
    return;
  }
  var self = this;
  if (this.serialization === 'json') {
    this._bufferedSend(JSON.stringify(data));
  } else if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
    var blob = util.pack(data);

    // For Chrome-Firefox interoperability, we need to make Firefox "chunk"
    // the data it sends out.
    var needsChunking = util.chunkedBrowsers[this._peerBrowser] || util.chunkedBrowsers[util.browser];
    if (needsChunking && !chunked && blob.size > util.chunkedMTU) {
      this._sendChunks(blob);
      return;
    }

    // DataChannel currently only supports strings.
    if (!util.supports.sctp) {
      util.blobToBinaryString(blob, function(str) {
        self._bufferedSend(str);
      });
    } else if (!util.supports.binaryBlob) {
      // We only do this if we really need to (e.g. blobs are not supported),
      // because this conversion is costly.
      util.blobToArrayBuffer(blob, function(ab) {
        self._bufferedSend(ab);
      });
    } else {
      this._bufferedSend(blob);
    }
  } else {
    this._bufferedSend(data);
  }
}

DataConnection.prototype._bufferedSend = function(msg) {
  if (this._buffering || !this._trySend(msg)) {
    this._buffer.push(msg);
    this.bufferSize = this._buffer.length;
  }
}

// Returns true if the send succeeds.
DataConnection.prototype._trySend = function(msg) {
  try {
    this._dc.send(msg);
  } catch (e) {
    this._buffering = true;

    var self = this;
    setTimeout(function() {
      // Try again.
      self._buffering = false;
      self._tryBuffer();
    }, 100);
    return false;
  }
  return true;
}

// Try to send the first message in the buffer.
DataConnection.prototype._tryBuffer = function() {
  if (this._buffer.length === 0) {
    return;
  }

  var msg = this._buffer[0];

  if (this._trySend(msg)) {
    this._buffer.shift();
    this.bufferSize = this._buffer.length;
    this._tryBuffer();
  }
}

DataConnection.prototype._sendChunks = function(blob) {
  var blobs = util.chunk(blob);
  for (var i = 0, ii = blobs.length; i < ii; i += 1) {
    var blob = blobs[i];
    this.send(blob, true);
  }
}

DataConnection.prototype.handleMessage = function(message) {
  var payload = message.payload;

  switch (message.type) {
    case 'ANSWER':
      this._peerBrowser = payload.browser;

      // Forward to negotiator
      Negotiator.handleSDP(message.type, this, payload.sdp);
      break;
    case 'CANDIDATE':
      Negotiator.handleCandidate(this, payload.candidate);
      break;
    default:
      util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
      break;
  }
}

module.exports = DataConnection;

},{"./negotiator":6,"./util":9,"eventemitter3":10,"reliable":13}],5:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');
var Negotiator = require('./negotiator');

/**
 * Wraps the streaming interface between two Peers.
 */
function MediaConnection(peer, provider, options) {
  if (!(this instanceof MediaConnection)) return new MediaConnection(peer, provider, options);
  EventEmitter.call(this);

  this.options = util.extend({}, options);

  this.open = false;
  this.type = 'media';
  this.peer = peer;
  this.provider = provider;
  this.metadata = this.options.metadata;
  this.localStream = this.options._stream;

  this.id = this.options.connectionId || MediaConnection._idPrefix + util.randomToken();
  if (this.localStream) {
    Negotiator.startConnection(
      this,
      {_stream: this.localStream, originator: true}
    );
  }
};

util.inherits(MediaConnection, EventEmitter);

MediaConnection._idPrefix = 'mc_';

MediaConnection.prototype.addStream = function(remoteStream) {
  util.log('Receiving stream', remoteStream);

  this.remoteStream = remoteStream;
  this.emit('stream', remoteStream); // Should we call this `open`?

};

MediaConnection.prototype.handleMessage = function(message) {
  var payload = message.payload;

  switch (message.type) {
    case 'ANSWER':
      // Forward to negotiator
      Negotiator.handleSDP(message.type, this, payload.sdp);
      this.open = true;
      break;
    case 'CANDIDATE':
      Negotiator.handleCandidate(this, payload.candidate);
      break;
    default:
      util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
      break;
  }
}

MediaConnection.prototype.answer = function(stream) {
  if (this.localStream) {
    util.warn('Local stream already exists on this MediaConnection. Are you answering a call twice?');
    return;
  }

  this.options._payload._stream = stream;

  this.localStream = stream;
  Negotiator.startConnection(
    this,
    this.options._payload
  )
  // Retrieve lost messages stored because PeerConnection not set up.
  var messages = this.provider._getMessages(this.id);
  for (var i = 0, ii = messages.length; i < ii; i += 1) {
    this.handleMessage(messages[i]);
  }
  this.open = true;
};

/**
 * Exposed functionality for users.
 */

/** Allows user to close connection. */
MediaConnection.prototype.close = function() {
  if (!this.open) {
    return;
  }
  this.open = false;
  Negotiator.cleanup(this);
  this.emit('close')
};

module.exports = MediaConnection;

},{"./negotiator":6,"./util":9,"eventemitter3":10}],6:[function(require,module,exports){
var util = require('./util');
var RTCPeerConnection = require('./adapter').RTCPeerConnection;
var RTCSessionDescription = require('./adapter').RTCSessionDescription;
var RTCIceCandidate = require('./adapter').RTCIceCandidate;

/**
 * Manages all negotiations between Peers.
 */
var Negotiator = {
  pcs: {
    data: {},
    media: {}
  }, // type => {peerId: {pc_id: pc}}.
  //providers: {}, // provider's id => providers (there may be multiple providers/client.
  queue: [] // connections that are delayed due to a PC being in use.
}

Negotiator._idPrefix = 'pc_';

/** Returns a PeerConnection object set up correctly (for data, media). */
Negotiator.startConnection = function(connection, options) {
  var pc = Negotiator._getPeerConnection(connection, options);

  if (connection.type === 'media' && options._stream) {
    // Add the stream.
    pc.addStream(options._stream);
  }

  // Set the connection's PC.
  connection.pc = connection.peerConnection = pc;
  // What do we need to do now?
  if (options.originator) {
    if (connection.type === 'data') {
      // Create the datachannel.
      var config = {};
      // Dropping reliable:false support, since it seems to be crashing
      // Chrome.
      /*if (util.supports.sctp && !options.reliable) {
        // If we have canonical reliable support...
        config = {maxRetransmits: 0};
      }*/
      // Fallback to ensure older browsers don't crash.
      if (!util.supports.sctp) {
        config = {reliable: options.reliable};
      }
      var dc = pc.createDataChannel(connection.label, config);
      connection.initialize(dc);
    }

    if (!util.supports.onnegotiationneeded) {
      Negotiator._makeOffer(connection);
    }
  } else {
    Negotiator.handleSDP('OFFER', connection, options.sdp);
  }
}

Negotiator._getPeerConnection = function(connection, options) {
  if (!Negotiator.pcs[connection.type]) {
    util.error(connection.type + ' is not a valid connection type. Maybe you overrode the `type` property somewhere.');
  }

  if (!Negotiator.pcs[connection.type][connection.peer]) {
    Negotiator.pcs[connection.type][connection.peer] = {};
  }
  var peerConnections = Negotiator.pcs[connection.type][connection.peer];

  var pc;
  // Not multiplexing while FF and Chrome have not-great support for it.
  /*if (options.multiplex) {
    ids = Object.keys(peerConnections);
    for (var i = 0, ii = ids.length; i < ii; i += 1) {
      pc = peerConnections[ids[i]];
      if (pc.signalingState === 'stable') {
        break; // We can go ahead and use this PC.
      }
    }
  } else */
  if (options.pc) { // Simplest case: PC id already provided for us.
    pc = Negotiator.pcs[connection.type][connection.peer][options.pc];
  }

  if (!pc || pc.signalingState !== 'stable') {
    pc = Negotiator._startPeerConnection(connection);
  }
  return pc;
}

/*
Negotiator._addProvider = function(provider) {
  if ((!provider.id && !provider.disconnected) || !provider.socket.open) {
    // Wait for provider to obtain an ID.
    provider.on('open', function(id) {
      Negotiator._addProvider(provider);
    });
  } else {
    Negotiator.providers[provider.id] = provider;
  }
}*/


/** Start a PC. */
Negotiator._startPeerConnection = function(connection) {
  util.log('Creating RTCPeerConnection.');

  var id = Negotiator._idPrefix + util.randomToken();
  var optional = {};

  if (connection.type === 'data' && !util.supports.sctp) {
    optional = {optional: [{RtpDataChannels: true}]};
  } else if (connection.type === 'media') {
    // Interop req for chrome.
    optional = {optional: [{DtlsSrtpKeyAgreement: true}]};
  }

  var pc = new RTCPeerConnection(connection.provider.options.config, optional);
  Negotiator.pcs[connection.type][connection.peer][id] = pc;

  Negotiator._setupListeners(connection, pc, id);

  return pc;
}

/** Set up various WebRTC listeners. */
Negotiator._setupListeners = function(connection, pc, pc_id) {
  var peerId = connection.peer;
  var connectionId = connection.id;
  var provider = connection.provider;

  // ICE CANDIDATES.
  util.log('Listening for ICE candidates.');
  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      util.log('Received ICE candidates for:', connection.peer);
      provider.socket.send({
        type: 'CANDIDATE',
        payload: {
          candidate: evt.candidate,
          type: connection.type,
          connectionId: connection.id
        },
        dst: peerId
      });
    }
  };

  pc.oniceconnectionstatechange = function() {
    switch (pc.iceConnectionState) {
      case 'disconnected':
      case 'failed':
        util.log('iceConnectionState is disconnected, closing connections to ' + peerId);
        connection.close();
        break;
      case 'completed':
        pc.onicecandidate = util.noop;
        break;
    }
  };

  // Fallback for older Chrome impls.
  pc.onicechange = pc.oniceconnectionstatechange;

  // ONNEGOTIATIONNEEDED (Chrome)
  util.log('Listening for `negotiationneeded`');
  pc.onnegotiationneeded = function() {
    util.log('`negotiationneeded` triggered');
    if (pc.signalingState == 'stable') {
      Negotiator._makeOffer(connection);
    } else {
      util.log('onnegotiationneeded triggered when not stable. Is another connection being established?');
    }
  };

  // DATACONNECTION.
  util.log('Listening for data channel');
  // Fired between offer and answer, so options should already be saved
  // in the options hash.
  pc.ondatachannel = function(evt) {
    util.log('Received data channel');
    var dc = evt.channel;
    var connection = provider.getConnection(peerId, connectionId);
    connection.initialize(dc);
  };

  // MEDIACONNECTION.
  util.log('Listening for remote stream');
  pc.onaddstream = function(evt) {
    util.log('Received remote stream');
    var stream = evt.stream;
    var connection = provider.getConnection(peerId, connectionId);
    // 10/10/2014: looks like in Chrome 38, onaddstream is triggered after
    // setting the remote description. Our connection object in these cases
    // is actually a DATA connection, so addStream fails.
    // TODO: This is hopefully just a temporary fix. We should try to
    // understand why this is happening.
    if (connection.type === 'media') {
      connection.addStream(stream);
    }
  };
}

Negotiator.cleanup = function(connection) {
  util.log('Cleaning up PeerConnection to ' + connection.peer);

  var pc = connection.pc;

  if (!!pc && (pc.readyState !== 'closed' || pc.signalingState !== 'closed')) {
    pc.close();
    connection.pc = null;
  }
}

Negotiator._makeOffer = function(connection) {
  var pc = connection.pc;
  pc.createOffer(function(offer) {
    util.log('Created offer.');

    if (!util.supports.sctp && connection.type === 'data' && connection.reliable) {
      offer.sdp = Reliable.higherBandwidthSDP(offer.sdp);
    }

    pc.setLocalDescription(offer, function() {
      util.log('Set localDescription: offer', 'for:', connection.peer);
      connection.provider.socket.send({
        type: 'OFFER',
        payload: {
          sdp: offer,
          type: connection.type,
          label: connection.label,
          connectionId: connection.id,
          reliable: connection.reliable,
          serialization: connection.serialization,
          metadata: connection.metadata,
          browser: util.browser
        },
        dst: connection.peer
      });
    }, function(err) {
      connection.provider.emitError('webrtc', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }, function(err) {
    connection.provider.emitError('webrtc', err);
    util.log('Failed to createOffer, ', err);
  }, connection.options.constraints);
}

Negotiator._makeAnswer = function(connection) {
  var pc = connection.pc;

  pc.createAnswer(function(answer) {
    util.log('Created answer.');

    if (!util.supports.sctp && connection.type === 'data' && connection.reliable) {
      answer.sdp = Reliable.higherBandwidthSDP(answer.sdp);
    }

    pc.setLocalDescription(answer, function() {
      util.log('Set localDescription: answer', 'for:', connection.peer);
      connection.provider.socket.send({
        type: 'ANSWER',
        payload: {
          sdp: answer,
          type: connection.type,
          connectionId: connection.id,
          browser: util.browser
        },
        dst: connection.peer
      });
    }, function(err) {
      connection.provider.emitError('webrtc', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }, function(err) {
    connection.provider.emitError('webrtc', err);
    util.log('Failed to create answer, ', err);
  });
}

/** Handle an SDP. */
Negotiator.handleSDP = function(type, connection, sdp) {
  sdp = new RTCSessionDescription(sdp);
  var pc = connection.pc;

  util.log('Setting remote description', sdp);
  pc.setRemoteDescription(sdp, function() {
    util.log('Set remoteDescription:', type, 'for:', connection.peer);

    if (type === 'OFFER') {
      Negotiator._makeAnswer(connection);
    }
  }, function(err) {
    connection.provider.emitError('webrtc', err);
    util.log('Failed to setRemoteDescription, ', err);
  });
}

/** Handle a candidate. */
Negotiator.handleCandidate = function(connection, ice) {
  var candidate = ice.candidate;
  var sdpMLineIndex = ice.sdpMLineIndex;
  connection.pc.addIceCandidate(new RTCIceCandidate({
    sdpMLineIndex: sdpMLineIndex,
    candidate: candidate
  }));
  util.log('Added ICE candidate for:', connection.peer);
}

module.exports = Negotiator;

},{"./adapter":3,"./util":9}],7:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');
var Socket = require('./socket');
var MediaConnection = require('./mediaconnection');
var DataConnection = require('./dataconnection');

/**
 * A peer who can initiate connections with other peers.
 */
function Peer(id, options) {
  if (!(this instanceof Peer)) return new Peer(id, options);
  EventEmitter.call(this);

  // Deal with overloading
  if (id && id.constructor == Object) {
    options = id;
    id = undefined;
  } else if (id) {
    // Ensure id is a string
    id = id.toString();
  }
  //

  // Configurize options
  options = util.extend({
    debug: 0, // 1: Errors, 2: Warnings, 3: All logs
    host: util.CLOUD_HOST,
    port: util.CLOUD_PORT,
    key: 'peerjs',
    path: '/',
    token: util.randomToken(),
    config: util.defaultConfig
  }, options);
  this.options = options;
  // Detect relative URL host.
  if (options.host === '/') {
    options.host = window.location.hostname;
  }
  // Set path correctly.
  if (options.path[0] !== '/') {
    options.path = '/' + options.path;
  }
  if (options.path[options.path.length - 1] !== '/') {
    options.path += '/';
  }

  // Set whether we use SSL to same as current host
  if (options.secure === undefined && options.host !== util.CLOUD_HOST) {
    options.secure = util.isSecure();
  }
  // Set a custom log function if present
  if (options.logFunction) {
    util.setLogFunction(options.logFunction);
  }
  util.setLogLevel(options.debug);
  //

  // Sanity checks
  // Ensure WebRTC supported
  if (!util.supports.audioVideo && !util.supports.data ) {
    this._delayedAbort('browser-incompatible', 'The current browser does not support WebRTC');
    return;
  }
  // Ensure alphanumeric id
  if (!util.validateId(id)) {
    this._delayedAbort('invalid-id', 'ID "' + id + '" is invalid');
    return;
  }
  // Ensure valid key
  if (!util.validateKey(options.key)) {
    this._delayedAbort('invalid-key', 'API KEY "' + options.key + '" is invalid');
    return;
  }
  // Ensure not using unsecure cloud server on SSL page
  if (options.secure && options.host === '0.peerjs.com') {
    this._delayedAbort('ssl-unavailable',
      'The cloud server currently does not support HTTPS. Please run your own PeerServer to use HTTPS.');
    return;
  }
  //

  // States.
  this.destroyed = false; // Connections have been killed
  this.disconnected = false; // Connection to PeerServer killed but P2P connections still active
  this.open = false; // Sockets and such are not yet open.
  //

  // References
  this.connections = {}; // DataConnections for this peer.
  this._lostMessages = {}; // src => [list of messages]
  //

  // Start the server connection
  this._initializeServerConnection();
  if (id) {
    this._initialize(id);
  } else {
    this._retrieveId();
  }
  //
}

util.inherits(Peer, EventEmitter);

// Initialize the 'socket' (which is actually a mix of XHR streaming and
// websockets.)
Peer.prototype._initializeServerConnection = function() {
  var self = this;
  this.socket = new Socket(this.options.secure, this.options.host, this.options.port, this.options.path, this.options.key);
  this.socket.on('message', function(data) {
    self._handleMessage(data);
  });
  this.socket.on('error', function(error) {
    self._abort('socket-error', error);
  });
  this.socket.on('disconnected', function() {
    // If we haven't explicitly disconnected, emit error and disconnect.
    if (!self.disconnected) {
      self.emitError('network', 'Lost connection to server.');
      self.disconnect();
    }
  });
  this.socket.on('close', function() {
    // If we haven't explicitly disconnected, emit error.
    if (!self.disconnected) {
      self._abort('socket-closed', 'Underlying socket is already closed.');
    }
  });
};

/** Get a unique ID from the server via XHR. */
Peer.prototype._retrieveId = function(cb) {
  var self = this;
  var http = new XMLHttpRequest();
  var protocol = this.options.secure ? 'https://' : 'http://';
  var url = protocol + this.options.host + ':' + this.options.port +
    this.options.path + this.options.key + '/id';
  var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
  url += queryString;

  // If there's no ID we need to wait for one before trying to init socket.
  http.open('get', url, true);
  http.onerror = function(e) {
    util.error('Error retrieving ID', e);
    var pathError = '';
    if (self.options.path === '/' && self.options.host !== util.CLOUD_HOST) {
      pathError = ' If you passed in a `path` to your self-hosted PeerServer, ' +
        'you\'ll also need to pass in that same path when creating a new ' +
        'Peer.';
    }
    self._abort('server-error', 'Could not get an ID from the server.' + pathError);
  };
  http.onreadystatechange = function() {
    if (http.readyState !== 4) {
      return;
    }
    if (http.status !== 200) {
      http.onerror();
      return;
    }
    self._initialize(http.responseText);
  };
  http.send(null);
};

/** Initialize a connection with the server. */
Peer.prototype._initialize = function(id) {
  this.id = id;
  this.socket.start(this.id, this.options.token);
};

/** Handles messages from the server. */
Peer.prototype._handleMessage = function(message) {
  var type = message.type;
  var payload = message.payload;
  var peer = message.src;
  var connection;

  switch (type) {
    case 'OPEN': // The connection to the server is open.
      this.emit('open', this.id);
      this.open = true;
      break;
    case 'ERROR': // Server error.
      this._abort('server-error', payload.msg);
      break;
    case 'ID-TAKEN': // The selected ID is taken.
      this._abort('unavailable-id', 'ID `' + this.id + '` is taken');
      break;
    case 'INVALID-KEY': // The given API key cannot be found.
      this._abort('invalid-key', 'API KEY "' + this.options.key + '" is invalid');
      break;

    //
    case 'LEAVE': // Another peer has closed its connection to this peer.
      util.log('Received leave message from', peer);
      this._cleanupPeer(peer);
      break;

    case 'EXPIRE': // The offer sent to a peer has expired without response.
      this.emitError('peer-unavailable', 'Could not connect to peer ' + peer);
      break;
    case 'OFFER': // we should consider switching this to CALL/CONNECT, but this is the least breaking option.
      var connectionId = payload.connectionId;
      connection = this.getConnection(peer, connectionId);

      if (connection) {
        util.warn('Offer received for existing Connection ID:', connectionId);
        //connection.handleMessage(message);
      } else {
        // Create a new connection.
        if (payload.type === 'media') {
          connection = new MediaConnection(peer, this, {
            connectionId: connectionId,
            _payload: payload,
            metadata: payload.metadata
          });
          this._addConnection(peer, connection);
          this.emit('call', connection);
        } else if (payload.type === 'data') {
          connection = new DataConnection(peer, this, {
            connectionId: connectionId,
            _payload: payload,
            metadata: payload.metadata,
            label: payload.label,
            serialization: payload.serialization,
            reliable: payload.reliable
          });
          this._addConnection(peer, connection);
          this.emit('connection', connection);
        } else {
          util.warn('Received malformed connection type:', payload.type);
          return;
        }
        // Find messages.
        var messages = this._getMessages(connectionId);
        for (var i = 0, ii = messages.length; i < ii; i += 1) {
          connection.handleMessage(messages[i]);
        }
      }
      break;
    default:
      if (!payload) {
        util.warn('You received a malformed message from ' + peer + ' of type ' + type);
        return;
      }

      var id = payload.connectionId;
      connection = this.getConnection(peer, id);

      if (connection && connection.pc) {
        // Pass it on.
        connection.handleMessage(message);
      } else if (id) {
        // Store for possible later use
        this._storeMessage(id, message);
      } else {
        util.warn('You received an unrecognized message:', message);
      }
      break;
  }
};

/** Stores messages without a set up connection, to be claimed later. */
Peer.prototype._storeMessage = function(connectionId, message) {
  if (!this._lostMessages[connectionId]) {
    this._lostMessages[connectionId] = [];
  }
  this._lostMessages[connectionId].push(message);
};

/** Retrieve messages from lost message store */
Peer.prototype._getMessages = function(connectionId) {
  var messages = this._lostMessages[connectionId];
  if (messages) {
    delete this._lostMessages[connectionId];
    return messages;
  } else {
    return [];
  }
};

/**
 * Returns a DataConnection to the specified peer. See documentation for a
 * complete list of options.
 */
Peer.prototype.connect = function(peer, options) {
  if (this.disconnected) {
    util.warn('You cannot connect to a new Peer because you called ' +
      '.disconnect() on this Peer and ended your connection with the ' +
      'server. You can create a new Peer to reconnect, or call reconnect ' +
      'on this peer if you believe its ID to still be available.');
    this.emitError('disconnected', 'Cannot connect to new Peer after disconnecting from server.');
    return;
  }
  var connection = new DataConnection(peer, this, options);
  this._addConnection(peer, connection);
  return connection;
};

/**
 * Returns a MediaConnection to the specified peer. See documentation for a
 * complete list of options.
 */
Peer.prototype.call = function(peer, stream, options) {
  if (this.disconnected) {
    util.warn('You cannot connect to a new Peer because you called ' +
      '.disconnect() on this Peer and ended your connection with the ' +
      'server. You can create a new Peer to reconnect.');
    this.emitError('disconnected', 'Cannot connect to new Peer after disconnecting from server.');
    return;
  }
  if (!stream) {
    util.error('To call a peer, you must provide a stream from your browser\'s `getUserMedia`.');
    return;
  }
  options = options || {};
  options._stream = stream;
  var call = new MediaConnection(peer, this, options);
  this._addConnection(peer, call);
  return call;
};

/** Add a data/media connection to this peer. */
Peer.prototype._addConnection = function(peer, connection) {
  if (!this.connections[peer]) {
    this.connections[peer] = [];
  }
  this.connections[peer].push(connection);
};

/** Retrieve a data/media connection for this peer. */
Peer.prototype.getConnection = function(peer, id) {
  var connections = this.connections[peer];
  if (!connections) {
    return null;
  }
  for (var i = 0, ii = connections.length; i < ii; i++) {
    if (connections[i].id === id) {
      return connections[i];
    }
  }
  return null;
};

Peer.prototype._delayedAbort = function(type, message) {
  var self = this;
  util.setZeroTimeout(function(){
    self._abort(type, message);
  });
};

/**
 * Destroys the Peer and emits an error message.
 * The Peer is not destroyed if it's in a disconnected state, in which case
 * it retains its disconnected state and its existing connections.
 */
Peer.prototype._abort = function(type, message) {
  util.error('Aborting!');
  if (!this._lastServerId) {
    this.destroy();
  } else {
    this.disconnect();
  }
  this.emitError(type, message);
};

/** Emits a typed error message. */
Peer.prototype.emitError = function(type, err) {
  util.error('Error:', err);
  if (typeof err === 'string') {
    err = new Error(err);
  }
  err.type = type;
  this.emit('error', err);
};

/**
 * Destroys the Peer: closes all active connections as well as the connection
 *  to the server.
 * Warning: The peer can no longer create or accept connections after being
 *  destroyed.
 */
Peer.prototype.destroy = function() {
  if (!this.destroyed) {
    this._cleanup();
    this.disconnect();
    this.destroyed = true;
  }
};


/** Disconnects every connection on this peer. */
Peer.prototype._cleanup = function() {
  if (this.connections) {
    var peers = Object.keys(this.connections);
    for (var i = 0, ii = peers.length; i < ii; i++) {
      this._cleanupPeer(peers[i]);
    }
  }
  this.emit('close');
};

/** Closes all connections to this peer. */
Peer.prototype._cleanupPeer = function(peer) {
  var connections = this.connections[peer];
  for (var j = 0, jj = connections.length; j < jj; j += 1) {
    connections[j].close();
  }
};

/**
 * Disconnects the Peer's connection to the PeerServer. Does not close any
 *  active connections.
 * Warning: The peer can no longer create or accept connections after being
 *  disconnected. It also cannot reconnect to the server.
 */
Peer.prototype.disconnect = function() {
  var self = this;
  util.setZeroTimeout(function(){
    if (!self.disconnected) {
      self.disconnected = true;
      self.open = false;
      if (self.socket) {
        self.socket.close();
      }
      self.emit('disconnected', self.id);
      self._lastServerId = self.id;
      self.id = null;
    }
  });
};

/** Attempts to reconnect with the same ID. */
Peer.prototype.reconnect = function() {
  if (this.disconnected && !this.destroyed) {
    util.log('Attempting reconnection to server with ID ' + this._lastServerId);
    this.disconnected = false;
    this._initializeServerConnection();
    this._initialize(this._lastServerId);
  } else if (this.destroyed) {
    throw new Error('This peer cannot reconnect to the server. It has already been destroyed.');
  } else if (!this.disconnected && !this.open) {
    // Do nothing. We're still connecting the first time.
    util.error('In a hurry? We\'re still trying to make the initial connection!');
  } else {
    throw new Error('Peer ' + this.id + ' cannot reconnect because it is not disconnected from the server!');
  }
};

/**
 * Get a list of available peer IDs. If you're running your own server, you'll
 * want to set allow_discovery: true in the PeerServer options. If you're using
 * the cloud server, email team@peerjs.com to get the functionality enabled for
 * your key.
 */
Peer.prototype.listAllPeers = function(cb) {
  cb = cb || function() {};
  var self = this;
  var http = new XMLHttpRequest();
  var protocol = this.options.secure ? 'https://' : 'http://';
  var url = protocol + this.options.host + ':' + this.options.port +
    this.options.path + this.options.key + '/peers';
  var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
  url += queryString;

  // If there's no ID we need to wait for one before trying to init socket.
  http.open('get', url, true);
  http.onerror = function(e) {
    self._abort('server-error', 'Could not get peers from the server.');
    cb([]);
  };
  http.onreadystatechange = function() {
    if (http.readyState !== 4) {
      return;
    }
    if (http.status === 401) {
      var helpfulError = '';
      if (self.options.host !== util.CLOUD_HOST) {
        helpfulError = 'It looks like you\'re using the cloud server. You can email ' +
          'team@peerjs.com to enable peer listing for your API key.';
      } else {
        helpfulError = 'You need to enable `allow_discovery` on your self-hosted ' +
          'PeerServer to use this feature.';
      }
      cb([]);
      throw new Error('It doesn\'t look like you have permission to list peers IDs. ' + helpfulError);
    } else if (http.status !== 200) {
      cb([]);
    } else {
      cb(JSON.parse(http.responseText));
    }
  };
  http.send(null);
};

module.exports = Peer;

},{"./dataconnection":4,"./mediaconnection":5,"./socket":8,"./util":9,"eventemitter3":10}],8:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');

/**
 * An abstraction on top of WebSockets and XHR streaming to provide fastest
 * possible connection for peers.
 */
function Socket(secure, host, port, path, key) {
  if (!(this instanceof Socket)) return new Socket(secure, host, port, path, key);

  EventEmitter.call(this);

  // Disconnected manually.
  this.disconnected = false;
  this._queue = [];

  var httpProtocol = secure ? 'https://' : 'http://';
  var wsProtocol = secure ? 'wss://' : 'ws://';
  this._httpUrl = httpProtocol + host + ':' + port + path + key;
  this._wsUrl = wsProtocol + host + ':' + port + path + 'peerjs?key=' + key;
}

util.inherits(Socket, EventEmitter);


/** Check in with ID or get one from server. */
Socket.prototype.start = function(id, token) {
  this.id = id;

  this._httpUrl += '/' + id + '/' + token;
  this._wsUrl += '&id=' + id + '&token=' + token;

  this._startXhrStream();
  this._startWebSocket();
}


/** Start up websocket communications. */
Socket.prototype._startWebSocket = function(id) {
  var self = this;

  if (this._socket) {
    return;
  }

  this._socket = new WebSocket(this._wsUrl);

  this._socket.onmessage = function(event) {
    try {
      var data = JSON.parse(event.data);
    } catch(e) {
      util.log('Invalid server message', event.data);
      return;
    }
    self.emit('message', data);
  };

  this._socket.onclose = function(event) {
    util.log('Socket closed.');
    self.disconnected = true;
    self.emit('disconnected');
  };

  // Take care of the queue of connections if necessary and make sure Peer knows
  // socket is open.
  this._socket.onopen = function() {
    if (self._timeout) {
      clearTimeout(self._timeout);
      setTimeout(function(){
        self._http.abort();
        self._http = null;
      }, 5000);
    }
    self._sendQueuedMessages();
    util.log('Socket open');
  };
}

/** Start XHR streaming. */
Socket.prototype._startXhrStream = function(n) {
  try {
    var self = this;
    this._http = new XMLHttpRequest();
    this._http._index = 1;
    this._http._streamIndex = n || 0;
    this._http.open('post', this._httpUrl + '/id?i=' + this._http._streamIndex, true);
    this._http.onerror = function() {
      // If we get an error, likely something went wrong.
      // Stop streaming.
      clearTimeout(self._timeout);
      self.emit('disconnected');
    }
    this._http.onreadystatechange = function() {
      if (this.readyState == 2 && this.old) {
        this.old.abort();
        delete this.old;
      } else if (this.readyState > 2 && this.status === 200 && this.responseText) {
        self._handleStream(this);
      }
    };
    this._http.send(null);
    this._setHTTPTimeout();
  } catch(e) {
    util.log('XMLHttpRequest not available; defaulting to WebSockets');
  }
}


/** Handles onreadystatechange response as a stream. */
Socket.prototype._handleStream = function(http) {
  // 3 and 4 are loading/done state. All others are not relevant.
  var messages = http.responseText.split('\n');

  // Check to see if anything needs to be processed on buffer.
  if (http._buffer) {
    while (http._buffer.length > 0) {
      var index = http._buffer.shift();
      var bufferedMessage = messages[index];
      try {
        bufferedMessage = JSON.parse(bufferedMessage);
      } catch(e) {
        http._buffer.shift(index);
        break;
      }
      this.emit('message', bufferedMessage);
    }
  }

  var message = messages[http._index];
  if (message) {
    http._index += 1;
    // Buffering--this message is incomplete and we'll get to it next time.
    // This checks if the httpResponse ended in a `\n`, in which case the last
    // element of messages should be the empty string.
    if (http._index === messages.length) {
      if (!http._buffer) {
        http._buffer = [];
      }
      http._buffer.push(http._index - 1);
    } else {
      try {
        message = JSON.parse(message);
      } catch(e) {
        util.log('Invalid server message', message);
        return;
      }
      this.emit('message', message);
    }
  }
}

Socket.prototype._setHTTPTimeout = function() {
  var self = this;
  this._timeout = setTimeout(function() {
    var old = self._http;
    if (!self._wsOpen()) {
      self._startXhrStream(old._streamIndex + 1);
      self._http.old = old;
    } else {
      old.abort();
    }
  }, 25000);
}

/** Is the websocket currently open? */
Socket.prototype._wsOpen = function() {
  return this._socket && this._socket.readyState == 1;
}

/** Send queued messages. */
Socket.prototype._sendQueuedMessages = function() {
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    this.send(this._queue[i]);
  }
}

/** Exposed send for DC & Peer. */
Socket.prototype.send = function(data) {
  if (this.disconnected) {
    return;
  }

  // If we didn't get an ID yet, we can't yet send anything so we should queue
  // up these messages.
  if (!this.id) {
    this._queue.push(data);
    return;
  }

  if (!data.type) {
    this.emit('error', 'Invalid message');
    return;
  }

  var message = JSON.stringify(data);
  if (this._wsOpen()) {
    this._socket.send(message);
  } else {
    var http = new XMLHttpRequest();
    var url = this._httpUrl + '/' + data.type.toLowerCase();
    http.open('post', url, true);
    http.setRequestHeader('Content-Type', 'application/json');
    http.send(message);
  }
}

Socket.prototype.close = function() {
  if (!this.disconnected && this._wsOpen()) {
    this._socket.close();
    this.disconnected = true;
  }
}

module.exports = Socket;

},{"./util":9,"eventemitter3":10}],9:[function(require,module,exports){
var defaultConfig = {'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }]};
var dataCount = 1;

var BinaryPack = require('js-binarypack');
var RTCPeerConnection = require('./adapter').RTCPeerConnection;

var util = {
  noop: function() {},

  CLOUD_HOST: '0.peerjs.com',
  CLOUD_PORT: 9000,

  // Browsers that need chunking:
  chunkedBrowsers: {'Chrome': 1},
  chunkedMTU: 16300, // The original 60000 bytes setting does not work when sending data from Firefox to Chrome, which is "cut off" after 16384 bytes and delivered individually.

  // Logging logic
  logLevel: 0,
  setLogLevel: function(level) {
    var debugLevel = parseInt(level, 10);
    if (!isNaN(parseInt(level, 10))) {
      util.logLevel = debugLevel;
    } else {
      // If they are using truthy/falsy values for debug
      util.logLevel = level ? 3 : 0;
    }
    util.log = util.warn = util.error = util.noop;
    if (util.logLevel > 0) {
      util.error = util._printWith('ERROR');
    }
    if (util.logLevel > 1) {
      util.warn = util._printWith('WARNING');
    }
    if (util.logLevel > 2) {
      util.log = util._print;
    }
  },
  setLogFunction: function(fn) {
    if (fn.constructor !== Function) {
      util.warn('The log function you passed in is not a function. Defaulting to regular logs.');
    } else {
      util._print = fn;
    }
  },

  _printWith: function(prefix) {
    return function() {
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift(prefix);
      util._print.apply(util, copy);
    };
  },
  _print: function () {
    var err = false;
    var copy = Array.prototype.slice.call(arguments);
    copy.unshift('PeerJS: ');
    for (var i = 0, l = copy.length; i < l; i++){
      if (copy[i] instanceof Error) {
        copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
        err = true;
      }
    }
    err ? console.error.apply(console, copy) : console.log.apply(console, copy);
  },
  //

  // Returns browser-agnostic default config
  defaultConfig: defaultConfig,
  //

  // Returns the current browser.
  browser: (function() {
    if (window.mozRTCPeerConnection) {
      return 'Firefox';
    } else if (window.webkitRTCPeerConnection) {
      return 'Chrome';
    } else if (window.RTCPeerConnection) {
      return 'Supported';
    } else {
      return 'Unsupported';
    }
  })(),
  //

  // Lists which features are supported
  supports: (function() {
    if (typeof RTCPeerConnection === 'undefined') {
      return {};
    }

    var data = true;
    var audioVideo = true;

    var binaryBlob = false;
    var sctp = false;
    var onnegotiationneeded = !!window.webkitRTCPeerConnection;

    var pc, dc;
    try {
      pc = new RTCPeerConnection(defaultConfig, {optional: [{RtpDataChannels: true}]});
    } catch (e) {
      data = false;
      audioVideo = false;
    }

    if (data) {
      try {
        dc = pc.createDataChannel('_PEERJSTEST');
      } catch (e) {
        data = false;
      }
    }

    if (data) {
      // Binary test
      try {
        dc.binaryType = 'blob';
        binaryBlob = true;
      } catch (e) {
      }

      // Reliable test.
      // Unfortunately Chrome is a bit unreliable about whether or not they
      // support reliable.
      var reliablePC = new RTCPeerConnection(defaultConfig, {});
      try {
        var reliableDC = reliablePC.createDataChannel('_PEERJSRELIABLETEST', {});
        sctp = reliableDC.reliable;
      } catch (e) {
      }
      reliablePC.close();
    }

    // FIXME: not really the best check...
    if (audioVideo) {
      audioVideo = !!pc.addStream;
    }

    // FIXME: this is not great because in theory it doesn't work for
    // av-only browsers (?).
    if (!onnegotiationneeded && data) {
      // sync default check.
      var negotiationPC = new RTCPeerConnection(defaultConfig, {optional: [{RtpDataChannels: true}]});
      negotiationPC.onnegotiationneeded = function() {
        onnegotiationneeded = true;
        // async check.
        if (util && util.supports) {
          util.supports.onnegotiationneeded = true;
        }
      };
      negotiationPC.createDataChannel('_PEERJSNEGOTIATIONTEST');

      setTimeout(function() {
        negotiationPC.close();
      }, 1000);
    }

    if (pc) {
      pc.close();
    }

    return {
      audioVideo: audioVideo,
      data: data,
      binaryBlob: binaryBlob,
      binary: sctp, // deprecated; sctp implies binary support.
      reliable: sctp, // deprecated; sctp implies reliable data.
      sctp: sctp,
      onnegotiationneeded: onnegotiationneeded
    };
  }()),
  //

  // Ensure alphanumeric ids
  validateId: function(id) {
    // Allow empty ids
    return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
  },

  validateKey: function(key) {
    // Allow empty keys
    return !key || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.exec(key);
  },


  debug: false,

  inherits: function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  },
  extend: function(dest, source) {
    for(var key in source) {
      if(source.hasOwnProperty(key)) {
        dest[key] = source[key];
      }
    }
    return dest;
  },
  pack: BinaryPack.pack,
  unpack: BinaryPack.unpack,

  log: function () {
    if (util.debug) {
      var err = false;
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift('PeerJS: ');
      for (var i = 0, l = copy.length; i < l; i++){
        if (copy[i] instanceof Error) {
          copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
          err = true;
        }
      }
      err ? console.error.apply(console, copy) : console.log.apply(console, copy);
    }
  },

  setZeroTimeout: (function(global) {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    // Like setTimeout, but only takes a function argument.	 There's
    // no time argument (always zero) and no arguments (you have to
    // use a closure).
    function setZeroTimeoutPostMessage(fn) {
      timeouts.push(fn);
      global.postMessage(messageName, '*');
    }

    function handleMessage(event) {
      if (event.source == global && event.data == messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (timeouts.length) {
          timeouts.shift()();
        }
      }
    }
    if (global.addEventListener) {
      global.addEventListener('message', handleMessage, true);
    } else if (global.attachEvent) {
      global.attachEvent('onmessage', handleMessage);
    }
    return setZeroTimeoutPostMessage;
  }(window)),

  // Binary stuff

  // chunks a blob.
  chunk: function(bl) {
    var chunks = [];
    var size = bl.size;
    var start = index = 0;
    var total = Math.ceil(size / util.chunkedMTU);
    while (start < size) {
      var end = Math.min(size, start + util.chunkedMTU);
      var b = bl.slice(start, end);

      var chunk = {
        __peerData: dataCount,
        n: index,
        data: b,
        total: total
      };

      chunks.push(chunk);

      start = end;
      index += 1;
    }
    dataCount += 1;
    return chunks;
  },

  blobToArrayBuffer: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsArrayBuffer(blob);
  },
  blobToBinaryString: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsBinaryString(blob);
  },
  binaryStringToArrayBuffer: function(binary) {
    var byteArray = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i) & 0xff;
    }
    return byteArray.buffer;
  },
  randomToken: function () {
    return Math.random().toString(36).substr(2);
  },
  //

  isSecure: function() {
    return location.protocol === 'https:';
  }
};

module.exports = util;

},{"./adapter":3,"js-binarypack":11}],10:[function(require,module,exports){
'use strict';

/**
 * Representation of a single EventEmitter function.
 *
 * @param {Function} fn Event handler to be called.
 * @param {Mixed} context Context for function execution.
 * @param {Boolean} once Only emit once
 * @api private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() { /* Nothing to set */ }

/**
 * Holds the assigned EventEmitters by name.
 *
 * @type {Object}
 * @private
 */
EventEmitter.prototype._events = undefined;

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  if (!this._events || !this._events[event]) return [];
  if (this._events[event].fn) return [this._events[event].fn];

  for (var i = 0, l = this._events[event].length, ee = new Array(l); i < l; i++) {
    ee[i] = this._events[event][i].fn;
  }

  return ee;
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , len = arguments.length
    , args
    , i;

  if ('function' === typeof listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  var listener = new EE(fn, context || this);

  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = listener;
  else {
    if (!this._events[event].fn) this._events[event].push(listener);
    else this._events[event] = [
      this._events[event], listener
    ];
  }

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  var listener = new EE(fn, context || this, true);

  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = listener;
  else {
    if (!this._events[event].fn) this._events[event].push(listener);
    else this._events[event] = [
      this._events[event], listener
    ];
  }

  return this;
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @param {Boolean} once Only remove once listeners.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, once) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  if (fn) {
    if (listeners.fn && (listeners.fn !== fn || (once && !listeners.once))) {
      events.push(listeners);
    }
    if (!listeners.fn) for (var i = 0, length = listeners.length; i < length; i++) {
      if (listeners[i].fn !== fn || (once && !listeners[i].once)) {
        events.push(listeners[i]);
      }
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) {
    this._events[event] = events.length === 1 ? events[0] : events;
  } else {
    delete this._events[event];
  }

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) delete this._events[event];
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

//
// Expose the module.
//
module.exports = EventEmitter;

},{}],11:[function(require,module,exports){
var BufferBuilder = require('./bufferbuilder').BufferBuilder;
var binaryFeatures = require('./bufferbuilder').binaryFeatures;

var BinaryPack = {
  unpack: function(data){
    var unpacker = new Unpacker(data);
    return unpacker.unpack();
  },
  pack: function(data){
    var packer = new Packer();
    packer.pack(data);
    var buffer = packer.getBuffer();
    return buffer;
  }
};

module.exports = BinaryPack;

function Unpacker (data){
  // Data is ArrayBuffer
  this.index = 0;
  this.dataBuffer = data;
  this.dataView = new Uint8Array(this.dataBuffer);
  this.length = this.dataBuffer.byteLength;
}

Unpacker.prototype.unpack = function(){
  var type = this.unpack_uint8();
  if (type < 0x80){
    var positive_fixnum = type;
    return positive_fixnum;
  } else if ((type ^ 0xe0) < 0x20){
    var negative_fixnum = (type ^ 0xe0) - 0x20;
    return negative_fixnum;
  }
  var size;
  if ((size = type ^ 0xa0) <= 0x0f){
    return this.unpack_raw(size);
  } else if ((size = type ^ 0xb0) <= 0x0f){
    return this.unpack_string(size);
  } else if ((size = type ^ 0x90) <= 0x0f){
    return this.unpack_array(size);
  } else if ((size = type ^ 0x80) <= 0x0f){
    return this.unpack_map(size);
  }
  switch(type){
    case 0xc0:
      return null;
    case 0xc1:
      return undefined;
    case 0xc2:
      return false;
    case 0xc3:
      return true;
    case 0xca:
      return this.unpack_float();
    case 0xcb:
      return this.unpack_double();
    case 0xcc:
      return this.unpack_uint8();
    case 0xcd:
      return this.unpack_uint16();
    case 0xce:
      return this.unpack_uint32();
    case 0xcf:
      return this.unpack_uint64();
    case 0xd0:
      return this.unpack_int8();
    case 0xd1:
      return this.unpack_int16();
    case 0xd2:
      return this.unpack_int32();
    case 0xd3:
      return this.unpack_int64();
    case 0xd4:
      return undefined;
    case 0xd5:
      return undefined;
    case 0xd6:
      return undefined;
    case 0xd7:
      return undefined;
    case 0xd8:
      size = this.unpack_uint16();
      return this.unpack_string(size);
    case 0xd9:
      size = this.unpack_uint32();
      return this.unpack_string(size);
    case 0xda:
      size = this.unpack_uint16();
      return this.unpack_raw(size);
    case 0xdb:
      size = this.unpack_uint32();
      return this.unpack_raw(size);
    case 0xdc:
      size = this.unpack_uint16();
      return this.unpack_array(size);
    case 0xdd:
      size = this.unpack_uint32();
      return this.unpack_array(size);
    case 0xde:
      size = this.unpack_uint16();
      return this.unpack_map(size);
    case 0xdf:
      size = this.unpack_uint32();
      return this.unpack_map(size);
  }
}

Unpacker.prototype.unpack_uint8 = function(){
  var byte = this.dataView[this.index] & 0xff;
  this.index++;
  return byte;
};

Unpacker.prototype.unpack_uint16 = function(){
  var bytes = this.read(2);
  var uint16 =
    ((bytes[0] & 0xff) * 256) + (bytes[1] & 0xff);
  this.index += 2;
  return uint16;
}

Unpacker.prototype.unpack_uint32 = function(){
  var bytes = this.read(4);
  var uint32 =
     ((bytes[0]  * 256 +
       bytes[1]) * 256 +
       bytes[2]) * 256 +
       bytes[3];
  this.index += 4;
  return uint32;
}

Unpacker.prototype.unpack_uint64 = function(){
  var bytes = this.read(8);
  var uint64 =
   ((((((bytes[0]  * 256 +
       bytes[1]) * 256 +
       bytes[2]) * 256 +
       bytes[3]) * 256 +
       bytes[4]) * 256 +
       bytes[5]) * 256 +
       bytes[6]) * 256 +
       bytes[7];
  this.index += 8;
  return uint64;
}


Unpacker.prototype.unpack_int8 = function(){
  var uint8 = this.unpack_uint8();
  return (uint8 < 0x80 ) ? uint8 : uint8 - (1 << 8);
};

Unpacker.prototype.unpack_int16 = function(){
  var uint16 = this.unpack_uint16();
  return (uint16 < 0x8000 ) ? uint16 : uint16 - (1 << 16);
}

Unpacker.prototype.unpack_int32 = function(){
  var uint32 = this.unpack_uint32();
  return (uint32 < Math.pow(2, 31) ) ? uint32 :
    uint32 - Math.pow(2, 32);
}

Unpacker.prototype.unpack_int64 = function(){
  var uint64 = this.unpack_uint64();
  return (uint64 < Math.pow(2, 63) ) ? uint64 :
    uint64 - Math.pow(2, 64);
}

Unpacker.prototype.unpack_raw = function(size){
  if ( this.length < this.index + size){
    throw new Error('BinaryPackFailure: index is out of range'
      + ' ' + this.index + ' ' + size + ' ' + this.length);
  }
  var buf = this.dataBuffer.slice(this.index, this.index + size);
  this.index += size;

    //buf = util.bufferToString(buf);

  return buf;
}

Unpacker.prototype.unpack_string = function(size){
  var bytes = this.read(size);
  var i = 0, str = '', c, code;
  while(i < size){
    c = bytes[i];
    if ( c < 128){
      str += String.fromCharCode(c);
      i++;
    } else if ((c ^ 0xc0) < 32){
      code = ((c ^ 0xc0) << 6) | (bytes[i+1] & 63);
      str += String.fromCharCode(code);
      i += 2;
    } else {
      code = ((c & 15) << 12) | ((bytes[i+1] & 63) << 6) |
        (bytes[i+2] & 63);
      str += String.fromCharCode(code);
      i += 3;
    }
  }
  this.index += size;
  return str;
}

Unpacker.prototype.unpack_array = function(size){
  var objects = new Array(size);
  for(var i = 0; i < size ; i++){
    objects[i] = this.unpack();
  }
  return objects;
}

Unpacker.prototype.unpack_map = function(size){
  var map = {};
  for(var i = 0; i < size ; i++){
    var key  = this.unpack();
    var value = this.unpack();
    map[key] = value;
  }
  return map;
}

Unpacker.prototype.unpack_float = function(){
  var uint32 = this.unpack_uint32();
  var sign = uint32 >> 31;
  var exp  = ((uint32 >> 23) & 0xff) - 127;
  var fraction = ( uint32 & 0x7fffff ) | 0x800000;
  return (sign == 0 ? 1 : -1) *
    fraction * Math.pow(2, exp - 23);
}

Unpacker.prototype.unpack_double = function(){
  var h32 = this.unpack_uint32();
  var l32 = this.unpack_uint32();
  var sign = h32 >> 31;
  var exp  = ((h32 >> 20) & 0x7ff) - 1023;
  var hfrac = ( h32 & 0xfffff ) | 0x100000;
  var frac = hfrac * Math.pow(2, exp - 20) +
    l32   * Math.pow(2, exp - 52);
  return (sign == 0 ? 1 : -1) * frac;
}

Unpacker.prototype.read = function(length){
  var j = this.index;
  if (j + length <= this.length) {
    return this.dataView.subarray(j, j + length);
  } else {
    throw new Error('BinaryPackFailure: read index out of range');
  }
}

function Packer(){
  this.bufferBuilder = new BufferBuilder();
}

Packer.prototype.getBuffer = function(){
  return this.bufferBuilder.getBuffer();
}

Packer.prototype.pack = function(value){
  var type = typeof(value);
  if (type == 'string'){
    this.pack_string(value);
  } else if (type == 'number'){
    if (Math.floor(value) === value){
      this.pack_integer(value);
    } else{
      this.pack_double(value);
    }
  } else if (type == 'boolean'){
    if (value === true){
      this.bufferBuilder.append(0xc3);
    } else if (value === false){
      this.bufferBuilder.append(0xc2);
    }
  } else if (type == 'undefined'){
    this.bufferBuilder.append(0xc0);
  } else if (type == 'object'){
    if (value === null){
      this.bufferBuilder.append(0xc0);
    } else {
      var constructor = value.constructor;
      if (constructor == Array){
        this.pack_array(value);
      } else if (constructor == Blob || constructor == File) {
        this.pack_bin(value);
      } else if (constructor == ArrayBuffer) {
        if(binaryFeatures.useArrayBufferView) {
          this.pack_bin(new Uint8Array(value));
        } else {
          this.pack_bin(value);
        }
      } else if ('BYTES_PER_ELEMENT' in value){
        if(binaryFeatures.useArrayBufferView) {
          this.pack_bin(new Uint8Array(value.buffer));
        } else {
          this.pack_bin(value.buffer);
        }
      } else if (constructor == Object){
        this.pack_object(value);
      } else if (constructor == Date){
        this.pack_string(value.toString());
      } else if (typeof value.toBinaryPack == 'function'){
        this.bufferBuilder.append(value.toBinaryPack());
      } else {
        throw new Error('Type "' + constructor.toString() + '" not yet supported');
      }
    }
  } else {
    throw new Error('Type "' + type + '" not yet supported');
  }
  this.bufferBuilder.flush();
}


Packer.prototype.pack_bin = function(blob){
  var length = blob.length || blob.byteLength || blob.size;
  if (length <= 0x0f){
    this.pack_uint8(0xa0 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xda) ;
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdb);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  this.bufferBuilder.append(blob);
}

Packer.prototype.pack_string = function(str){
  var length = utf8Length(str);

  if (length <= 0x0f){
    this.pack_uint8(0xb0 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xd8) ;
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xd9);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  this.bufferBuilder.append(str);
}

Packer.prototype.pack_array = function(ary){
  var length = ary.length;
  if (length <= 0x0f){
    this.pack_uint8(0x90 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xdc)
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdd);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  for(var i = 0; i < length ; i++){
    this.pack(ary[i]);
  }
}

Packer.prototype.pack_integer = function(num){
  if ( -0x20 <= num && num <= 0x7f){
    this.bufferBuilder.append(num & 0xff);
  } else if (0x00 <= num && num <= 0xff){
    this.bufferBuilder.append(0xcc);
    this.pack_uint8(num);
  } else if (-0x80 <= num && num <= 0x7f){
    this.bufferBuilder.append(0xd0);
    this.pack_int8(num);
  } else if ( 0x0000 <= num && num <= 0xffff){
    this.bufferBuilder.append(0xcd);
    this.pack_uint16(num);
  } else if (-0x8000 <= num && num <= 0x7fff){
    this.bufferBuilder.append(0xd1);
    this.pack_int16(num);
  } else if ( 0x00000000 <= num && num <= 0xffffffff){
    this.bufferBuilder.append(0xce);
    this.pack_uint32(num);
  } else if (-0x80000000 <= num && num <= 0x7fffffff){
    this.bufferBuilder.append(0xd2);
    this.pack_int32(num);
  } else if (-0x8000000000000000 <= num && num <= 0x7FFFFFFFFFFFFFFF){
    this.bufferBuilder.append(0xd3);
    this.pack_int64(num);
  } else if (0x0000000000000000 <= num && num <= 0xFFFFFFFFFFFFFFFF){
    this.bufferBuilder.append(0xcf);
    this.pack_uint64(num);
  } else{
    throw new Error('Invalid integer');
  }
}

Packer.prototype.pack_double = function(num){
  var sign = 0;
  if (num < 0){
    sign = 1;
    num = -num;
  }
  var exp  = Math.floor(Math.log(num) / Math.LN2);
  var frac0 = num / Math.pow(2, exp) - 1;
  var frac1 = Math.floor(frac0 * Math.pow(2, 52));
  var b32   = Math.pow(2, 32);
  var h32 = (sign << 31) | ((exp+1023) << 20) |
      (frac1 / b32) & 0x0fffff;
  var l32 = frac1 % b32;
  this.bufferBuilder.append(0xcb);
  this.pack_int32(h32);
  this.pack_int32(l32);
}

Packer.prototype.pack_object = function(obj){
  var keys = Object.keys(obj);
  var length = keys.length;
  if (length <= 0x0f){
    this.pack_uint8(0x80 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xde);
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdf);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  for(var prop in obj){
    if (obj.hasOwnProperty(prop)){
      this.pack(prop);
      this.pack(obj[prop]);
    }
  }
}

Packer.prototype.pack_uint8 = function(num){
  this.bufferBuilder.append(num);
}

Packer.prototype.pack_uint16 = function(num){
  this.bufferBuilder.append(num >> 8);
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_uint32 = function(num){
  var n = num & 0xffffffff;
  this.bufferBuilder.append((n & 0xff000000) >>> 24);
  this.bufferBuilder.append((n & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((n & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((n & 0x000000ff));
}

Packer.prototype.pack_uint64 = function(num){
  var high = num / Math.pow(2, 32);
  var low  = num % Math.pow(2, 32);
  this.bufferBuilder.append((high & 0xff000000) >>> 24);
  this.bufferBuilder.append((high & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((high & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((high & 0x000000ff));
  this.bufferBuilder.append((low  & 0xff000000) >>> 24);
  this.bufferBuilder.append((low  & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((low  & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((low  & 0x000000ff));
}

Packer.prototype.pack_int8 = function(num){
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_int16 = function(num){
  this.bufferBuilder.append((num & 0xff00) >> 8);
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_int32 = function(num){
  this.bufferBuilder.append((num >>> 24) & 0xff);
  this.bufferBuilder.append((num & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((num & 0x0000ff00) >>> 8);
  this.bufferBuilder.append((num & 0x000000ff));
}

Packer.prototype.pack_int64 = function(num){
  var high = Math.floor(num / Math.pow(2, 32));
  var low  = num % Math.pow(2, 32);
  this.bufferBuilder.append((high & 0xff000000) >>> 24);
  this.bufferBuilder.append((high & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((high & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((high & 0x000000ff));
  this.bufferBuilder.append((low  & 0xff000000) >>> 24);
  this.bufferBuilder.append((low  & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((low  & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((low  & 0x000000ff));
}

function _utf8Replace(m){
  var code = m.charCodeAt(0);

  if(code <= 0x7ff) return '00';
  if(code <= 0xffff) return '000';
  if(code <= 0x1fffff) return '0000';
  if(code <= 0x3ffffff) return '00000';
  return '000000';
}

function utf8Length(str){
  if (str.length > 600) {
    // Blob method faster for large strings
    return (new Blob([str])).size;
  } else {
    return str.replace(/[^\u0000-\u007F]/g, _utf8Replace).length;
  }
}

},{"./bufferbuilder":12}],12:[function(require,module,exports){
var binaryFeatures = {};
binaryFeatures.useBlobBuilder = (function(){
  try {
    new Blob([]);
    return false;
  } catch (e) {
    return true;
  }
})();

binaryFeatures.useArrayBufferView = !binaryFeatures.useBlobBuilder && (function(){
  try {
    return (new Blob([new Uint8Array([])])).size === 0;
  } catch (e) {
    return true;
  }
})();

module.exports.binaryFeatures = binaryFeatures;
var BlobBuilder = module.exports.BlobBuilder;
if (typeof window != 'undefined') {
  BlobBuilder = module.exports.BlobBuilder = window.WebKitBlobBuilder ||
    window.MozBlobBuilder || window.MSBlobBuilder || window.BlobBuilder;
}

function BufferBuilder(){
  this._pieces = [];
  this._parts = [];
}

BufferBuilder.prototype.append = function(data) {
  if(typeof data === 'number') {
    this._pieces.push(data);
  } else {
    this.flush();
    this._parts.push(data);
  }
};

BufferBuilder.prototype.flush = function() {
  if (this._pieces.length > 0) {
    var buf = new Uint8Array(this._pieces);
    if(!binaryFeatures.useArrayBufferView) {
      buf = buf.buffer;
    }
    this._parts.push(buf);
    this._pieces = [];
  }
};

BufferBuilder.prototype.getBuffer = function() {
  this.flush();
  if(binaryFeatures.useBlobBuilder) {
    var builder = new BlobBuilder();
    for(var i = 0, ii = this._parts.length; i < ii; i++) {
      builder.append(this._parts[i]);
    }
    return builder.getBlob();
  } else {
    return new Blob(this._parts);
  }
};

module.exports.BufferBuilder = BufferBuilder;

},{}],13:[function(require,module,exports){
var util = require('./util');

/**
 * Reliable transfer for Chrome Canary DataChannel impl.
 * Author: @michellebu
 */
function Reliable(dc, debug) {
  if (!(this instanceof Reliable)) return new Reliable(dc);
  this._dc = dc;

  util.debug = debug;

  // Messages sent/received so far.
  // id: { ack: n, chunks: [...] }
  this._outgoing = {};
  // id: { ack: ['ack', id, n], chunks: [...] }
  this._incoming = {};
  this._received = {};

  // Window size.
  this._window = 1000;
  // MTU.
  this._mtu = 500;
  // Interval for setInterval. In ms.
  this._interval = 0;

  // Messages sent.
  this._count = 0;

  // Outgoing message queue.
  this._queue = [];

  this._setupDC();
};

// Send a message reliably.
Reliable.prototype.send = function(msg) {
  // Determine if chunking is necessary.
  var bl = util.pack(msg);
  if (bl.size < this._mtu) {
    this._handleSend(['no', bl]);
    return;
  }

  this._outgoing[this._count] = {
    ack: 0,
    chunks: this._chunk(bl)
  };

  if (util.debug) {
    this._outgoing[this._count].timer = new Date();
  }

  // Send prelim window.
  this._sendWindowedChunks(this._count);
  this._count += 1;
};

// Set up interval for processing queue.
Reliable.prototype._setupInterval = function() {
  // TODO: fail gracefully.

  var self = this;
  this._timeout = setInterval(function() {
    // FIXME: String stuff makes things terribly async.
    var msg = self._queue.shift();
    if (msg._multiple) {
      for (var i = 0, ii = msg.length; i < ii; i += 1) {
        self._intervalSend(msg[i]);
      }
    } else {
      self._intervalSend(msg);
    }
  }, this._interval);
};

Reliable.prototype._intervalSend = function(msg) {
  var self = this;
  msg = util.pack(msg);
  util.blobToBinaryString(msg, function(str) {
    self._dc.send(str);
  });
  if (self._queue.length === 0) {
    clearTimeout(self._timeout);
    self._timeout = null;
    //self._processAcks();
  }
};

// Go through ACKs to send missing pieces.
Reliable.prototype._processAcks = function() {
  for (var id in this._outgoing) {
    if (this._outgoing.hasOwnProperty(id)) {
      this._sendWindowedChunks(id);
    }
  }
};

// Handle sending a message.
// FIXME: Don't wait for interval time for all messages...
Reliable.prototype._handleSend = function(msg) {
  var push = true;
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    var item = this._queue[i];
    if (item === msg) {
      push = false;
    } else if (item._multiple && item.indexOf(msg) !== -1) {
      push = false;
    }
  }
  if (push) {
    this._queue.push(msg);
    if (!this._timeout) {
      this._setupInterval();
    }
  }
};

// Set up DataChannel handlers.
Reliable.prototype._setupDC = function() {
  // Handle various message types.
  var self = this;
  this._dc.onmessage = function(e) {
    var msg = e.data;
    var datatype = msg.constructor;
    // FIXME: msg is String until binary is supported.
    // Once that happens, this will have to be smarter.
    if (datatype === String) {
      var ab = util.binaryStringToArrayBuffer(msg);
      msg = util.unpack(ab);
      self._handleMessage(msg);
    }
  };
};

// Handles an incoming message.
Reliable.prototype._handleMessage = function(msg) {
  var id = msg[1];
  var idata = this._incoming[id];
  var odata = this._outgoing[id];
  var data;
  switch (msg[0]) {
    // No chunking was done.
    case 'no':
      var message = id;
      if (!!message) {
        this.onmessage(util.unpack(message));
      }
      break;
    // Reached the end of the message.
    case 'end':
      data = idata;

      // In case end comes first.
      this._received[id] = msg[2];

      if (!data) {
        break;
      }

      this._ack(id);
      break;
    case 'ack':
      data = odata;
      if (!!data) {
        var ack = msg[2];
        // Take the larger ACK, for out of order messages.
        data.ack = Math.max(ack, data.ack);

        // Clean up when all chunks are ACKed.
        if (data.ack >= data.chunks.length) {
          util.log('Time: ', new Date() - data.timer);
          delete this._outgoing[id];
        } else {
          this._processAcks();
        }
      }
      // If !data, just ignore.
      break;
    // Received a chunk of data.
    case 'chunk':
      // Create a new entry if none exists.
      data = idata;
      if (!data) {
        var end = this._received[id];
        if (end === true) {
          break;
        }
        data = {
          ack: ['ack', id, 0],
          chunks: []
        };
        this._incoming[id] = data;
      }

      var n = msg[2];
      var chunk = msg[3];
      data.chunks[n] = new Uint8Array(chunk);

      // If we get the chunk we're looking for, ACK for next missing.
      // Otherwise, ACK the same N again.
      if (n === data.ack[2]) {
        this._calculateNextAck(id);
      }
      this._ack(id);
      break;
    default:
      // Shouldn't happen, but would make sense for message to just go
      // through as is.
      this._handleSend(msg);
      break;
  }
};

// Chunks BL into smaller messages.
Reliable.prototype._chunk = function(bl) {
  var chunks = [];
  var size = bl.size;
  var start = 0;
  while (start < size) {
    var end = Math.min(size, start + this._mtu);
    var b = bl.slice(start, end);
    var chunk = {
      payload: b
    }
    chunks.push(chunk);
    start = end;
  }
  util.log('Created', chunks.length, 'chunks.');
  return chunks;
};

// Sends ACK N, expecting Nth blob chunk for message ID.
Reliable.prototype._ack = function(id) {
  var ack = this._incoming[id].ack;

  // if ack is the end value, then call _complete.
  if (this._received[id] === ack[2]) {
    this._complete(id);
    this._received[id] = true;
  }

  this._handleSend(ack);
};

// Calculates the next ACK number, given chunks.
Reliable.prototype._calculateNextAck = function(id) {
  var data = this._incoming[id];
  var chunks = data.chunks;
  for (var i = 0, ii = chunks.length; i < ii; i += 1) {
    // This chunk is missing!!! Better ACK for it.
    if (chunks[i] === undefined) {
      data.ack[2] = i;
      return;
    }
  }
  data.ack[2] = chunks.length;
};

// Sends the next window of chunks.
Reliable.prototype._sendWindowedChunks = function(id) {
  util.log('sendWindowedChunks for: ', id);
  var data = this._outgoing[id];
  var ch = data.chunks;
  var chunks = [];
  var limit = Math.min(data.ack + this._window, ch.length);
  for (var i = data.ack; i < limit; i += 1) {
    if (!ch[i].sent || i === data.ack) {
      ch[i].sent = true;
      chunks.push(['chunk', id, i, ch[i].payload]);
    }
  }
  if (data.ack + this._window >= ch.length) {
    chunks.push(['end', id, ch.length])
  }
  chunks._multiple = true;
  this._handleSend(chunks);
};

// Puts together a message from chunks.
Reliable.prototype._complete = function(id) {
  util.log('Completed called for', id);
  var self = this;
  var chunks = this._incoming[id].chunks;
  var bl = new Blob(chunks);
  util.blobToArrayBuffer(bl, function(ab) {
    self.onmessage(util.unpack(ab));
  });
  delete this._incoming[id];
};

// Ups bandwidth limit on SDP. Meant to be called during offer/answer.
Reliable.higherBandwidthSDP = function(sdp) {
  // AS stands for Application-Specific Maximum.
  // Bandwidth number is in kilobits / sec.
  // See RFC for more info: http://www.ietf.org/rfc/rfc2327.txt

  // Chrome 31+ doesn't want us munging the SDP, so we'll let them have their
  // way.
  var version = navigator.appVersion.match(/Chrome\/(.*?) /);
  if (version) {
    version = parseInt(version[1].split('.').shift());
    if (version < 31) {
      var parts = sdp.split('b=AS:30');
      var replace = 'b=AS:102400'; // 100 Mbps
      if (parts.length > 1) {
        return parts[0] + replace + parts[1];
      }
    }
  }

  return sdp;
};

// Overwritten, typically.
Reliable.prototype.onmessage = function(msg) {};

module.exports.Reliable = Reliable;

},{"./util":14}],14:[function(require,module,exports){
var BinaryPack = require('js-binarypack');

var util = {
  debug: false,
  
  inherits: function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  },
  extend: function(dest, source) {
    for(var key in source) {
      if(source.hasOwnProperty(key)) {
        dest[key] = source[key];
      }
    }
    return dest;
  },
  pack: BinaryPack.pack,
  unpack: BinaryPack.unpack,
  
  log: function () {
    if (util.debug) {
      var copy = [];
      for (var i = 0; i < arguments.length; i++) {
        copy[i] = arguments[i];
      }
      copy.unshift('Reliable: ');
      console.log.apply(console, copy);
    }
  },

  setZeroTimeout: (function(global) {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    // Like setTimeout, but only takes a function argument.	 There's
    // no time argument (always zero) and no arguments (you have to
    // use a closure).
    function setZeroTimeoutPostMessage(fn) {
      timeouts.push(fn);
      global.postMessage(messageName, '*');
    }		

    function handleMessage(event) {
      if (event.source == global && event.data == messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (timeouts.length) {
          timeouts.shift()();
        }
      }
    }
    if (global.addEventListener) {
      global.addEventListener('message', handleMessage, true);
    } else if (global.attachEvent) {
      global.attachEvent('onmessage', handleMessage);
    }
    return setZeroTimeoutPostMessage;
  }(this)),
  
  blobToArrayBuffer: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsArrayBuffer(blob);
  },
  blobToBinaryString: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsBinaryString(blob);
  },
  binaryStringToArrayBuffer: function(binary) {
    var byteArray = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i) & 0xff;
    }
    return byteArray.buffer;
  },
  randomToken: function () {
    return Math.random().toString(36).substr(2);
  }
};

module.exports = util;

},{"js-binarypack":11}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvb2phY2svY29kZS9MQU5EL2pzL1NsaXRTY2FuLmpzIiwiL1VzZXJzL29qYWNrL2NvZGUvTEFORC9tYWluLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9saWIvYWRhcHRlci5qcyIsIm5vZGVfbW9kdWxlcy9wZWVyanMvbGliL2RhdGFjb25uZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9saWIvbWVkaWFjb25uZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9saWIvbmVnb3RpYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9wZWVyanMvbGliL3BlZXIuanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL2xpYi9zb2NrZXQuanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9ub2RlX21vZHVsZXMvZXZlbnRlbWl0dGVyMy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wZWVyanMvbm9kZV9tb2R1bGVzL2pzLWJpbmFyeXBhY2svbGliL2JpbmFyeXBhY2suanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL25vZGVfbW9kdWxlcy9qcy1iaW5hcnlwYWNrL2xpYi9idWZmZXJidWlsZGVyLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9ub2RlX21vZHVsZXMvcmVsaWFibGUvbGliL3JlbGlhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9ub2RlX21vZHVsZXMvcmVsaWFibGUvbGliL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDakIsSUFBSSxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQ2pCLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNiLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQzs7QUFFakIsSUFBSSxRQUFRLEdBQUcsU0FBUyxLQUFLLENBQUMsQ0FBQztDQUM5QixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztDQUNqQixJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztDQUNsQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUNuQixJQUFJLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0NBQzlDLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUN2QyxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztDQUNwQixNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUNyQixRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztDQUM3RCxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDbEMsQ0FBQzs7QUFFRCxRQUFRLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7QUFDekM7O0VBRUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztFQUNuRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO01BQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztNQUM5QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7TUFDN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztNQUN0QixJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQztBQUM1QixNQUFNLElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDOztBQUVoQyxDQUFDLENBQUM7O0FBRUYsTUFBTSxDQUFDLE9BQU8sR0FBRyxRQUFROzs7QUM5QnpCLENBQUMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzlCLENBQUMsSUFBSSxRQUFRLEVBQUUsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUM7O0FBRTNDLElBQUksSUFBSSxDQUFDO0VBQ1AscUJBQXFCO0FBQ3ZCLElBQUksU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUMsWUFBWSxJQUFJLFNBQVMsQ0FBQyxrQkFBa0IsSUFBSSxTQUFTLENBQUMsZUFBZSxDQUFDOztJQUU3RyxnQkFBZ0I7QUFDcEIsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7SUFFekQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDO01BQ3pCLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2hDLEtBQUssQ0FBQyxDQUFDOztJQUVILG1CQUFtQjtBQUN2QixJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLFNBQVMsSUFBSSxDQUFDLENBQUM7O01BRTdCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO01BQ2hDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNiLENBQUMsQ0FBQztJQUNILElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDbkMsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDOztNQUVuQixLQUFLLEVBQUUsQ0FBQztBQUNkLEtBQUssQ0FBQyxDQUFDOztJQUVILHVCQUF1QjtJQUN2QixDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ2pCLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUM7O0FBRXZDLFFBQVEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDOztRQUVoRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEIsT0FBTyxDQUFDLENBQUM7O01BRUgsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUM7UUFDOUIsTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM1QixLQUFLLEVBQUUsQ0FBQztBQUNoQixPQUFPLENBQUMsQ0FBQztBQUNUOztNQUVNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN6QixLQUFLLEVBQUUsQ0FBQztBQUNoQixPQUFPLENBQUMsQ0FBQztBQUNUOztNQUVNLEtBQUssRUFBRSxDQUFDO0FBQ2QsS0FBSyxDQUFDLENBQUM7O0FBRVAsSUFBSSxTQUFTLEtBQUssSUFBSSxDQUFDOztBQUV2QixNQUFNLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxTQUFTLE1BQU0sQ0FBQyxDQUFDOztBQUUzRSxRQUFRLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzs7U0FFdkQsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztRQUM1QixLQUFLLEVBQUUsQ0FBQztRQUNSLE1BQU0sRUFBRSxDQUFDO09BQ1YsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbEQsS0FBSzs7QUFFTCxJQUFJLFNBQVMsTUFBTSxFQUFFLENBQUM7QUFDdEI7O1FBRVEsVUFBVSxDQUFDLFdBQVcsQ0FBQztRQUN2QixxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxTQUFTLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzs7S0FFcEIsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNYLEtBQUs7O0lBRUQsU0FBUyxLQUFLLElBQUksQ0FBQztNQUNqQixDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztNQUMzQixDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDekIsS0FBSzs7QUFFTCxJQUFJLFNBQVMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDOztNQUVyQixJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUU7UUFDdkIsTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUNwQyxPQUFPO0FBQ1A7O01BRU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxNQUFNLENBQUMsQ0FBQztBQUN6QyxRQUFRLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNuRTs7QUFFQSxPQUFPLENBQUMsQ0FBQztBQUNUOztNQUVNLE1BQU0sQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO01BQzNCLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO01BQy9CLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO01BQ3hCLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2pDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3pCOzs7OztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ROQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZnQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgV0lEVEggPSAxMDAwO1xudmFyIEhFSUdIVCA9IDUwMDtcbnZhciBTVEVQID0gMTtcbnZhciBWSURfU1RFUCA9IDE7XG5cbnZhciBTbGl0U2NhbiA9IGZ1bmN0aW9uKHZpZGVvKXtcblx0dGhpcy5vdXRJbmRleD0gMDtcblx0dGhpcy52aWRJbmRleCA9IDA7XG5cdHRoaXMudmlkZW8gPSB2aWRlbztcblx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHR0aGlzLmNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblx0Y2FudmFzLmhlaWdodCA9IDUwMDtcblx0Y2FudmFzLndpZHRoID0gV0lEVEg7XG5cdGRvY3VtZW50LmJvZHkuaW5zZXJ0QmVmb3JlKGNhbnZhcywgZG9jdW1lbnQuYm9keS5maXJzdENoaWxkKTtcblx0Y29uc29sZS5sb2coXCJjcmVhdGVkIHNsaXQgc2NhblwiKTtcbn1cblxuU2xpdFNjYW4ucHJvdG90eXBlLmFkZEZyYW1lID0gZnVuY3Rpb24oKXtcblx0Ly9jb25zb2xlLmxvZyh0aGlzLnZpZGVvKTtcblx0Ly9jb25zb2xlLmxvZyh0aGlzLmNvbnRleHQpO1xuXHQgdGhpcy5jb250ZXh0LmRyYXdJbWFnZSh0aGlzLnZpZGVvLCB0aGlzLnZpZEluZGV4LCAwLCBTVEVQLCBIRUlHSFQsIHRoaXMub3V0SW5kZXgsIDAsIFNURVAsIEhFSUdIVCk7XG5cdCB0aGlzLmNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmNvbnRleHQubW92ZVRvKDEwMCwgMTUwKTtcbiAgICAgIHRoaXMuY29udGV4dC5saW5lVG8oNDUwLCA1MCk7XG4gICAgICB0aGlzLmNvbnRleHQuc3Ryb2tlKCk7XG4gICAgICB0aGlzLm91dEluZGV4ICs9IFNURVA7XG4gICAgICB0aGlzLnZpZEluZGV4ICs9IFZJRF9TVEVQO1xuICAgIC8vICBjb25zb2xlLmxvZyhcInZpZCBpbmRleCBcIiArIHRoaXMudmlkSW5kZXggKyBcIiBvdXQgaW5kZXggXCIgKyB0aGlzLm91dEluZGV4KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2xpdFNjYW47IiwiIHZhciBQZWVyID0gcmVxdWlyZSgncGVlcmpzJyk7XG4gdmFyIFNsaXRTY2FuPSByZXF1aXJlKCcuL2pzL1NsaXRTY2FuLmpzJyk7XG5cbnZhciBzbGl0O1xuICAvLyBDb21wYXRpYmlsaXR5IHNoaW1cbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWE7XG5cbiAgICAvLyBQZWVySlMgb2JqZWN0XG4gICAgdmFyIHBlZXIgPSBuZXcgUGVlcih7IGtleTogJzAwZ3dqNzI2NTRtZmd2aScsIGRlYnVnOiAzfSk7XG5cbiAgICBwZWVyLm9uKCdvcGVuJywgZnVuY3Rpb24oKXtcbiAgICAgICQoJyNteS1pZCcpLnRleHQocGVlci5pZCk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWNlaXZpbmcgYSBjYWxsXG4gICAgcGVlci5vbignY2FsbCcsIGZ1bmN0aW9uKGNhbGwpe1xuICAgICAgLy8gQW5zd2VyIHRoZSBjYWxsIGF1dG9tYXRpY2FsbHkgKGluc3RlYWQgb2YgcHJvbXB0aW5nIHVzZXIpIGZvciBkZW1vIHB1cnBvc2VzXG4gICAgICBjYWxsLmFuc3dlcih3aW5kb3cubG9jYWxTdHJlYW0pO1xuICAgICAgc3RlcDMoY2FsbCk7XG4gICAgfSk7XG4gICAgcGVlci5vbignZXJyb3InLCBmdW5jdGlvbihlcnIpe1xuICAgICAgYWxlcnQoZXJyLm1lc3NhZ2UpO1xuICAgICAgLy8gUmV0dXJuIHRvIHN0ZXAgMiBpZiBlcnJvciBvY2N1cnNcbiAgICAgIHN0ZXAyKCk7XG4gICAgfSk7XG5cbiAgICAvLyBDbGljayBoYW5kbGVycyBzZXR1cFxuICAgICQoZnVuY3Rpb24oKXtcbiAgICAgICQoJyNtYWtlLWNhbGwnKS5jbGljayhmdW5jdGlvbigpe1xuICAgICAgICAvLyBJbml0aWF0ZSBhIGNhbGwhXG4gICAgICAgIHZhciBjYWxsID0gcGVlci5jYWxsKCQoJyNjYWxsdG8taWQnKS52YWwoKSwgd2luZG93LmxvY2FsU3RyZWFtKTtcblxuICAgICAgICBzdGVwMyhjYWxsKTtcbiAgICAgIH0pO1xuXG4gICAgICAkKCcjZW5kLWNhbGwnKS5jbGljayhmdW5jdGlvbigpe1xuICAgICAgICB3aW5kb3cuZXhpc3RpbmdDYWxsLmNsb3NlKCk7XG4gICAgICAgIHN0ZXAyKCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gUmV0cnkgaWYgZ2V0VXNlck1lZGlhIGZhaWxzXG4gICAgICAkKCcjc3RlcDEtcmV0cnknKS5jbGljayhmdW5jdGlvbigpe1xuICAgICAgICAkKCcjc3RlcDEtZXJyb3InKS5oaWRlKCk7XG4gICAgICAgIHN0ZXAxKCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gR2V0IHRoaW5ncyBzdGFydGVkXG4gICAgICBzdGVwMSgpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gc3RlcDEgKCkge1xuICAgICAgLy8gR2V0IGF1ZGlvL3ZpZGVvIHN0cmVhbVxuICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7YXVkaW86IGZhbHNlLCB2aWRlbzogdHJ1ZX0sIGZ1bmN0aW9uKHN0cmVhbSl7XG4gICAgICAgIC8vIFNldCB5b3VyIHZpZGVvIGRpc3BsYXlzXG4gICAgICAgICQoJyNteS12aWRlbycpLnByb3AoJ3NyYycsIFVSTC5jcmVhdGVPYmplY3RVUkwoc3RyZWFtKSk7XG4gICAgIFxuICAgICAgICAgc2xpdCA9IG5ldyBTbGl0U2Nhbihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbXktdmlkZW8nKSk7XG4gICAgICAgIHdpbmRvdy5sb2NhbFN0cmVhbSA9IHN0cmVhbTtcbiAgICAgICAgc3RlcDIoKTtcbiAgICAgICAgcmVuZGVyKCk7XG4gICAgICB9LCBmdW5jdGlvbigpeyAkKCcjc3RlcDEtZXJyb3InKS5zaG93KCk7IH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbmRlcigpe1xuICAgICBcbiAgICAgIFxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVuZGVyKTtcbiAgICAgICAgIHNsaXQuYWRkRnJhbWUoKTtcbiAgICAgICAgLy8gRHJhd2luZyBjb2RlIGdvZXMgaGVyZVxuICAgIH0sIDEwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGVwMiAoKSB7XG4gICAgICAkKCcjc3RlcDEsICNzdGVwMycpLmhpZGUoKTtcbiAgICAgICQoJyNzdGVwMicpLnNob3coKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGVwMyAoY2FsbCkge1xuICAgICAgLy8gSGFuZyB1cCBvbiBhbiBleGlzdGluZyBjYWxsIGlmIHByZXNlbnRcbiAgICAgIGlmICh3aW5kb3cuZXhpc3RpbmdDYWxsKSB7XG4gICAgICAgIHdpbmRvdy5leGlzdGluZ0NhbGwuY2xvc2UoKTtcbiAgICAgIH1cblxuICAgICAgLy8gV2FpdCBmb3Igc3RyZWFtIG9uIHRoZSBjYWxsLCB0aGVuIHNldCBwZWVyIHZpZGVvIGRpc3BsYXlcbiAgICAgIGNhbGwub24oJ3N0cmVhbScsIGZ1bmN0aW9uKHN0cmVhbSl7XG4gICAgICAgICQoJyN0aGVpci12aWRlbycpLnByb3AoJ3NyYycsIFVSTC5jcmVhdGVPYmplY3RVUkwoc3RyZWFtKSk7XG4gICAgICBcblxuICAgICAgfSk7XG5cbiAgICAgIC8vIFVJIHN0dWZmXG4gICAgICB3aW5kb3cuZXhpc3RpbmdDYWxsID0gY2FsbDtcbiAgICAgICQoJyN0aGVpci1pZCcpLnRleHQoY2FsbC5wZWVyKTtcbiAgICAgIGNhbGwub24oJ2Nsb3NlJywgc3RlcDIpO1xuICAgICAgJCgnI3N0ZXAxLCAjc3RlcDInKS5oaWRlKCk7XG4gICAgICAkKCcjc3RlcDMnKS5zaG93KCk7XG5cbiAgICAgIC8vICB2YXIgc2xpdCA9IG5ldyBTbGl0U2NhbigpO1xuICAgIH0iLCJtb2R1bGUuZXhwb3J0cy5SVENTZXNzaW9uRGVzY3JpcHRpb24gPSB3aW5kb3cuUlRDU2Vzc2lvbkRlc2NyaXB0aW9uIHx8XG5cdHdpbmRvdy5tb3pSVENTZXNzaW9uRGVzY3JpcHRpb247XG5tb2R1bGUuZXhwb3J0cy5SVENQZWVyQ29ubmVjdGlvbiA9IHdpbmRvdy5SVENQZWVyQ29ubmVjdGlvbiB8fFxuXHR3aW5kb3cubW96UlRDUGVlckNvbm5lY3Rpb24gfHwgd2luZG93LndlYmtpdFJUQ1BlZXJDb25uZWN0aW9uO1xubW9kdWxlLmV4cG9ydHMuUlRDSWNlQ2FuZGlkYXRlID0gd2luZG93LlJUQ0ljZUNhbmRpZGF0ZSB8fFxuXHR3aW5kb3cubW96UlRDSWNlQ2FuZGlkYXRlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIzJyk7XG52YXIgTmVnb3RpYXRvciA9IHJlcXVpcmUoJy4vbmVnb3RpYXRvcicpO1xudmFyIFJlbGlhYmxlID0gcmVxdWlyZSgncmVsaWFibGUnKTtcblxuLyoqXG4gKiBXcmFwcyBhIERhdGFDaGFubmVsIGJldHdlZW4gdHdvIFBlZXJzLlxuICovXG5mdW5jdGlvbiBEYXRhQ29ubmVjdGlvbihwZWVyLCBwcm92aWRlciwgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGF0YUNvbm5lY3Rpb24pKSByZXR1cm4gbmV3IERhdGFDb25uZWN0aW9uKHBlZXIsIHByb3ZpZGVyLCBvcHRpb25zKTtcbiAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgdGhpcy5vcHRpb25zID0gdXRpbC5leHRlbmQoe1xuICAgIHNlcmlhbGl6YXRpb246ICdiaW5hcnknLFxuICAgIHJlbGlhYmxlOiBmYWxzZVxuICB9LCBvcHRpb25zKTtcblxuICAvLyBDb25uZWN0aW9uIGlzIG5vdCBvcGVuIHlldC5cbiAgdGhpcy5vcGVuID0gZmFsc2U7XG4gIHRoaXMudHlwZSA9ICdkYXRhJztcbiAgdGhpcy5wZWVyID0gcGVlcjtcbiAgdGhpcy5wcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gIHRoaXMuaWQgPSB0aGlzLm9wdGlvbnMuY29ubmVjdGlvbklkIHx8IERhdGFDb25uZWN0aW9uLl9pZFByZWZpeCArIHV0aWwucmFuZG9tVG9rZW4oKTtcblxuICB0aGlzLmxhYmVsID0gdGhpcy5vcHRpb25zLmxhYmVsIHx8IHRoaXMuaWQ7XG4gIHRoaXMubWV0YWRhdGEgPSB0aGlzLm9wdGlvbnMubWV0YWRhdGE7XG4gIHRoaXMuc2VyaWFsaXphdGlvbiA9IHRoaXMub3B0aW9ucy5zZXJpYWxpemF0aW9uO1xuICB0aGlzLnJlbGlhYmxlID0gdGhpcy5vcHRpb25zLnJlbGlhYmxlO1xuXG4gIC8vIERhdGEgY2hhbm5lbCBidWZmZXJpbmcuXG4gIHRoaXMuX2J1ZmZlciA9IFtdO1xuICB0aGlzLl9idWZmZXJpbmcgPSBmYWxzZTtcbiAgdGhpcy5idWZmZXJTaXplID0gMDtcblxuICAvLyBGb3Igc3RvcmluZyBsYXJnZSBkYXRhLlxuICB0aGlzLl9jaHVua2VkRGF0YSA9IHt9O1xuXG4gIGlmICh0aGlzLm9wdGlvbnMuX3BheWxvYWQpIHtcbiAgICB0aGlzLl9wZWVyQnJvd3NlciA9IHRoaXMub3B0aW9ucy5fcGF5bG9hZC5icm93c2VyO1xuICB9XG5cbiAgTmVnb3RpYXRvci5zdGFydENvbm5lY3Rpb24oXG4gICAgdGhpcyxcbiAgICB0aGlzLm9wdGlvbnMuX3BheWxvYWQgfHwge1xuICAgICAgb3JpZ2luYXRvcjogdHJ1ZVxuICAgIH1cbiAgKTtcbn1cblxudXRpbC5pbmhlcml0cyhEYXRhQ29ubmVjdGlvbiwgRXZlbnRFbWl0dGVyKTtcblxuRGF0YUNvbm5lY3Rpb24uX2lkUHJlZml4ID0gJ2RjXyc7XG5cbi8qKiBDYWxsZWQgYnkgdGhlIE5lZ290aWF0b3Igd2hlbiB0aGUgRGF0YUNoYW5uZWwgaXMgcmVhZHkuICovXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKGRjKSB7XG4gIHRoaXMuX2RjID0gdGhpcy5kYXRhQ2hhbm5lbCA9IGRjO1xuICB0aGlzLl9jb25maWd1cmVEYXRhQ2hhbm5lbCgpO1xufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX2NvbmZpZ3VyZURhdGFDaGFubmVsID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKHV0aWwuc3VwcG9ydHMuc2N0cCkge1xuICAgIHRoaXMuX2RjLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICB9XG4gIHRoaXMuX2RjLm9ub3BlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHV0aWwubG9nKCdEYXRhIGNoYW5uZWwgY29ubmVjdGlvbiBzdWNjZXNzJyk7XG4gICAgc2VsZi5vcGVuID0gdHJ1ZTtcbiAgICBzZWxmLmVtaXQoJ29wZW4nKTtcbiAgfVxuXG4gIC8vIFVzZSB0aGUgUmVsaWFibGUgc2hpbSBmb3Igbm9uIEZpcmVmb3ggYnJvd3NlcnNcbiAgaWYgKCF1dGlsLnN1cHBvcnRzLnNjdHAgJiYgdGhpcy5yZWxpYWJsZSkge1xuICAgIHRoaXMuX3JlbGlhYmxlID0gbmV3IFJlbGlhYmxlKHRoaXMuX2RjLCB1dGlsLmRlYnVnKTtcbiAgfVxuXG4gIGlmICh0aGlzLl9yZWxpYWJsZSkge1xuICAgIHRoaXMuX3JlbGlhYmxlLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgc2VsZi5lbWl0KCdkYXRhJywgbXNnKTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHRoaXMuX2RjLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIHNlbGYuX2hhbmRsZURhdGFNZXNzYWdlKGUpO1xuICAgIH07XG4gIH1cbiAgdGhpcy5fZGMub25jbG9zZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICB1dGlsLmxvZygnRGF0YUNoYW5uZWwgY2xvc2VkIGZvcjonLCBzZWxmLnBlZXIpO1xuICAgIHNlbGYuY2xvc2UoKTtcbiAgfTtcbn1cblxuLy8gSGFuZGxlcyBhIERhdGFDaGFubmVsIG1lc3NhZ2UuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX2hhbmRsZURhdGFNZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBkYXRhID0gZS5kYXRhO1xuICB2YXIgZGF0YXR5cGUgPSBkYXRhLmNvbnN0cnVjdG9yO1xuICBpZiAodGhpcy5zZXJpYWxpemF0aW9uID09PSAnYmluYXJ5JyB8fCB0aGlzLnNlcmlhbGl6YXRpb24gPT09ICdiaW5hcnktdXRmOCcpIHtcbiAgICBpZiAoZGF0YXR5cGUgPT09IEJsb2IpIHtcbiAgICAgIC8vIERhdGF0eXBlIHNob3VsZCBuZXZlciBiZSBibG9iXG4gICAgICB1dGlsLmJsb2JUb0FycmF5QnVmZmVyKGRhdGEsIGZ1bmN0aW9uKGFiKSB7XG4gICAgICAgIGRhdGEgPSB1dGlsLnVucGFjayhhYik7XG4gICAgICAgIHNlbGYuZW1pdCgnZGF0YScsIGRhdGEpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChkYXRhdHlwZSA9PT0gQXJyYXlCdWZmZXIpIHtcbiAgICAgIGRhdGEgPSB1dGlsLnVucGFjayhkYXRhKTtcbiAgICB9IGVsc2UgaWYgKGRhdGF0eXBlID09PSBTdHJpbmcpIHtcbiAgICAgIC8vIFN0cmluZyBmYWxsYmFjayBmb3IgYmluYXJ5IGRhdGEgZm9yIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBiaW5hcnkgeWV0XG4gICAgICB2YXIgYWIgPSB1dGlsLmJpbmFyeVN0cmluZ1RvQXJyYXlCdWZmZXIoZGF0YSk7XG4gICAgICBkYXRhID0gdXRpbC51bnBhY2soYWIpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0aGlzLnNlcmlhbGl6YXRpb24gPT09ICdqc29uJykge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICB9XG5cbiAgLy8gQ2hlY2sgaWYgd2UndmUgY2h1bmtlZC0taWYgc28sIHBpZWNlIHRoaW5ncyBiYWNrIHRvZ2V0aGVyLlxuICAvLyBXZSdyZSBndWFyYW50ZWVkIHRoYXQgdGhpcyBpc24ndCAwLlxuICBpZiAoZGF0YS5fX3BlZXJEYXRhKSB7XG4gICAgdmFyIGlkID0gZGF0YS5fX3BlZXJEYXRhO1xuICAgIHZhciBjaHVua0luZm8gPSB0aGlzLl9jaHVua2VkRGF0YVtpZF0gfHwge2RhdGE6IFtdLCBjb3VudDogMCwgdG90YWw6IGRhdGEudG90YWx9O1xuXG4gICAgY2h1bmtJbmZvLmRhdGFbZGF0YS5uXSA9IGRhdGEuZGF0YTtcbiAgICBjaHVua0luZm8uY291bnQgKz0gMTtcblxuICAgIGlmIChjaHVua0luZm8udG90YWwgPT09IGNodW5rSW5mby5jb3VudCkge1xuICAgICAgLy8gQ2xlYW4gdXAgYmVmb3JlIG1ha2luZyB0aGUgcmVjdXJzaXZlIGNhbGwgdG8gYF9oYW5kbGVEYXRhTWVzc2FnZWAuXG4gICAgICBkZWxldGUgdGhpcy5fY2h1bmtlZERhdGFbaWRdO1xuXG4gICAgICAvLyBXZSd2ZSByZWNlaXZlZCBhbGwgdGhlIGNodW5rcy0tdGltZSB0byBjb25zdHJ1Y3QgdGhlIGNvbXBsZXRlIGRhdGEuXG4gICAgICBkYXRhID0gbmV3IEJsb2IoY2h1bmtJbmZvLmRhdGEpO1xuICAgICAgdGhpcy5faGFuZGxlRGF0YU1lc3NhZ2Uoe2RhdGE6IGRhdGF9KTtcbiAgICB9XG5cbiAgICB0aGlzLl9jaHVua2VkRGF0YVtpZF0gPSBjaHVua0luZm87XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5lbWl0KCdkYXRhJywgZGF0YSk7XG59XG5cbi8qKlxuICogRXhwb3NlZCBmdW5jdGlvbmFsaXR5IGZvciB1c2Vycy5cbiAqL1xuXG4vKiogQWxsb3dzIHVzZXIgdG8gY2xvc2UgY29ubmVjdGlvbi4gKi9cbkRhdGFDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMub3Blbikge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgTmVnb3RpYXRvci5jbGVhbnVwKHRoaXMpO1xuICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG59XG5cbi8qKiBBbGxvd3MgdXNlciB0byBzZW5kIGRhdGEuICovXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGRhdGEsIGNodW5rZWQpIHtcbiAgaWYgKCF0aGlzLm9wZW4pIHtcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDb25uZWN0aW9uIGlzIG5vdCBvcGVuLiBZb3Ugc2hvdWxkIGxpc3RlbiBmb3IgdGhlIGBvcGVuYCBldmVudCBiZWZvcmUgc2VuZGluZyBtZXNzYWdlcy4nKSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLl9yZWxpYWJsZSkge1xuICAgIC8vIE5vdGU6IHJlbGlhYmxlIHNoaW0gc2VuZGluZyB3aWxsIG1ha2UgaXQgc28gdGhhdCB5b3UgY2Fubm90IGN1c3RvbWl6ZVxuICAgIC8vIHNlcmlhbGl6YXRpb24uXG4gICAgdGhpcy5fcmVsaWFibGUuc2VuZChkYXRhKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAodGhpcy5zZXJpYWxpemF0aW9uID09PSAnanNvbicpIHtcbiAgICB0aGlzLl9idWZmZXJlZFNlbmQoSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICB9IGVsc2UgaWYgKHRoaXMuc2VyaWFsaXphdGlvbiA9PT0gJ2JpbmFyeScgfHwgdGhpcy5zZXJpYWxpemF0aW9uID09PSAnYmluYXJ5LXV0ZjgnKSB7XG4gICAgdmFyIGJsb2IgPSB1dGlsLnBhY2soZGF0YSk7XG5cbiAgICAvLyBGb3IgQ2hyb21lLUZpcmVmb3ggaW50ZXJvcGVyYWJpbGl0eSwgd2UgbmVlZCB0byBtYWtlIEZpcmVmb3ggXCJjaHVua1wiXG4gICAgLy8gdGhlIGRhdGEgaXQgc2VuZHMgb3V0LlxuICAgIHZhciBuZWVkc0NodW5raW5nID0gdXRpbC5jaHVua2VkQnJvd3NlcnNbdGhpcy5fcGVlckJyb3dzZXJdIHx8IHV0aWwuY2h1bmtlZEJyb3dzZXJzW3V0aWwuYnJvd3Nlcl07XG4gICAgaWYgKG5lZWRzQ2h1bmtpbmcgJiYgIWNodW5rZWQgJiYgYmxvYi5zaXplID4gdXRpbC5jaHVua2VkTVRVKSB7XG4gICAgICB0aGlzLl9zZW5kQ2h1bmtzKGJsb2IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIERhdGFDaGFubmVsIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIHN0cmluZ3MuXG4gICAgaWYgKCF1dGlsLnN1cHBvcnRzLnNjdHApIHtcbiAgICAgIHV0aWwuYmxvYlRvQmluYXJ5U3RyaW5nKGJsb2IsIGZ1bmN0aW9uKHN0cikge1xuICAgICAgICBzZWxmLl9idWZmZXJlZFNlbmQoc3RyKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoIXV0aWwuc3VwcG9ydHMuYmluYXJ5QmxvYikge1xuICAgICAgLy8gV2Ugb25seSBkbyB0aGlzIGlmIHdlIHJlYWxseSBuZWVkIHRvIChlLmcuIGJsb2JzIGFyZSBub3Qgc3VwcG9ydGVkKSxcbiAgICAgIC8vIGJlY2F1c2UgdGhpcyBjb252ZXJzaW9uIGlzIGNvc3RseS5cbiAgICAgIHV0aWwuYmxvYlRvQXJyYXlCdWZmZXIoYmxvYiwgZnVuY3Rpb24oYWIpIHtcbiAgICAgICAgc2VsZi5fYnVmZmVyZWRTZW5kKGFiKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9idWZmZXJlZFNlbmQoYmxvYik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2J1ZmZlcmVkU2VuZChkYXRhKTtcbiAgfVxufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX2J1ZmZlcmVkU2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICBpZiAodGhpcy5fYnVmZmVyaW5nIHx8ICF0aGlzLl90cnlTZW5kKG1zZykpIHtcbiAgICB0aGlzLl9idWZmZXIucHVzaChtc2cpO1xuICAgIHRoaXMuYnVmZmVyU2l6ZSA9IHRoaXMuX2J1ZmZlci5sZW5ndGg7XG4gIH1cbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBzZW5kIHN1Y2NlZWRzLlxuRGF0YUNvbm5lY3Rpb24ucHJvdG90eXBlLl90cnlTZW5kID0gZnVuY3Rpb24obXNnKSB7XG4gIHRyeSB7XG4gICAgdGhpcy5fZGMuc2VuZChtc2cpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhpcy5fYnVmZmVyaW5nID0gdHJ1ZTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgLy8gVHJ5IGFnYWluLlxuICAgICAgc2VsZi5fYnVmZmVyaW5nID0gZmFsc2U7XG4gICAgICBzZWxmLl90cnlCdWZmZXIoKTtcbiAgICB9LCAxMDApO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gVHJ5IHRvIHNlbmQgdGhlIGZpcnN0IG1lc3NhZ2UgaW4gdGhlIGJ1ZmZlci5cbkRhdGFDb25uZWN0aW9uLnByb3RvdHlwZS5fdHJ5QnVmZmVyID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9idWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG1zZyA9IHRoaXMuX2J1ZmZlclswXTtcblxuICBpZiAodGhpcy5fdHJ5U2VuZChtc2cpKSB7XG4gICAgdGhpcy5fYnVmZmVyLnNoaWZ0KCk7XG4gICAgdGhpcy5idWZmZXJTaXplID0gdGhpcy5fYnVmZmVyLmxlbmd0aDtcbiAgICB0aGlzLl90cnlCdWZmZXIoKTtcbiAgfVxufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX3NlbmRDaHVua3MgPSBmdW5jdGlvbihibG9iKSB7XG4gIHZhciBibG9icyA9IHV0aWwuY2h1bmsoYmxvYik7XG4gIGZvciAodmFyIGkgPSAwLCBpaSA9IGJsb2JzLmxlbmd0aDsgaSA8IGlpOyBpICs9IDEpIHtcbiAgICB2YXIgYmxvYiA9IGJsb2JzW2ldO1xuICAgIHRoaXMuc2VuZChibG9iLCB0cnVlKTtcbiAgfVxufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHBheWxvYWQgPSBtZXNzYWdlLnBheWxvYWQ7XG5cbiAgc3dpdGNoIChtZXNzYWdlLnR5cGUpIHtcbiAgICBjYXNlICdBTlNXRVInOlxuICAgICAgdGhpcy5fcGVlckJyb3dzZXIgPSBwYXlsb2FkLmJyb3dzZXI7XG5cbiAgICAgIC8vIEZvcndhcmQgdG8gbmVnb3RpYXRvclxuICAgICAgTmVnb3RpYXRvci5oYW5kbGVTRFAobWVzc2FnZS50eXBlLCB0aGlzLCBwYXlsb2FkLnNkcCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdDQU5ESURBVEUnOlxuICAgICAgTmVnb3RpYXRvci5oYW5kbGVDYW5kaWRhdGUodGhpcywgcGF5bG9hZC5jYW5kaWRhdGUpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHV0aWwud2FybignVW5yZWNvZ25pemVkIG1lc3NhZ2UgdHlwZTonLCBtZXNzYWdlLnR5cGUsICdmcm9tIHBlZXI6JywgdGhpcy5wZWVyKTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRGF0YUNvbm5lY3Rpb247XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjMnKTtcbnZhciBOZWdvdGlhdG9yID0gcmVxdWlyZSgnLi9uZWdvdGlhdG9yJyk7XG5cbi8qKlxuICogV3JhcHMgdGhlIHN0cmVhbWluZyBpbnRlcmZhY2UgYmV0d2VlbiB0d28gUGVlcnMuXG4gKi9cbmZ1bmN0aW9uIE1lZGlhQ29ubmVjdGlvbihwZWVyLCBwcm92aWRlciwgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTWVkaWFDb25uZWN0aW9uKSkgcmV0dXJuIG5ldyBNZWRpYUNvbm5lY3Rpb24ocGVlciwgcHJvdmlkZXIsIG9wdGlvbnMpO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICB0aGlzLm9wdGlvbnMgPSB1dGlsLmV4dGVuZCh7fSwgb3B0aW9ucyk7XG5cbiAgdGhpcy5vcGVuID0gZmFsc2U7XG4gIHRoaXMudHlwZSA9ICdtZWRpYSc7XG4gIHRoaXMucGVlciA9IHBlZXI7XG4gIHRoaXMucHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgdGhpcy5tZXRhZGF0YSA9IHRoaXMub3B0aW9ucy5tZXRhZGF0YTtcbiAgdGhpcy5sb2NhbFN0cmVhbSA9IHRoaXMub3B0aW9ucy5fc3RyZWFtO1xuXG4gIHRoaXMuaWQgPSB0aGlzLm9wdGlvbnMuY29ubmVjdGlvbklkIHx8IE1lZGlhQ29ubmVjdGlvbi5faWRQcmVmaXggKyB1dGlsLnJhbmRvbVRva2VuKCk7XG4gIGlmICh0aGlzLmxvY2FsU3RyZWFtKSB7XG4gICAgTmVnb3RpYXRvci5zdGFydENvbm5lY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAge19zdHJlYW06IHRoaXMubG9jYWxTdHJlYW0sIG9yaWdpbmF0b3I6IHRydWV9XG4gICAgKTtcbiAgfVxufTtcblxudXRpbC5pbmhlcml0cyhNZWRpYUNvbm5lY3Rpb24sIEV2ZW50RW1pdHRlcik7XG5cbk1lZGlhQ29ubmVjdGlvbi5faWRQcmVmaXggPSAnbWNfJztcblxuTWVkaWFDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihyZW1vdGVTdHJlYW0pIHtcbiAgdXRpbC5sb2coJ1JlY2VpdmluZyBzdHJlYW0nLCByZW1vdGVTdHJlYW0pO1xuXG4gIHRoaXMucmVtb3RlU3RyZWFtID0gcmVtb3RlU3RyZWFtO1xuICB0aGlzLmVtaXQoJ3N0cmVhbScsIHJlbW90ZVN0cmVhbSk7IC8vIFNob3VsZCB3ZSBjYWxsIHRoaXMgYG9wZW5gP1xuXG59O1xuXG5NZWRpYUNvbm5lY3Rpb24ucHJvdG90eXBlLmhhbmRsZU1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciBwYXlsb2FkID0gbWVzc2FnZS5wYXlsb2FkO1xuXG4gIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgY2FzZSAnQU5TV0VSJzpcbiAgICAgIC8vIEZvcndhcmQgdG8gbmVnb3RpYXRvclxuICAgICAgTmVnb3RpYXRvci5oYW5kbGVTRFAobWVzc2FnZS50eXBlLCB0aGlzLCBwYXlsb2FkLnNkcCk7XG4gICAgICB0aGlzLm9wZW4gPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQ0FORElEQVRFJzpcbiAgICAgIE5lZ290aWF0b3IuaGFuZGxlQ2FuZGlkYXRlKHRoaXMsIHBheWxvYWQuY2FuZGlkYXRlKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB1dGlsLndhcm4oJ1VucmVjb2duaXplZCBtZXNzYWdlIHR5cGU6JywgbWVzc2FnZS50eXBlLCAnZnJvbSBwZWVyOicsIHRoaXMucGVlcik7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG5NZWRpYUNvbm5lY3Rpb24ucHJvdG90eXBlLmFuc3dlciA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICBpZiAodGhpcy5sb2NhbFN0cmVhbSkge1xuICAgIHV0aWwud2FybignTG9jYWwgc3RyZWFtIGFscmVhZHkgZXhpc3RzIG9uIHRoaXMgTWVkaWFDb25uZWN0aW9uLiBBcmUgeW91IGFuc3dlcmluZyBhIGNhbGwgdHdpY2U/Jyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5vcHRpb25zLl9wYXlsb2FkLl9zdHJlYW0gPSBzdHJlYW07XG5cbiAgdGhpcy5sb2NhbFN0cmVhbSA9IHN0cmVhbTtcbiAgTmVnb3RpYXRvci5zdGFydENvbm5lY3Rpb24oXG4gICAgdGhpcyxcbiAgICB0aGlzLm9wdGlvbnMuX3BheWxvYWRcbiAgKVxuICAvLyBSZXRyaWV2ZSBsb3N0IG1lc3NhZ2VzIHN0b3JlZCBiZWNhdXNlIFBlZXJDb25uZWN0aW9uIG5vdCBzZXQgdXAuXG4gIHZhciBtZXNzYWdlcyA9IHRoaXMucHJvdmlkZXIuX2dldE1lc3NhZ2VzKHRoaXMuaWQpO1xuICBmb3IgKHZhciBpID0gMCwgaWkgPSBtZXNzYWdlcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgdGhpcy5oYW5kbGVNZXNzYWdlKG1lc3NhZ2VzW2ldKTtcbiAgfVxuICB0aGlzLm9wZW4gPSB0cnVlO1xufTtcblxuLyoqXG4gKiBFeHBvc2VkIGZ1bmN0aW9uYWxpdHkgZm9yIHVzZXJzLlxuICovXG5cbi8qKiBBbGxvd3MgdXNlciB0byBjbG9zZSBjb25uZWN0aW9uLiAqL1xuTWVkaWFDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMub3Blbikge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgTmVnb3RpYXRvci5jbGVhbnVwKHRoaXMpO1xuICB0aGlzLmVtaXQoJ2Nsb3NlJylcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWVkaWFDb25uZWN0aW9uO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBSVENQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vYWRhcHRlcicpLlJUQ1BlZXJDb25uZWN0aW9uO1xudmFyIFJUQ1Nlc3Npb25EZXNjcmlwdGlvbiA9IHJlcXVpcmUoJy4vYWRhcHRlcicpLlJUQ1Nlc3Npb25EZXNjcmlwdGlvbjtcbnZhciBSVENJY2VDYW5kaWRhdGUgPSByZXF1aXJlKCcuL2FkYXB0ZXInKS5SVENJY2VDYW5kaWRhdGU7XG5cbi8qKlxuICogTWFuYWdlcyBhbGwgbmVnb3RpYXRpb25zIGJldHdlZW4gUGVlcnMuXG4gKi9cbnZhciBOZWdvdGlhdG9yID0ge1xuICBwY3M6IHtcbiAgICBkYXRhOiB7fSxcbiAgICBtZWRpYToge31cbiAgfSwgLy8gdHlwZSA9PiB7cGVlcklkOiB7cGNfaWQ6IHBjfX0uXG4gIC8vcHJvdmlkZXJzOiB7fSwgLy8gcHJvdmlkZXIncyBpZCA9PiBwcm92aWRlcnMgKHRoZXJlIG1heSBiZSBtdWx0aXBsZSBwcm92aWRlcnMvY2xpZW50LlxuICBxdWV1ZTogW10gLy8gY29ubmVjdGlvbnMgdGhhdCBhcmUgZGVsYXllZCBkdWUgdG8gYSBQQyBiZWluZyBpbiB1c2UuXG59XG5cbk5lZ290aWF0b3IuX2lkUHJlZml4ID0gJ3BjXyc7XG5cbi8qKiBSZXR1cm5zIGEgUGVlckNvbm5lY3Rpb24gb2JqZWN0IHNldCB1cCBjb3JyZWN0bHkgKGZvciBkYXRhLCBtZWRpYSkuICovXG5OZWdvdGlhdG9yLnN0YXJ0Q29ubmVjdGlvbiA9IGZ1bmN0aW9uKGNvbm5lY3Rpb24sIG9wdGlvbnMpIHtcbiAgdmFyIHBjID0gTmVnb3RpYXRvci5fZ2V0UGVlckNvbm5lY3Rpb24oY29ubmVjdGlvbiwgb3B0aW9ucyk7XG5cbiAgaWYgKGNvbm5lY3Rpb24udHlwZSA9PT0gJ21lZGlhJyAmJiBvcHRpb25zLl9zdHJlYW0pIHtcbiAgICAvLyBBZGQgdGhlIHN0cmVhbS5cbiAgICBwYy5hZGRTdHJlYW0ob3B0aW9ucy5fc3RyZWFtKTtcbiAgfVxuXG4gIC8vIFNldCB0aGUgY29ubmVjdGlvbidzIFBDLlxuICBjb25uZWN0aW9uLnBjID0gY29ubmVjdGlvbi5wZWVyQ29ubmVjdGlvbiA9IHBjO1xuICAvLyBXaGF0IGRvIHdlIG5lZWQgdG8gZG8gbm93P1xuICBpZiAob3B0aW9ucy5vcmlnaW5hdG9yKSB7XG4gICAgaWYgKGNvbm5lY3Rpb24udHlwZSA9PT0gJ2RhdGEnKSB7XG4gICAgICAvLyBDcmVhdGUgdGhlIGRhdGFjaGFubmVsLlxuICAgICAgdmFyIGNvbmZpZyA9IHt9O1xuICAgICAgLy8gRHJvcHBpbmcgcmVsaWFibGU6ZmFsc2Ugc3VwcG9ydCwgc2luY2UgaXQgc2VlbXMgdG8gYmUgY3Jhc2hpbmdcbiAgICAgIC8vIENocm9tZS5cbiAgICAgIC8qaWYgKHV0aWwuc3VwcG9ydHMuc2N0cCAmJiAhb3B0aW9ucy5yZWxpYWJsZSkge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIGNhbm9uaWNhbCByZWxpYWJsZSBzdXBwb3J0Li4uXG4gICAgICAgIGNvbmZpZyA9IHttYXhSZXRyYW5zbWl0czogMH07XG4gICAgICB9Ki9cbiAgICAgIC8vIEZhbGxiYWNrIHRvIGVuc3VyZSBvbGRlciBicm93c2VycyBkb24ndCBjcmFzaC5cbiAgICAgIGlmICghdXRpbC5zdXBwb3J0cy5zY3RwKSB7XG4gICAgICAgIGNvbmZpZyA9IHtyZWxpYWJsZTogb3B0aW9ucy5yZWxpYWJsZX07XG4gICAgICB9XG4gICAgICB2YXIgZGMgPSBwYy5jcmVhdGVEYXRhQ2hhbm5lbChjb25uZWN0aW9uLmxhYmVsLCBjb25maWcpO1xuICAgICAgY29ubmVjdGlvbi5pbml0aWFsaXplKGRjKTtcbiAgICB9XG5cbiAgICBpZiAoIXV0aWwuc3VwcG9ydHMub25uZWdvdGlhdGlvbm5lZWRlZCkge1xuICAgICAgTmVnb3RpYXRvci5fbWFrZU9mZmVyKGNvbm5lY3Rpb24pO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBOZWdvdGlhdG9yLmhhbmRsZVNEUCgnT0ZGRVInLCBjb25uZWN0aW9uLCBvcHRpb25zLnNkcCk7XG4gIH1cbn1cblxuTmVnb3RpYXRvci5fZ2V0UGVlckNvbm5lY3Rpb24gPSBmdW5jdGlvbihjb25uZWN0aW9uLCBvcHRpb25zKSB7XG4gIGlmICghTmVnb3RpYXRvci5wY3NbY29ubmVjdGlvbi50eXBlXSkge1xuICAgIHV0aWwuZXJyb3IoY29ubmVjdGlvbi50eXBlICsgJyBpcyBub3QgYSB2YWxpZCBjb25uZWN0aW9uIHR5cGUuIE1heWJlIHlvdSBvdmVycm9kZSB0aGUgYHR5cGVgIHByb3BlcnR5IHNvbWV3aGVyZS4nKTtcbiAgfVxuXG4gIGlmICghTmVnb3RpYXRvci5wY3NbY29ubmVjdGlvbi50eXBlXVtjb25uZWN0aW9uLnBlZXJdKSB7XG4gICAgTmVnb3RpYXRvci5wY3NbY29ubmVjdGlvbi50eXBlXVtjb25uZWN0aW9uLnBlZXJdID0ge307XG4gIH1cbiAgdmFyIHBlZXJDb25uZWN0aW9ucyA9IE5lZ290aWF0b3IucGNzW2Nvbm5lY3Rpb24udHlwZV1bY29ubmVjdGlvbi5wZWVyXTtcblxuICB2YXIgcGM7XG4gIC8vIE5vdCBtdWx0aXBsZXhpbmcgd2hpbGUgRkYgYW5kIENocm9tZSBoYXZlIG5vdC1ncmVhdCBzdXBwb3J0IGZvciBpdC5cbiAgLyppZiAob3B0aW9ucy5tdWx0aXBsZXgpIHtcbiAgICBpZHMgPSBPYmplY3Qua2V5cyhwZWVyQ29ubmVjdGlvbnMpO1xuICAgIGZvciAodmFyIGkgPSAwLCBpaSA9IGlkcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgICBwYyA9IHBlZXJDb25uZWN0aW9uc1tpZHNbaV1dO1xuICAgICAgaWYgKHBjLnNpZ25hbGluZ1N0YXRlID09PSAnc3RhYmxlJykge1xuICAgICAgICBicmVhazsgLy8gV2UgY2FuIGdvIGFoZWFkIGFuZCB1c2UgdGhpcyBQQy5cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSAqL1xuICBpZiAob3B0aW9ucy5wYykgeyAvLyBTaW1wbGVzdCBjYXNlOiBQQyBpZCBhbHJlYWR5IHByb3ZpZGVkIGZvciB1cy5cbiAgICBwYyA9IE5lZ290aWF0b3IucGNzW2Nvbm5lY3Rpb24udHlwZV1bY29ubmVjdGlvbi5wZWVyXVtvcHRpb25zLnBjXTtcbiAgfVxuXG4gIGlmICghcGMgfHwgcGMuc2lnbmFsaW5nU3RhdGUgIT09ICdzdGFibGUnKSB7XG4gICAgcGMgPSBOZWdvdGlhdG9yLl9zdGFydFBlZXJDb25uZWN0aW9uKGNvbm5lY3Rpb24pO1xuICB9XG4gIHJldHVybiBwYztcbn1cblxuLypcbk5lZ290aWF0b3IuX2FkZFByb3ZpZGVyID0gZnVuY3Rpb24ocHJvdmlkZXIpIHtcbiAgaWYgKCghcHJvdmlkZXIuaWQgJiYgIXByb3ZpZGVyLmRpc2Nvbm5lY3RlZCkgfHwgIXByb3ZpZGVyLnNvY2tldC5vcGVuKSB7XG4gICAgLy8gV2FpdCBmb3IgcHJvdmlkZXIgdG8gb2J0YWluIGFuIElELlxuICAgIHByb3ZpZGVyLm9uKCdvcGVuJywgZnVuY3Rpb24oaWQpIHtcbiAgICAgIE5lZ290aWF0b3IuX2FkZFByb3ZpZGVyKHByb3ZpZGVyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBOZWdvdGlhdG9yLnByb3ZpZGVyc1twcm92aWRlci5pZF0gPSBwcm92aWRlcjtcbiAgfVxufSovXG5cblxuLyoqIFN0YXJ0IGEgUEMuICovXG5OZWdvdGlhdG9yLl9zdGFydFBlZXJDb25uZWN0aW9uID0gZnVuY3Rpb24oY29ubmVjdGlvbikge1xuICB1dGlsLmxvZygnQ3JlYXRpbmcgUlRDUGVlckNvbm5lY3Rpb24uJyk7XG5cbiAgdmFyIGlkID0gTmVnb3RpYXRvci5faWRQcmVmaXggKyB1dGlsLnJhbmRvbVRva2VuKCk7XG4gIHZhciBvcHRpb25hbCA9IHt9O1xuXG4gIGlmIChjb25uZWN0aW9uLnR5cGUgPT09ICdkYXRhJyAmJiAhdXRpbC5zdXBwb3J0cy5zY3RwKSB7XG4gICAgb3B0aW9uYWwgPSB7b3B0aW9uYWw6IFt7UnRwRGF0YUNoYW5uZWxzOiB0cnVlfV19O1xuICB9IGVsc2UgaWYgKGNvbm5lY3Rpb24udHlwZSA9PT0gJ21lZGlhJykge1xuICAgIC8vIEludGVyb3AgcmVxIGZvciBjaHJvbWUuXG4gICAgb3B0aW9uYWwgPSB7b3B0aW9uYWw6IFt7RHRsc1NydHBLZXlBZ3JlZW1lbnQ6IHRydWV9XX07XG4gIH1cblxuICB2YXIgcGMgPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oY29ubmVjdGlvbi5wcm92aWRlci5vcHRpb25zLmNvbmZpZywgb3B0aW9uYWwpO1xuICBOZWdvdGlhdG9yLnBjc1tjb25uZWN0aW9uLnR5cGVdW2Nvbm5lY3Rpb24ucGVlcl1baWRdID0gcGM7XG5cbiAgTmVnb3RpYXRvci5fc2V0dXBMaXN0ZW5lcnMoY29ubmVjdGlvbiwgcGMsIGlkKTtcblxuICByZXR1cm4gcGM7XG59XG5cbi8qKiBTZXQgdXAgdmFyaW91cyBXZWJSVEMgbGlzdGVuZXJzLiAqL1xuTmVnb3RpYXRvci5fc2V0dXBMaXN0ZW5lcnMgPSBmdW5jdGlvbihjb25uZWN0aW9uLCBwYywgcGNfaWQpIHtcbiAgdmFyIHBlZXJJZCA9IGNvbm5lY3Rpb24ucGVlcjtcbiAgdmFyIGNvbm5lY3Rpb25JZCA9IGNvbm5lY3Rpb24uaWQ7XG4gIHZhciBwcm92aWRlciA9IGNvbm5lY3Rpb24ucHJvdmlkZXI7XG5cbiAgLy8gSUNFIENBTkRJREFURVMuXG4gIHV0aWwubG9nKCdMaXN0ZW5pbmcgZm9yIElDRSBjYW5kaWRhdGVzLicpO1xuICBwYy5vbmljZWNhbmRpZGF0ZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGlmIChldnQuY2FuZGlkYXRlKSB7XG4gICAgICB1dGlsLmxvZygnUmVjZWl2ZWQgSUNFIGNhbmRpZGF0ZXMgZm9yOicsIGNvbm5lY3Rpb24ucGVlcik7XG4gICAgICBwcm92aWRlci5zb2NrZXQuc2VuZCh7XG4gICAgICAgIHR5cGU6ICdDQU5ESURBVEUnLFxuICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgY2FuZGlkYXRlOiBldnQuY2FuZGlkYXRlLFxuICAgICAgICAgIHR5cGU6IGNvbm5lY3Rpb24udHlwZSxcbiAgICAgICAgICBjb25uZWN0aW9uSWQ6IGNvbm5lY3Rpb24uaWRcbiAgICAgICAgfSxcbiAgICAgICAgZHN0OiBwZWVySWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICBwYy5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIHN3aXRjaCAocGMuaWNlQ29ubmVjdGlvblN0YXRlKSB7XG4gICAgICBjYXNlICdkaXNjb25uZWN0ZWQnOlxuICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgdXRpbC5sb2coJ2ljZUNvbm5lY3Rpb25TdGF0ZSBpcyBkaXNjb25uZWN0ZWQsIGNsb3NpbmcgY29ubmVjdGlvbnMgdG8gJyArIHBlZXJJZCk7XG4gICAgICAgIGNvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjb21wbGV0ZWQnOlxuICAgICAgICBwYy5vbmljZWNhbmRpZGF0ZSA9IHV0aWwubm9vcDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9O1xuXG4gIC8vIEZhbGxiYWNrIGZvciBvbGRlciBDaHJvbWUgaW1wbHMuXG4gIHBjLm9uaWNlY2hhbmdlID0gcGMub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2U7XG5cbiAgLy8gT05ORUdPVElBVElPTk5FRURFRCAoQ2hyb21lKVxuICB1dGlsLmxvZygnTGlzdGVuaW5nIGZvciBgbmVnb3RpYXRpb25uZWVkZWRgJyk7XG4gIHBjLm9ubmVnb3RpYXRpb25uZWVkZWQgPSBmdW5jdGlvbigpIHtcbiAgICB1dGlsLmxvZygnYG5lZ290aWF0aW9ubmVlZGVkYCB0cmlnZ2VyZWQnKTtcbiAgICBpZiAocGMuc2lnbmFsaW5nU3RhdGUgPT0gJ3N0YWJsZScpIHtcbiAgICAgIE5lZ290aWF0b3IuX21ha2VPZmZlcihjb25uZWN0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXRpbC5sb2coJ29ubmVnb3RpYXRpb25uZWVkZWQgdHJpZ2dlcmVkIHdoZW4gbm90IHN0YWJsZS4gSXMgYW5vdGhlciBjb25uZWN0aW9uIGJlaW5nIGVzdGFibGlzaGVkPycpO1xuICAgIH1cbiAgfTtcblxuICAvLyBEQVRBQ09OTkVDVElPTi5cbiAgdXRpbC5sb2coJ0xpc3RlbmluZyBmb3IgZGF0YSBjaGFubmVsJyk7XG4gIC8vIEZpcmVkIGJldHdlZW4gb2ZmZXIgYW5kIGFuc3dlciwgc28gb3B0aW9ucyBzaG91bGQgYWxyZWFkeSBiZSBzYXZlZFxuICAvLyBpbiB0aGUgb3B0aW9ucyBoYXNoLlxuICBwYy5vbmRhdGFjaGFubmVsID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdXRpbC5sb2coJ1JlY2VpdmVkIGRhdGEgY2hhbm5lbCcpO1xuICAgIHZhciBkYyA9IGV2dC5jaGFubmVsO1xuICAgIHZhciBjb25uZWN0aW9uID0gcHJvdmlkZXIuZ2V0Q29ubmVjdGlvbihwZWVySWQsIGNvbm5lY3Rpb25JZCk7XG4gICAgY29ubmVjdGlvbi5pbml0aWFsaXplKGRjKTtcbiAgfTtcblxuICAvLyBNRURJQUNPTk5FQ1RJT04uXG4gIHV0aWwubG9nKCdMaXN0ZW5pbmcgZm9yIHJlbW90ZSBzdHJlYW0nKTtcbiAgcGMub25hZGRzdHJlYW0gPSBmdW5jdGlvbihldnQpIHtcbiAgICB1dGlsLmxvZygnUmVjZWl2ZWQgcmVtb3RlIHN0cmVhbScpO1xuICAgIHZhciBzdHJlYW0gPSBldnQuc3RyZWFtO1xuICAgIHZhciBjb25uZWN0aW9uID0gcHJvdmlkZXIuZ2V0Q29ubmVjdGlvbihwZWVySWQsIGNvbm5lY3Rpb25JZCk7XG4gICAgLy8gMTAvMTAvMjAxNDogbG9va3MgbGlrZSBpbiBDaHJvbWUgMzgsIG9uYWRkc3RyZWFtIGlzIHRyaWdnZXJlZCBhZnRlclxuICAgIC8vIHNldHRpbmcgdGhlIHJlbW90ZSBkZXNjcmlwdGlvbi4gT3VyIGNvbm5lY3Rpb24gb2JqZWN0IGluIHRoZXNlIGNhc2VzXG4gICAgLy8gaXMgYWN0dWFsbHkgYSBEQVRBIGNvbm5lY3Rpb24sIHNvIGFkZFN0cmVhbSBmYWlscy5cbiAgICAvLyBUT0RPOiBUaGlzIGlzIGhvcGVmdWxseSBqdXN0IGEgdGVtcG9yYXJ5IGZpeC4gV2Ugc2hvdWxkIHRyeSB0b1xuICAgIC8vIHVuZGVyc3RhbmQgd2h5IHRoaXMgaXMgaGFwcGVuaW5nLlxuICAgIGlmIChjb25uZWN0aW9uLnR5cGUgPT09ICdtZWRpYScpIHtcbiAgICAgIGNvbm5lY3Rpb24uYWRkU3RyZWFtKHN0cmVhbSk7XG4gICAgfVxuICB9O1xufVxuXG5OZWdvdGlhdG9yLmNsZWFudXAgPSBmdW5jdGlvbihjb25uZWN0aW9uKSB7XG4gIHV0aWwubG9nKCdDbGVhbmluZyB1cCBQZWVyQ29ubmVjdGlvbiB0byAnICsgY29ubmVjdGlvbi5wZWVyKTtcblxuICB2YXIgcGMgPSBjb25uZWN0aW9uLnBjO1xuXG4gIGlmICghIXBjICYmIChwYy5yZWFkeVN0YXRlICE9PSAnY2xvc2VkJyB8fCBwYy5zaWduYWxpbmdTdGF0ZSAhPT0gJ2Nsb3NlZCcpKSB7XG4gICAgcGMuY2xvc2UoKTtcbiAgICBjb25uZWN0aW9uLnBjID0gbnVsbDtcbiAgfVxufVxuXG5OZWdvdGlhdG9yLl9tYWtlT2ZmZXIgPSBmdW5jdGlvbihjb25uZWN0aW9uKSB7XG4gIHZhciBwYyA9IGNvbm5lY3Rpb24ucGM7XG4gIHBjLmNyZWF0ZU9mZmVyKGZ1bmN0aW9uKG9mZmVyKSB7XG4gICAgdXRpbC5sb2coJ0NyZWF0ZWQgb2ZmZXIuJyk7XG5cbiAgICBpZiAoIXV0aWwuc3VwcG9ydHMuc2N0cCAmJiBjb25uZWN0aW9uLnR5cGUgPT09ICdkYXRhJyAmJiBjb25uZWN0aW9uLnJlbGlhYmxlKSB7XG4gICAgICBvZmZlci5zZHAgPSBSZWxpYWJsZS5oaWdoZXJCYW5kd2lkdGhTRFAob2ZmZXIuc2RwKTtcbiAgICB9XG5cbiAgICBwYy5zZXRMb2NhbERlc2NyaXB0aW9uKG9mZmVyLCBmdW5jdGlvbigpIHtcbiAgICAgIHV0aWwubG9nKCdTZXQgbG9jYWxEZXNjcmlwdGlvbjogb2ZmZXInLCAnZm9yOicsIGNvbm5lY3Rpb24ucGVlcik7XG4gICAgICBjb25uZWN0aW9uLnByb3ZpZGVyLnNvY2tldC5zZW5kKHtcbiAgICAgICAgdHlwZTogJ09GRkVSJyxcbiAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgIHNkcDogb2ZmZXIsXG4gICAgICAgICAgdHlwZTogY29ubmVjdGlvbi50eXBlLFxuICAgICAgICAgIGxhYmVsOiBjb25uZWN0aW9uLmxhYmVsLFxuICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbi5pZCxcbiAgICAgICAgICByZWxpYWJsZTogY29ubmVjdGlvbi5yZWxpYWJsZSxcbiAgICAgICAgICBzZXJpYWxpemF0aW9uOiBjb25uZWN0aW9uLnNlcmlhbGl6YXRpb24sXG4gICAgICAgICAgbWV0YWRhdGE6IGNvbm5lY3Rpb24ubWV0YWRhdGEsXG4gICAgICAgICAgYnJvd3NlcjogdXRpbC5icm93c2VyXG4gICAgICAgIH0sXG4gICAgICAgIGRzdDogY29ubmVjdGlvbi5wZWVyXG4gICAgICB9KTtcbiAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNvbm5lY3Rpb24ucHJvdmlkZXIuZW1pdEVycm9yKCd3ZWJydGMnLCBlcnIpO1xuICAgICAgdXRpbC5sb2coJ0ZhaWxlZCB0byBzZXRMb2NhbERlc2NyaXB0aW9uLCAnLCBlcnIpO1xuICAgIH0pO1xuICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICBjb25uZWN0aW9uLnByb3ZpZGVyLmVtaXRFcnJvcignd2VicnRjJywgZXJyKTtcbiAgICB1dGlsLmxvZygnRmFpbGVkIHRvIGNyZWF0ZU9mZmVyLCAnLCBlcnIpO1xuICB9LCBjb25uZWN0aW9uLm9wdGlvbnMuY29uc3RyYWludHMpO1xufVxuXG5OZWdvdGlhdG9yLl9tYWtlQW5zd2VyID0gZnVuY3Rpb24oY29ubmVjdGlvbikge1xuICB2YXIgcGMgPSBjb25uZWN0aW9uLnBjO1xuXG4gIHBjLmNyZWF0ZUFuc3dlcihmdW5jdGlvbihhbnN3ZXIpIHtcbiAgICB1dGlsLmxvZygnQ3JlYXRlZCBhbnN3ZXIuJyk7XG5cbiAgICBpZiAoIXV0aWwuc3VwcG9ydHMuc2N0cCAmJiBjb25uZWN0aW9uLnR5cGUgPT09ICdkYXRhJyAmJiBjb25uZWN0aW9uLnJlbGlhYmxlKSB7XG4gICAgICBhbnN3ZXIuc2RwID0gUmVsaWFibGUuaGlnaGVyQmFuZHdpZHRoU0RQKGFuc3dlci5zZHApO1xuICAgIH1cblxuICAgIHBjLnNldExvY2FsRGVzY3JpcHRpb24oYW5zd2VyLCBmdW5jdGlvbigpIHtcbiAgICAgIHV0aWwubG9nKCdTZXQgbG9jYWxEZXNjcmlwdGlvbjogYW5zd2VyJywgJ2ZvcjonLCBjb25uZWN0aW9uLnBlZXIpO1xuICAgICAgY29ubmVjdGlvbi5wcm92aWRlci5zb2NrZXQuc2VuZCh7XG4gICAgICAgIHR5cGU6ICdBTlNXRVInLFxuICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgc2RwOiBhbnN3ZXIsXG4gICAgICAgICAgdHlwZTogY29ubmVjdGlvbi50eXBlLFxuICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbi5pZCxcbiAgICAgICAgICBicm93c2VyOiB1dGlsLmJyb3dzZXJcbiAgICAgICAgfSxcbiAgICAgICAgZHN0OiBjb25uZWN0aW9uLnBlZXJcbiAgICAgIH0pO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgY29ubmVjdGlvbi5wcm92aWRlci5lbWl0RXJyb3IoJ3dlYnJ0YycsIGVycik7XG4gICAgICB1dGlsLmxvZygnRmFpbGVkIHRvIHNldExvY2FsRGVzY3JpcHRpb24sICcsIGVycik7XG4gICAgfSk7XG4gIH0sIGZ1bmN0aW9uKGVycikge1xuICAgIGNvbm5lY3Rpb24ucHJvdmlkZXIuZW1pdEVycm9yKCd3ZWJydGMnLCBlcnIpO1xuICAgIHV0aWwubG9nKCdGYWlsZWQgdG8gY3JlYXRlIGFuc3dlciwgJywgZXJyKTtcbiAgfSk7XG59XG5cbi8qKiBIYW5kbGUgYW4gU0RQLiAqL1xuTmVnb3RpYXRvci5oYW5kbGVTRFAgPSBmdW5jdGlvbih0eXBlLCBjb25uZWN0aW9uLCBzZHApIHtcbiAgc2RwID0gbmV3IFJUQ1Nlc3Npb25EZXNjcmlwdGlvbihzZHApO1xuICB2YXIgcGMgPSBjb25uZWN0aW9uLnBjO1xuXG4gIHV0aWwubG9nKCdTZXR0aW5nIHJlbW90ZSBkZXNjcmlwdGlvbicsIHNkcCk7XG4gIHBjLnNldFJlbW90ZURlc2NyaXB0aW9uKHNkcCwgZnVuY3Rpb24oKSB7XG4gICAgdXRpbC5sb2coJ1NldCByZW1vdGVEZXNjcmlwdGlvbjonLCB0eXBlLCAnZm9yOicsIGNvbm5lY3Rpb24ucGVlcik7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09GRkVSJykge1xuICAgICAgTmVnb3RpYXRvci5fbWFrZUFuc3dlcihjb25uZWN0aW9uKTtcbiAgICB9XG4gIH0sIGZ1bmN0aW9uKGVycikge1xuICAgIGNvbm5lY3Rpb24ucHJvdmlkZXIuZW1pdEVycm9yKCd3ZWJydGMnLCBlcnIpO1xuICAgIHV0aWwubG9nKCdGYWlsZWQgdG8gc2V0UmVtb3RlRGVzY3JpcHRpb24sICcsIGVycik7XG4gIH0pO1xufVxuXG4vKiogSGFuZGxlIGEgY2FuZGlkYXRlLiAqL1xuTmVnb3RpYXRvci5oYW5kbGVDYW5kaWRhdGUgPSBmdW5jdGlvbihjb25uZWN0aW9uLCBpY2UpIHtcbiAgdmFyIGNhbmRpZGF0ZSA9IGljZS5jYW5kaWRhdGU7XG4gIHZhciBzZHBNTGluZUluZGV4ID0gaWNlLnNkcE1MaW5lSW5kZXg7XG4gIGNvbm5lY3Rpb24ucGMuYWRkSWNlQ2FuZGlkYXRlKG5ldyBSVENJY2VDYW5kaWRhdGUoe1xuICAgIHNkcE1MaW5lSW5kZXg6IHNkcE1MaW5lSW5kZXgsXG4gICAgY2FuZGlkYXRlOiBjYW5kaWRhdGVcbiAgfSkpO1xuICB1dGlsLmxvZygnQWRkZWQgSUNFIGNhbmRpZGF0ZSBmb3I6JywgY29ubmVjdGlvbi5wZWVyKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBOZWdvdGlhdG9yO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIzJyk7XG52YXIgU29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKTtcbnZhciBNZWRpYUNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL21lZGlhY29ubmVjdGlvbicpO1xudmFyIERhdGFDb25uZWN0aW9uID0gcmVxdWlyZSgnLi9kYXRhY29ubmVjdGlvbicpO1xuXG4vKipcbiAqIEEgcGVlciB3aG8gY2FuIGluaXRpYXRlIGNvbm5lY3Rpb25zIHdpdGggb3RoZXIgcGVlcnMuXG4gKi9cbmZ1bmN0aW9uIFBlZXIoaWQsIG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFBlZXIpKSByZXR1cm4gbmV3IFBlZXIoaWQsIG9wdGlvbnMpO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAvLyBEZWFsIHdpdGggb3ZlcmxvYWRpbmdcbiAgaWYgKGlkICYmIGlkLmNvbnN0cnVjdG9yID09IE9iamVjdCkge1xuICAgIG9wdGlvbnMgPSBpZDtcbiAgICBpZCA9IHVuZGVmaW5lZDtcbiAgfSBlbHNlIGlmIChpZCkge1xuICAgIC8vIEVuc3VyZSBpZCBpcyBhIHN0cmluZ1xuICAgIGlkID0gaWQudG9TdHJpbmcoKTtcbiAgfVxuICAvL1xuXG4gIC8vIENvbmZpZ3VyaXplIG9wdGlvbnNcbiAgb3B0aW9ucyA9IHV0aWwuZXh0ZW5kKHtcbiAgICBkZWJ1ZzogMCwgLy8gMTogRXJyb3JzLCAyOiBXYXJuaW5ncywgMzogQWxsIGxvZ3NcbiAgICBob3N0OiB1dGlsLkNMT1VEX0hPU1QsXG4gICAgcG9ydDogdXRpbC5DTE9VRF9QT1JULFxuICAgIGtleTogJ3BlZXJqcycsXG4gICAgcGF0aDogJy8nLFxuICAgIHRva2VuOiB1dGlsLnJhbmRvbVRva2VuKCksXG4gICAgY29uZmlnOiB1dGlsLmRlZmF1bHRDb25maWdcbiAgfSwgb3B0aW9ucyk7XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gIC8vIERldGVjdCByZWxhdGl2ZSBVUkwgaG9zdC5cbiAgaWYgKG9wdGlvbnMuaG9zdCA9PT0gJy8nKSB7XG4gICAgb3B0aW9ucy5ob3N0ID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lO1xuICB9XG4gIC8vIFNldCBwYXRoIGNvcnJlY3RseS5cbiAgaWYgKG9wdGlvbnMucGF0aFswXSAhPT0gJy8nKSB7XG4gICAgb3B0aW9ucy5wYXRoID0gJy8nICsgb3B0aW9ucy5wYXRoO1xuICB9XG4gIGlmIChvcHRpb25zLnBhdGhbb3B0aW9ucy5wYXRoLmxlbmd0aCAtIDFdICE9PSAnLycpIHtcbiAgICBvcHRpb25zLnBhdGggKz0gJy8nO1xuICB9XG5cbiAgLy8gU2V0IHdoZXRoZXIgd2UgdXNlIFNTTCB0byBzYW1lIGFzIGN1cnJlbnQgaG9zdFxuICBpZiAob3B0aW9ucy5zZWN1cmUgPT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLmhvc3QgIT09IHV0aWwuQ0xPVURfSE9TVCkge1xuICAgIG9wdGlvbnMuc2VjdXJlID0gdXRpbC5pc1NlY3VyZSgpO1xuICB9XG4gIC8vIFNldCBhIGN1c3RvbSBsb2cgZnVuY3Rpb24gaWYgcHJlc2VudFxuICBpZiAob3B0aW9ucy5sb2dGdW5jdGlvbikge1xuICAgIHV0aWwuc2V0TG9nRnVuY3Rpb24ob3B0aW9ucy5sb2dGdW5jdGlvbik7XG4gIH1cbiAgdXRpbC5zZXRMb2dMZXZlbChvcHRpb25zLmRlYnVnKTtcbiAgLy9cblxuICAvLyBTYW5pdHkgY2hlY2tzXG4gIC8vIEVuc3VyZSBXZWJSVEMgc3VwcG9ydGVkXG4gIGlmICghdXRpbC5zdXBwb3J0cy5hdWRpb1ZpZGVvICYmICF1dGlsLnN1cHBvcnRzLmRhdGEgKSB7XG4gICAgdGhpcy5fZGVsYXllZEFib3J0KCdicm93c2VyLWluY29tcGF0aWJsZScsICdUaGUgY3VycmVudCBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgV2ViUlRDJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIEVuc3VyZSBhbHBoYW51bWVyaWMgaWRcbiAgaWYgKCF1dGlsLnZhbGlkYXRlSWQoaWQpKSB7XG4gICAgdGhpcy5fZGVsYXllZEFib3J0KCdpbnZhbGlkLWlkJywgJ0lEIFwiJyArIGlkICsgJ1wiIGlzIGludmFsaWQnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gRW5zdXJlIHZhbGlkIGtleVxuICBpZiAoIXV0aWwudmFsaWRhdGVLZXkob3B0aW9ucy5rZXkpKSB7XG4gICAgdGhpcy5fZGVsYXllZEFib3J0KCdpbnZhbGlkLWtleScsICdBUEkgS0VZIFwiJyArIG9wdGlvbnMua2V5ICsgJ1wiIGlzIGludmFsaWQnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gRW5zdXJlIG5vdCB1c2luZyB1bnNlY3VyZSBjbG91ZCBzZXJ2ZXIgb24gU1NMIHBhZ2VcbiAgaWYgKG9wdGlvbnMuc2VjdXJlICYmIG9wdGlvbnMuaG9zdCA9PT0gJzAucGVlcmpzLmNvbScpIHtcbiAgICB0aGlzLl9kZWxheWVkQWJvcnQoJ3NzbC11bmF2YWlsYWJsZScsXG4gICAgICAnVGhlIGNsb3VkIHNlcnZlciBjdXJyZW50bHkgZG9lcyBub3Qgc3VwcG9ydCBIVFRQUy4gUGxlYXNlIHJ1biB5b3VyIG93biBQZWVyU2VydmVyIHRvIHVzZSBIVFRQUy4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy9cblxuICAvLyBTdGF0ZXMuXG4gIHRoaXMuZGVzdHJveWVkID0gZmFsc2U7IC8vIENvbm5lY3Rpb25zIGhhdmUgYmVlbiBraWxsZWRcbiAgdGhpcy5kaXNjb25uZWN0ZWQgPSBmYWxzZTsgLy8gQ29ubmVjdGlvbiB0byBQZWVyU2VydmVyIGtpbGxlZCBidXQgUDJQIGNvbm5lY3Rpb25zIHN0aWxsIGFjdGl2ZVxuICB0aGlzLm9wZW4gPSBmYWxzZTsgLy8gU29ja2V0cyBhbmQgc3VjaCBhcmUgbm90IHlldCBvcGVuLlxuICAvL1xuXG4gIC8vIFJlZmVyZW5jZXNcbiAgdGhpcy5jb25uZWN0aW9ucyA9IHt9OyAvLyBEYXRhQ29ubmVjdGlvbnMgZm9yIHRoaXMgcGVlci5cbiAgdGhpcy5fbG9zdE1lc3NhZ2VzID0ge307IC8vIHNyYyA9PiBbbGlzdCBvZiBtZXNzYWdlc11cbiAgLy9cblxuICAvLyBTdGFydCB0aGUgc2VydmVyIGNvbm5lY3Rpb25cbiAgdGhpcy5faW5pdGlhbGl6ZVNlcnZlckNvbm5lY3Rpb24oKTtcbiAgaWYgKGlkKSB7XG4gICAgdGhpcy5faW5pdGlhbGl6ZShpZCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fcmV0cmlldmVJZCgpO1xuICB9XG4gIC8vXG59XG5cbnV0aWwuaW5oZXJpdHMoUGVlciwgRXZlbnRFbWl0dGVyKTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgJ3NvY2tldCcgKHdoaWNoIGlzIGFjdHVhbGx5IGEgbWl4IG9mIFhIUiBzdHJlYW1pbmcgYW5kXG4vLyB3ZWJzb2NrZXRzLilcblBlZXIucHJvdG90eXBlLl9pbml0aWFsaXplU2VydmVyQ29ubmVjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuc29ja2V0ID0gbmV3IFNvY2tldCh0aGlzLm9wdGlvbnMuc2VjdXJlLCB0aGlzLm9wdGlvbnMuaG9zdCwgdGhpcy5vcHRpb25zLnBvcnQsIHRoaXMub3B0aW9ucy5wYXRoLCB0aGlzLm9wdGlvbnMua2V5KTtcbiAgdGhpcy5zb2NrZXQub24oJ21lc3NhZ2UnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgc2VsZi5faGFuZGxlTWVzc2FnZShkYXRhKTtcbiAgfSk7XG4gIHRoaXMuc29ja2V0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgc2VsZi5fYWJvcnQoJ3NvY2tldC1lcnJvcicsIGVycm9yKTtcbiAgfSk7XG4gIHRoaXMuc29ja2V0Lm9uKCdkaXNjb25uZWN0ZWQnLCBmdW5jdGlvbigpIHtcbiAgICAvLyBJZiB3ZSBoYXZlbid0IGV4cGxpY2l0bHkgZGlzY29ubmVjdGVkLCBlbWl0IGVycm9yIGFuZCBkaXNjb25uZWN0LlxuICAgIGlmICghc2VsZi5kaXNjb25uZWN0ZWQpIHtcbiAgICAgIHNlbGYuZW1pdEVycm9yKCduZXR3b3JrJywgJ0xvc3QgY29ubmVjdGlvbiB0byBzZXJ2ZXIuJyk7XG4gICAgICBzZWxmLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gIH0pO1xuICB0aGlzLnNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbigpIHtcbiAgICAvLyBJZiB3ZSBoYXZlbid0IGV4cGxpY2l0bHkgZGlzY29ubmVjdGVkLCBlbWl0IGVycm9yLlxuICAgIGlmICghc2VsZi5kaXNjb25uZWN0ZWQpIHtcbiAgICAgIHNlbGYuX2Fib3J0KCdzb2NrZXQtY2xvc2VkJywgJ1VuZGVybHlpbmcgc29ja2V0IGlzIGFscmVhZHkgY2xvc2VkLicpO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vKiogR2V0IGEgdW5pcXVlIElEIGZyb20gdGhlIHNlcnZlciB2aWEgWEhSLiAqL1xuUGVlci5wcm90b3R5cGUuX3JldHJpZXZlSWQgPSBmdW5jdGlvbihjYikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIHZhciBwcm90b2NvbCA9IHRoaXMub3B0aW9ucy5zZWN1cmUgPyAnaHR0cHM6Ly8nIDogJ2h0dHA6Ly8nO1xuICB2YXIgdXJsID0gcHJvdG9jb2wgKyB0aGlzLm9wdGlvbnMuaG9zdCArICc6JyArIHRoaXMub3B0aW9ucy5wb3J0ICtcbiAgICB0aGlzLm9wdGlvbnMucGF0aCArIHRoaXMub3B0aW9ucy5rZXkgKyAnL2lkJztcbiAgdmFyIHF1ZXJ5U3RyaW5nID0gJz90cz0nICsgbmV3IERhdGUoKS5nZXRUaW1lKCkgKyAnJyArIE1hdGgucmFuZG9tKCk7XG4gIHVybCArPSBxdWVyeVN0cmluZztcblxuICAvLyBJZiB0aGVyZSdzIG5vIElEIHdlIG5lZWQgdG8gd2FpdCBmb3Igb25lIGJlZm9yZSB0cnlpbmcgdG8gaW5pdCBzb2NrZXQuXG4gIGh0dHAub3BlbignZ2V0JywgdXJsLCB0cnVlKTtcbiAgaHR0cC5vbmVycm9yID0gZnVuY3Rpb24oZSkge1xuICAgIHV0aWwuZXJyb3IoJ0Vycm9yIHJldHJpZXZpbmcgSUQnLCBlKTtcbiAgICB2YXIgcGF0aEVycm9yID0gJyc7XG4gICAgaWYgKHNlbGYub3B0aW9ucy5wYXRoID09PSAnLycgJiYgc2VsZi5vcHRpb25zLmhvc3QgIT09IHV0aWwuQ0xPVURfSE9TVCkge1xuICAgICAgcGF0aEVycm9yID0gJyBJZiB5b3UgcGFzc2VkIGluIGEgYHBhdGhgIHRvIHlvdXIgc2VsZi1ob3N0ZWQgUGVlclNlcnZlciwgJyArXG4gICAgICAgICd5b3VcXCdsbCBhbHNvIG5lZWQgdG8gcGFzcyBpbiB0aGF0IHNhbWUgcGF0aCB3aGVuIGNyZWF0aW5nIGEgbmV3ICcgK1xuICAgICAgICAnUGVlci4nO1xuICAgIH1cbiAgICBzZWxmLl9hYm9ydCgnc2VydmVyLWVycm9yJywgJ0NvdWxkIG5vdCBnZXQgYW4gSUQgZnJvbSB0aGUgc2VydmVyLicgKyBwYXRoRXJyb3IpO1xuICB9O1xuICBodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChodHRwLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGh0dHAuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIGh0dHAub25lcnJvcigpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZWxmLl9pbml0aWFsaXplKGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgfTtcbiAgaHR0cC5zZW5kKG51bGwpO1xufTtcblxuLyoqIEluaXRpYWxpemUgYSBjb25uZWN0aW9uIHdpdGggdGhlIHNlcnZlci4gKi9cblBlZXIucHJvdG90eXBlLl9pbml0aWFsaXplID0gZnVuY3Rpb24oaWQpIHtcbiAgdGhpcy5pZCA9IGlkO1xuICB0aGlzLnNvY2tldC5zdGFydCh0aGlzLmlkLCB0aGlzLm9wdGlvbnMudG9rZW4pO1xufTtcblxuLyoqIEhhbmRsZXMgbWVzc2FnZXMgZnJvbSB0aGUgc2VydmVyLiAqL1xuUGVlci5wcm90b3R5cGUuX2hhbmRsZU1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciB0eXBlID0gbWVzc2FnZS50eXBlO1xuICB2YXIgcGF5bG9hZCA9IG1lc3NhZ2UucGF5bG9hZDtcbiAgdmFyIHBlZXIgPSBtZXNzYWdlLnNyYztcbiAgdmFyIGNvbm5lY3Rpb247XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnT1BFTic6IC8vIFRoZSBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIgaXMgb3Blbi5cbiAgICAgIHRoaXMuZW1pdCgnb3BlbicsIHRoaXMuaWQpO1xuICAgICAgdGhpcy5vcGVuID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0VSUk9SJzogLy8gU2VydmVyIGVycm9yLlxuICAgICAgdGhpcy5fYWJvcnQoJ3NlcnZlci1lcnJvcicsIHBheWxvYWQubXNnKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0lELVRBS0VOJzogLy8gVGhlIHNlbGVjdGVkIElEIGlzIHRha2VuLlxuICAgICAgdGhpcy5fYWJvcnQoJ3VuYXZhaWxhYmxlLWlkJywgJ0lEIGAnICsgdGhpcy5pZCArICdgIGlzIHRha2VuJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdJTlZBTElELUtFWSc6IC8vIFRoZSBnaXZlbiBBUEkga2V5IGNhbm5vdCBiZSBmb3VuZC5cbiAgICAgIHRoaXMuX2Fib3J0KCdpbnZhbGlkLWtleScsICdBUEkgS0VZIFwiJyArIHRoaXMub3B0aW9ucy5rZXkgKyAnXCIgaXMgaW52YWxpZCcpO1xuICAgICAgYnJlYWs7XG5cbiAgICAvL1xuICAgIGNhc2UgJ0xFQVZFJzogLy8gQW5vdGhlciBwZWVyIGhhcyBjbG9zZWQgaXRzIGNvbm5lY3Rpb24gdG8gdGhpcyBwZWVyLlxuICAgICAgdXRpbC5sb2coJ1JlY2VpdmVkIGxlYXZlIG1lc3NhZ2UgZnJvbScsIHBlZXIpO1xuICAgICAgdGhpcy5fY2xlYW51cFBlZXIocGVlcik7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ0VYUElSRSc6IC8vIFRoZSBvZmZlciBzZW50IHRvIGEgcGVlciBoYXMgZXhwaXJlZCB3aXRob3V0IHJlc3BvbnNlLlxuICAgICAgdGhpcy5lbWl0RXJyb3IoJ3BlZXItdW5hdmFpbGFibGUnLCAnQ291bGQgbm90IGNvbm5lY3QgdG8gcGVlciAnICsgcGVlcik7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdPRkZFUic6IC8vIHdlIHNob3VsZCBjb25zaWRlciBzd2l0Y2hpbmcgdGhpcyB0byBDQUxML0NPTk5FQ1QsIGJ1dCB0aGlzIGlzIHRoZSBsZWFzdCBicmVha2luZyBvcHRpb24uXG4gICAgICB2YXIgY29ubmVjdGlvbklkID0gcGF5bG9hZC5jb25uZWN0aW9uSWQ7XG4gICAgICBjb25uZWN0aW9uID0gdGhpcy5nZXRDb25uZWN0aW9uKHBlZXIsIGNvbm5lY3Rpb25JZCk7XG5cbiAgICAgIGlmIChjb25uZWN0aW9uKSB7XG4gICAgICAgIHV0aWwud2FybignT2ZmZXIgcmVjZWl2ZWQgZm9yIGV4aXN0aW5nIENvbm5lY3Rpb24gSUQ6JywgY29ubmVjdGlvbklkKTtcbiAgICAgICAgLy9jb25uZWN0aW9uLmhhbmRsZU1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDcmVhdGUgYSBuZXcgY29ubmVjdGlvbi5cbiAgICAgICAgaWYgKHBheWxvYWQudHlwZSA9PT0gJ21lZGlhJykge1xuICAgICAgICAgIGNvbm5lY3Rpb24gPSBuZXcgTWVkaWFDb25uZWN0aW9uKHBlZXIsIHRoaXMsIHtcbiAgICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbklkLFxuICAgICAgICAgICAgX3BheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBtZXRhZGF0YTogcGF5bG9hZC5tZXRhZGF0YVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuX2FkZENvbm5lY3Rpb24ocGVlciwgY29ubmVjdGlvbik7XG4gICAgICAgICAgdGhpcy5lbWl0KCdjYWxsJywgY29ubmVjdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAocGF5bG9hZC50eXBlID09PSAnZGF0YScpIHtcbiAgICAgICAgICBjb25uZWN0aW9uID0gbmV3IERhdGFDb25uZWN0aW9uKHBlZXIsIHRoaXMsIHtcbiAgICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbklkLFxuICAgICAgICAgICAgX3BheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBtZXRhZGF0YTogcGF5bG9hZC5tZXRhZGF0YSxcbiAgICAgICAgICAgIGxhYmVsOiBwYXlsb2FkLmxhYmVsLFxuICAgICAgICAgICAgc2VyaWFsaXphdGlvbjogcGF5bG9hZC5zZXJpYWxpemF0aW9uLFxuICAgICAgICAgICAgcmVsaWFibGU6IHBheWxvYWQucmVsaWFibGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLl9hZGRDb25uZWN0aW9uKHBlZXIsIGNvbm5lY3Rpb24pO1xuICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdGlvbicsIGNvbm5lY3Rpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHV0aWwud2FybignUmVjZWl2ZWQgbWFsZm9ybWVkIGNvbm5lY3Rpb24gdHlwZTonLCBwYXlsb2FkLnR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBGaW5kIG1lc3NhZ2VzLlxuICAgICAgICB2YXIgbWVzc2FnZXMgPSB0aGlzLl9nZXRNZXNzYWdlcyhjb25uZWN0aW9uSWQpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgaWkgPSBtZXNzYWdlcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgICAgICAgY29ubmVjdGlvbi5oYW5kbGVNZXNzYWdlKG1lc3NhZ2VzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIGlmICghcGF5bG9hZCkge1xuICAgICAgICB1dGlsLndhcm4oJ1lvdSByZWNlaXZlZCBhIG1hbGZvcm1lZCBtZXNzYWdlIGZyb20gJyArIHBlZXIgKyAnIG9mIHR5cGUgJyArIHR5cGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBpZCA9IHBheWxvYWQuY29ubmVjdGlvbklkO1xuICAgICAgY29ubmVjdGlvbiA9IHRoaXMuZ2V0Q29ubmVjdGlvbihwZWVyLCBpZCk7XG5cbiAgICAgIGlmIChjb25uZWN0aW9uICYmIGNvbm5lY3Rpb24ucGMpIHtcbiAgICAgICAgLy8gUGFzcyBpdCBvbi5cbiAgICAgICAgY29ubmVjdGlvbi5oYW5kbGVNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgfSBlbHNlIGlmIChpZCkge1xuICAgICAgICAvLyBTdG9yZSBmb3IgcG9zc2libGUgbGF0ZXIgdXNlXG4gICAgICAgIHRoaXMuX3N0b3JlTWVzc2FnZShpZCwgbWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB1dGlsLndhcm4oJ1lvdSByZWNlaXZlZCBhbiB1bnJlY29nbml6ZWQgbWVzc2FnZTonLCBtZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICB9XG59O1xuXG4vKiogU3RvcmVzIG1lc3NhZ2VzIHdpdGhvdXQgYSBzZXQgdXAgY29ubmVjdGlvbiwgdG8gYmUgY2xhaW1lZCBsYXRlci4gKi9cblBlZXIucHJvdG90eXBlLl9zdG9yZU1lc3NhZ2UgPSBmdW5jdGlvbihjb25uZWN0aW9uSWQsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0aGlzLl9sb3N0TWVzc2FnZXNbY29ubmVjdGlvbklkXSkge1xuICAgIHRoaXMuX2xvc3RNZXNzYWdlc1tjb25uZWN0aW9uSWRdID0gW107XG4gIH1cbiAgdGhpcy5fbG9zdE1lc3NhZ2VzW2Nvbm5lY3Rpb25JZF0ucHVzaChtZXNzYWdlKTtcbn07XG5cbi8qKiBSZXRyaWV2ZSBtZXNzYWdlcyBmcm9tIGxvc3QgbWVzc2FnZSBzdG9yZSAqL1xuUGVlci5wcm90b3R5cGUuX2dldE1lc3NhZ2VzID0gZnVuY3Rpb24oY29ubmVjdGlvbklkKSB7XG4gIHZhciBtZXNzYWdlcyA9IHRoaXMuX2xvc3RNZXNzYWdlc1tjb25uZWN0aW9uSWRdO1xuICBpZiAobWVzc2FnZXMpIHtcbiAgICBkZWxldGUgdGhpcy5fbG9zdE1lc3NhZ2VzW2Nvbm5lY3Rpb25JZF07XG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBbXTtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgRGF0YUNvbm5lY3Rpb24gdG8gdGhlIHNwZWNpZmllZCBwZWVyLiBTZWUgZG9jdW1lbnRhdGlvbiBmb3IgYVxuICogY29tcGxldGUgbGlzdCBvZiBvcHRpb25zLlxuICovXG5QZWVyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24ocGVlciwgb3B0aW9ucykge1xuICBpZiAodGhpcy5kaXNjb25uZWN0ZWQpIHtcbiAgICB1dGlsLndhcm4oJ1lvdSBjYW5ub3QgY29ubmVjdCB0byBhIG5ldyBQZWVyIGJlY2F1c2UgeW91IGNhbGxlZCAnICtcbiAgICAgICcuZGlzY29ubmVjdCgpIG9uIHRoaXMgUGVlciBhbmQgZW5kZWQgeW91ciBjb25uZWN0aW9uIHdpdGggdGhlICcgK1xuICAgICAgJ3NlcnZlci4gWW91IGNhbiBjcmVhdGUgYSBuZXcgUGVlciB0byByZWNvbm5lY3QsIG9yIGNhbGwgcmVjb25uZWN0ICcgK1xuICAgICAgJ29uIHRoaXMgcGVlciBpZiB5b3UgYmVsaWV2ZSBpdHMgSUQgdG8gc3RpbGwgYmUgYXZhaWxhYmxlLicpO1xuICAgIHRoaXMuZW1pdEVycm9yKCdkaXNjb25uZWN0ZWQnLCAnQ2Fubm90IGNvbm5lY3QgdG8gbmV3IFBlZXIgYWZ0ZXIgZGlzY29ubmVjdGluZyBmcm9tIHNlcnZlci4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGNvbm5lY3Rpb24gPSBuZXcgRGF0YUNvbm5lY3Rpb24ocGVlciwgdGhpcywgb3B0aW9ucyk7XG4gIHRoaXMuX2FkZENvbm5lY3Rpb24ocGVlciwgY29ubmVjdGlvbik7XG4gIHJldHVybiBjb25uZWN0aW9uO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgTWVkaWFDb25uZWN0aW9uIHRvIHRoZSBzcGVjaWZpZWQgcGVlci4gU2VlIGRvY3VtZW50YXRpb24gZm9yIGFcbiAqIGNvbXBsZXRlIGxpc3Qgb2Ygb3B0aW9ucy5cbiAqL1xuUGVlci5wcm90b3R5cGUuY2FsbCA9IGZ1bmN0aW9uKHBlZXIsIHN0cmVhbSwgb3B0aW9ucykge1xuICBpZiAodGhpcy5kaXNjb25uZWN0ZWQpIHtcbiAgICB1dGlsLndhcm4oJ1lvdSBjYW5ub3QgY29ubmVjdCB0byBhIG5ldyBQZWVyIGJlY2F1c2UgeW91IGNhbGxlZCAnICtcbiAgICAgICcuZGlzY29ubmVjdCgpIG9uIHRoaXMgUGVlciBhbmQgZW5kZWQgeW91ciBjb25uZWN0aW9uIHdpdGggdGhlICcgK1xuICAgICAgJ3NlcnZlci4gWW91IGNhbiBjcmVhdGUgYSBuZXcgUGVlciB0byByZWNvbm5lY3QuJyk7XG4gICAgdGhpcy5lbWl0RXJyb3IoJ2Rpc2Nvbm5lY3RlZCcsICdDYW5ub3QgY29ubmVjdCB0byBuZXcgUGVlciBhZnRlciBkaXNjb25uZWN0aW5nIGZyb20gc2VydmVyLicpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXN0cmVhbSkge1xuICAgIHV0aWwuZXJyb3IoJ1RvIGNhbGwgYSBwZWVyLCB5b3UgbXVzdCBwcm92aWRlIGEgc3RyZWFtIGZyb20geW91ciBicm93c2VyXFwncyBgZ2V0VXNlck1lZGlhYC4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMuX3N0cmVhbSA9IHN0cmVhbTtcbiAgdmFyIGNhbGwgPSBuZXcgTWVkaWFDb25uZWN0aW9uKHBlZXIsIHRoaXMsIG9wdGlvbnMpO1xuICB0aGlzLl9hZGRDb25uZWN0aW9uKHBlZXIsIGNhbGwpO1xuICByZXR1cm4gY2FsbDtcbn07XG5cbi8qKiBBZGQgYSBkYXRhL21lZGlhIGNvbm5lY3Rpb24gdG8gdGhpcyBwZWVyLiAqL1xuUGVlci5wcm90b3R5cGUuX2FkZENvbm5lY3Rpb24gPSBmdW5jdGlvbihwZWVyLCBjb25uZWN0aW9uKSB7XG4gIGlmICghdGhpcy5jb25uZWN0aW9uc1twZWVyXSkge1xuICAgIHRoaXMuY29ubmVjdGlvbnNbcGVlcl0gPSBbXTtcbiAgfVxuICB0aGlzLmNvbm5lY3Rpb25zW3BlZXJdLnB1c2goY29ubmVjdGlvbik7XG59O1xuXG4vKiogUmV0cmlldmUgYSBkYXRhL21lZGlhIGNvbm5lY3Rpb24gZm9yIHRoaXMgcGVlci4gKi9cblBlZXIucHJvdG90eXBlLmdldENvbm5lY3Rpb24gPSBmdW5jdGlvbihwZWVyLCBpZCkge1xuICB2YXIgY29ubmVjdGlvbnMgPSB0aGlzLmNvbm5lY3Rpb25zW3BlZXJdO1xuICBpZiAoIWNvbm5lY3Rpb25zKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDAsIGlpID0gY29ubmVjdGlvbnMubGVuZ3RoOyBpIDwgaWk7IGkrKykge1xuICAgIGlmIChjb25uZWN0aW9uc1tpXS5pZCA9PT0gaWQpIHtcbiAgICAgIHJldHVybiBjb25uZWN0aW9uc1tpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5QZWVyLnByb3RvdHlwZS5fZGVsYXllZEFib3J0ID0gZnVuY3Rpb24odHlwZSwgbWVzc2FnZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHV0aWwuc2V0WmVyb1RpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICBzZWxmLl9hYm9ydCh0eXBlLCBtZXNzYWdlKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIERlc3Ryb3lzIHRoZSBQZWVyIGFuZCBlbWl0cyBhbiBlcnJvciBtZXNzYWdlLlxuICogVGhlIFBlZXIgaXMgbm90IGRlc3Ryb3llZCBpZiBpdCdzIGluIGEgZGlzY29ubmVjdGVkIHN0YXRlLCBpbiB3aGljaCBjYXNlXG4gKiBpdCByZXRhaW5zIGl0cyBkaXNjb25uZWN0ZWQgc3RhdGUgYW5kIGl0cyBleGlzdGluZyBjb25uZWN0aW9ucy5cbiAqL1xuUGVlci5wcm90b3R5cGUuX2Fib3J0ID0gZnVuY3Rpb24odHlwZSwgbWVzc2FnZSkge1xuICB1dGlsLmVycm9yKCdBYm9ydGluZyEnKTtcbiAgaWYgKCF0aGlzLl9sYXN0U2VydmVySWQpIHtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgfVxuICB0aGlzLmVtaXRFcnJvcih0eXBlLCBtZXNzYWdlKTtcbn07XG5cbi8qKiBFbWl0cyBhIHR5cGVkIGVycm9yIG1lc3NhZ2UuICovXG5QZWVyLnByb3RvdHlwZS5lbWl0RXJyb3IgPSBmdW5jdGlvbih0eXBlLCBlcnIpIHtcbiAgdXRpbC5lcnJvcignRXJyb3I6JywgZXJyKTtcbiAgaWYgKHR5cGVvZiBlcnIgPT09ICdzdHJpbmcnKSB7XG4gICAgZXJyID0gbmV3IEVycm9yKGVycik7XG4gIH1cbiAgZXJyLnR5cGUgPSB0eXBlO1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbn07XG5cbi8qKlxuICogRGVzdHJveXMgdGhlIFBlZXI6IGNsb3NlcyBhbGwgYWN0aXZlIGNvbm5lY3Rpb25zIGFzIHdlbGwgYXMgdGhlIGNvbm5lY3Rpb25cbiAqICB0byB0aGUgc2VydmVyLlxuICogV2FybmluZzogVGhlIHBlZXIgY2FuIG5vIGxvbmdlciBjcmVhdGUgb3IgYWNjZXB0IGNvbm5lY3Rpb25zIGFmdGVyIGJlaW5nXG4gKiAgZGVzdHJveWVkLlxuICovXG5QZWVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5kZXN0cm95ZWQpIHtcbiAgICB0aGlzLl9jbGVhbnVwKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuICB9XG59O1xuXG5cbi8qKiBEaXNjb25uZWN0cyBldmVyeSBjb25uZWN0aW9uIG9uIHRoaXMgcGVlci4gKi9cblBlZXIucHJvdG90eXBlLl9jbGVhbnVwID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb25zKSB7XG4gICAgdmFyIHBlZXJzID0gT2JqZWN0LmtleXModGhpcy5jb25uZWN0aW9ucyk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGlpID0gcGVlcnMubGVuZ3RoOyBpIDwgaWk7IGkrKykge1xuICAgICAgdGhpcy5fY2xlYW51cFBlZXIocGVlcnNbaV0pO1xuICAgIH1cbiAgfVxuICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG59O1xuXG4vKiogQ2xvc2VzIGFsbCBjb25uZWN0aW9ucyB0byB0aGlzIHBlZXIuICovXG5QZWVyLnByb3RvdHlwZS5fY2xlYW51cFBlZXIgPSBmdW5jdGlvbihwZWVyKSB7XG4gIHZhciBjb25uZWN0aW9ucyA9IHRoaXMuY29ubmVjdGlvbnNbcGVlcl07XG4gIGZvciAodmFyIGogPSAwLCBqaiA9IGNvbm5lY3Rpb25zLmxlbmd0aDsgaiA8IGpqOyBqICs9IDEpIHtcbiAgICBjb25uZWN0aW9uc1tqXS5jbG9zZSgpO1xuICB9XG59O1xuXG4vKipcbiAqIERpc2Nvbm5lY3RzIHRoZSBQZWVyJ3MgY29ubmVjdGlvbiB0byB0aGUgUGVlclNlcnZlci4gRG9lcyBub3QgY2xvc2UgYW55XG4gKiAgYWN0aXZlIGNvbm5lY3Rpb25zLlxuICogV2FybmluZzogVGhlIHBlZXIgY2FuIG5vIGxvbmdlciBjcmVhdGUgb3IgYWNjZXB0IGNvbm5lY3Rpb25zIGFmdGVyIGJlaW5nXG4gKiAgZGlzY29ubmVjdGVkLiBJdCBhbHNvIGNhbm5vdCByZWNvbm5lY3QgdG8gdGhlIHNlcnZlci5cbiAqL1xuUGVlci5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHV0aWwuc2V0WmVyb1RpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICBpZiAoIXNlbGYuZGlzY29ubmVjdGVkKSB7XG4gICAgICBzZWxmLmRpc2Nvbm5lY3RlZCA9IHRydWU7XG4gICAgICBzZWxmLm9wZW4gPSBmYWxzZTtcbiAgICAgIGlmIChzZWxmLnNvY2tldCkge1xuICAgICAgICBzZWxmLnNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgICAgc2VsZi5lbWl0KCdkaXNjb25uZWN0ZWQnLCBzZWxmLmlkKTtcbiAgICAgIHNlbGYuX2xhc3RTZXJ2ZXJJZCA9IHNlbGYuaWQ7XG4gICAgICBzZWxmLmlkID0gbnVsbDtcbiAgICB9XG4gIH0pO1xufTtcblxuLyoqIEF0dGVtcHRzIHRvIHJlY29ubmVjdCB3aXRoIHRoZSBzYW1lIElELiAqL1xuUGVlci5wcm90b3R5cGUucmVjb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmRpc2Nvbm5lY3RlZCAmJiAhdGhpcy5kZXN0cm95ZWQpIHtcbiAgICB1dGlsLmxvZygnQXR0ZW1wdGluZyByZWNvbm5lY3Rpb24gdG8gc2VydmVyIHdpdGggSUQgJyArIHRoaXMuX2xhc3RTZXJ2ZXJJZCk7XG4gICAgdGhpcy5kaXNjb25uZWN0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9pbml0aWFsaXplU2VydmVyQ29ubmVjdGlvbigpO1xuICAgIHRoaXMuX2luaXRpYWxpemUodGhpcy5fbGFzdFNlcnZlcklkKTtcbiAgfSBlbHNlIGlmICh0aGlzLmRlc3Ryb3llZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhpcyBwZWVyIGNhbm5vdCByZWNvbm5lY3QgdG8gdGhlIHNlcnZlci4gSXQgaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQuJyk7XG4gIH0gZWxzZSBpZiAoIXRoaXMuZGlzY29ubmVjdGVkICYmICF0aGlzLm9wZW4pIHtcbiAgICAvLyBEbyBub3RoaW5nLiBXZSdyZSBzdGlsbCBjb25uZWN0aW5nIHRoZSBmaXJzdCB0aW1lLlxuICAgIHV0aWwuZXJyb3IoJ0luIGEgaHVycnk/IFdlXFwncmUgc3RpbGwgdHJ5aW5nIHRvIG1ha2UgdGhlIGluaXRpYWwgY29ubmVjdGlvbiEnKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BlZXIgJyArIHRoaXMuaWQgKyAnIGNhbm5vdCByZWNvbm5lY3QgYmVjYXVzZSBpdCBpcyBub3QgZGlzY29ubmVjdGVkIGZyb20gdGhlIHNlcnZlciEnKTtcbiAgfVxufTtcblxuLyoqXG4gKiBHZXQgYSBsaXN0IG9mIGF2YWlsYWJsZSBwZWVyIElEcy4gSWYgeW91J3JlIHJ1bm5pbmcgeW91ciBvd24gc2VydmVyLCB5b3UnbGxcbiAqIHdhbnQgdG8gc2V0IGFsbG93X2Rpc2NvdmVyeTogdHJ1ZSBpbiB0aGUgUGVlclNlcnZlciBvcHRpb25zLiBJZiB5b3UncmUgdXNpbmdcbiAqIHRoZSBjbG91ZCBzZXJ2ZXIsIGVtYWlsIHRlYW1AcGVlcmpzLmNvbSB0byBnZXQgdGhlIGZ1bmN0aW9uYWxpdHkgZW5hYmxlZCBmb3JcbiAqIHlvdXIga2V5LlxuICovXG5QZWVyLnByb3RvdHlwZS5saXN0QWxsUGVlcnMgPSBmdW5jdGlvbihjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgdmFyIHByb3RvY29sID0gdGhpcy5vcHRpb25zLnNlY3VyZSA/ICdodHRwczovLycgOiAnaHR0cDovLyc7XG4gIHZhciB1cmwgPSBwcm90b2NvbCArIHRoaXMub3B0aW9ucy5ob3N0ICsgJzonICsgdGhpcy5vcHRpb25zLnBvcnQgK1xuICAgIHRoaXMub3B0aW9ucy5wYXRoICsgdGhpcy5vcHRpb25zLmtleSArICcvcGVlcnMnO1xuICB2YXIgcXVlcnlTdHJpbmcgPSAnP3RzPScgKyBuZXcgRGF0ZSgpLmdldFRpbWUoKSArICcnICsgTWF0aC5yYW5kb20oKTtcbiAgdXJsICs9IHF1ZXJ5U3RyaW5nO1xuXG4gIC8vIElmIHRoZXJlJ3Mgbm8gSUQgd2UgbmVlZCB0byB3YWl0IGZvciBvbmUgYmVmb3JlIHRyeWluZyB0byBpbml0IHNvY2tldC5cbiAgaHR0cC5vcGVuKCdnZXQnLCB1cmwsIHRydWUpO1xuICBodHRwLm9uZXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgc2VsZi5fYWJvcnQoJ3NlcnZlci1lcnJvcicsICdDb3VsZCBub3QgZ2V0IHBlZXJzIGZyb20gdGhlIHNlcnZlci4nKTtcbiAgICBjYihbXSk7XG4gIH07XG4gIGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKGh0dHAucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaHR0cC5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgdmFyIGhlbHBmdWxFcnJvciA9ICcnO1xuICAgICAgaWYgKHNlbGYub3B0aW9ucy5ob3N0ICE9PSB1dGlsLkNMT1VEX0hPU1QpIHtcbiAgICAgICAgaGVscGZ1bEVycm9yID0gJ0l0IGxvb2tzIGxpa2UgeW91XFwncmUgdXNpbmcgdGhlIGNsb3VkIHNlcnZlci4gWW91IGNhbiBlbWFpbCAnICtcbiAgICAgICAgICAndGVhbUBwZWVyanMuY29tIHRvIGVuYWJsZSBwZWVyIGxpc3RpbmcgZm9yIHlvdXIgQVBJIGtleS4nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGVscGZ1bEVycm9yID0gJ1lvdSBuZWVkIHRvIGVuYWJsZSBgYWxsb3dfZGlzY292ZXJ5YCBvbiB5b3VyIHNlbGYtaG9zdGVkICcgK1xuICAgICAgICAgICdQZWVyU2VydmVyIHRvIHVzZSB0aGlzIGZlYXR1cmUuJztcbiAgICAgIH1cbiAgICAgIGNiKFtdKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSXQgZG9lc25cXCd0IGxvb2sgbGlrZSB5b3UgaGF2ZSBwZXJtaXNzaW9uIHRvIGxpc3QgcGVlcnMgSURzLiAnICsgaGVscGZ1bEVycm9yKTtcbiAgICB9IGVsc2UgaWYgKGh0dHAuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIGNiKFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoSlNPTi5wYXJzZShodHRwLnJlc3BvbnNlVGV4dCkpO1xuICAgIH1cbiAgfTtcbiAgaHR0cC5zZW5kKG51bGwpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQZWVyO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIzJyk7XG5cbi8qKlxuICogQW4gYWJzdHJhY3Rpb24gb24gdG9wIG9mIFdlYlNvY2tldHMgYW5kIFhIUiBzdHJlYW1pbmcgdG8gcHJvdmlkZSBmYXN0ZXN0XG4gKiBwb3NzaWJsZSBjb25uZWN0aW9uIGZvciBwZWVycy5cbiAqL1xuZnVuY3Rpb24gU29ja2V0KHNlY3VyZSwgaG9zdCwgcG9ydCwgcGF0aCwga2V5KSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTb2NrZXQpKSByZXR1cm4gbmV3IFNvY2tldChzZWN1cmUsIGhvc3QsIHBvcnQsIHBhdGgsIGtleSk7XG5cbiAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgLy8gRGlzY29ubmVjdGVkIG1hbnVhbGx5LlxuICB0aGlzLmRpc2Nvbm5lY3RlZCA9IGZhbHNlO1xuICB0aGlzLl9xdWV1ZSA9IFtdO1xuXG4gIHZhciBodHRwUHJvdG9jb2wgPSBzZWN1cmUgPyAnaHR0cHM6Ly8nIDogJ2h0dHA6Ly8nO1xuICB2YXIgd3NQcm90b2NvbCA9IHNlY3VyZSA/ICd3c3M6Ly8nIDogJ3dzOi8vJztcbiAgdGhpcy5faHR0cFVybCA9IGh0dHBQcm90b2NvbCArIGhvc3QgKyAnOicgKyBwb3J0ICsgcGF0aCArIGtleTtcbiAgdGhpcy5fd3NVcmwgPSB3c1Byb3RvY29sICsgaG9zdCArICc6JyArIHBvcnQgKyBwYXRoICsgJ3BlZXJqcz9rZXk9JyArIGtleTtcbn1cblxudXRpbC5pbmhlcml0cyhTb2NrZXQsIEV2ZW50RW1pdHRlcik7XG5cblxuLyoqIENoZWNrIGluIHdpdGggSUQgb3IgZ2V0IG9uZSBmcm9tIHNlcnZlci4gKi9cblNvY2tldC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbihpZCwgdG9rZW4pIHtcbiAgdGhpcy5pZCA9IGlkO1xuXG4gIHRoaXMuX2h0dHBVcmwgKz0gJy8nICsgaWQgKyAnLycgKyB0b2tlbjtcbiAgdGhpcy5fd3NVcmwgKz0gJyZpZD0nICsgaWQgKyAnJnRva2VuPScgKyB0b2tlbjtcblxuICB0aGlzLl9zdGFydFhoclN0cmVhbSgpO1xuICB0aGlzLl9zdGFydFdlYlNvY2tldCgpO1xufVxuXG5cbi8qKiBTdGFydCB1cCB3ZWJzb2NrZXQgY29tbXVuaWNhdGlvbnMuICovXG5Tb2NrZXQucHJvdG90eXBlLl9zdGFydFdlYlNvY2tldCA9IGZ1bmN0aW9uKGlkKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAodGhpcy5fc29ja2V0KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5fc29ja2V0ID0gbmV3IFdlYlNvY2tldCh0aGlzLl93c1VybCk7XG5cbiAgdGhpcy5fc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIHV0aWwubG9nKCdJbnZhbGlkIHNlcnZlciBtZXNzYWdlJywgZXZlbnQuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNlbGYuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICB9O1xuXG4gIHRoaXMuX3NvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB1dGlsLmxvZygnU29ja2V0IGNsb3NlZC4nKTtcbiAgICBzZWxmLmRpc2Nvbm5lY3RlZCA9IHRydWU7XG4gICAgc2VsZi5lbWl0KCdkaXNjb25uZWN0ZWQnKTtcbiAgfTtcblxuICAvLyBUYWtlIGNhcmUgb2YgdGhlIHF1ZXVlIG9mIGNvbm5lY3Rpb25zIGlmIG5lY2Vzc2FyeSBhbmQgbWFrZSBzdXJlIFBlZXIga25vd3NcbiAgLy8gc29ja2V0IGlzIG9wZW4uXG4gIHRoaXMuX3NvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoc2VsZi5fdGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuX3RpbWVvdXQpO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICBzZWxmLl9odHRwLmFib3J0KCk7XG4gICAgICAgIHNlbGYuX2h0dHAgPSBudWxsO1xuICAgICAgfSwgNTAwMCk7XG4gICAgfVxuICAgIHNlbGYuX3NlbmRRdWV1ZWRNZXNzYWdlcygpO1xuICAgIHV0aWwubG9nKCdTb2NrZXQgb3BlbicpO1xuICB9O1xufVxuXG4vKiogU3RhcnQgWEhSIHN0cmVhbWluZy4gKi9cblNvY2tldC5wcm90b3R5cGUuX3N0YXJ0WGhyU3RyZWFtID0gZnVuY3Rpb24obikge1xuICB0cnkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9odHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdGhpcy5faHR0cC5faW5kZXggPSAxO1xuICAgIHRoaXMuX2h0dHAuX3N0cmVhbUluZGV4ID0gbiB8fCAwO1xuICAgIHRoaXMuX2h0dHAub3BlbigncG9zdCcsIHRoaXMuX2h0dHBVcmwgKyAnL2lkP2k9JyArIHRoaXMuX2h0dHAuX3N0cmVhbUluZGV4LCB0cnVlKTtcbiAgICB0aGlzLl9odHRwLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIC8vIElmIHdlIGdldCBhbiBlcnJvciwgbGlrZWx5IHNvbWV0aGluZyB3ZW50IHdyb25nLlxuICAgICAgLy8gU3RvcCBzdHJlYW1pbmcuXG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fdGltZW91dCk7XG4gICAgICBzZWxmLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIH1cbiAgICB0aGlzLl9odHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PSAyICYmIHRoaXMub2xkKSB7XG4gICAgICAgIHRoaXMub2xkLmFib3J0KCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm9sZDtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5yZWFkeVN0YXRlID4gMiAmJiB0aGlzLnN0YXR1cyA9PT0gMjAwICYmIHRoaXMucmVzcG9uc2VUZXh0KSB7XG4gICAgICAgIHNlbGYuX2hhbmRsZVN0cmVhbSh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHRoaXMuX2h0dHAuc2VuZChudWxsKTtcbiAgICB0aGlzLl9zZXRIVFRQVGltZW91dCgpO1xuICB9IGNhdGNoKGUpIHtcbiAgICB1dGlsLmxvZygnWE1MSHR0cFJlcXVlc3Qgbm90IGF2YWlsYWJsZTsgZGVmYXVsdGluZyB0byBXZWJTb2NrZXRzJyk7XG4gIH1cbn1cblxuXG4vKiogSGFuZGxlcyBvbnJlYWR5c3RhdGVjaGFuZ2UgcmVzcG9uc2UgYXMgYSBzdHJlYW0uICovXG5Tb2NrZXQucHJvdG90eXBlLl9oYW5kbGVTdHJlYW0gPSBmdW5jdGlvbihodHRwKSB7XG4gIC8vIDMgYW5kIDQgYXJlIGxvYWRpbmcvZG9uZSBzdGF0ZS4gQWxsIG90aGVycyBhcmUgbm90IHJlbGV2YW50LlxuICB2YXIgbWVzc2FnZXMgPSBodHRwLnJlc3BvbnNlVGV4dC5zcGxpdCgnXFxuJyk7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIGFueXRoaW5nIG5lZWRzIHRvIGJlIHByb2Nlc3NlZCBvbiBidWZmZXIuXG4gIGlmIChodHRwLl9idWZmZXIpIHtcbiAgICB3aGlsZSAoaHR0cC5fYnVmZmVyLmxlbmd0aCA+IDApIHtcbiAgICAgIHZhciBpbmRleCA9IGh0dHAuX2J1ZmZlci5zaGlmdCgpO1xuICAgICAgdmFyIGJ1ZmZlcmVkTWVzc2FnZSA9IG1lc3NhZ2VzW2luZGV4XTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGJ1ZmZlcmVkTWVzc2FnZSA9IEpTT04ucGFyc2UoYnVmZmVyZWRNZXNzYWdlKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBodHRwLl9idWZmZXIuc2hpZnQoaW5kZXgpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGJ1ZmZlcmVkTWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIG1lc3NhZ2UgPSBtZXNzYWdlc1todHRwLl9pbmRleF07XG4gIGlmIChtZXNzYWdlKSB7XG4gICAgaHR0cC5faW5kZXggKz0gMTtcbiAgICAvLyBCdWZmZXJpbmctLXRoaXMgbWVzc2FnZSBpcyBpbmNvbXBsZXRlIGFuZCB3ZSdsbCBnZXQgdG8gaXQgbmV4dCB0aW1lLlxuICAgIC8vIFRoaXMgY2hlY2tzIGlmIHRoZSBodHRwUmVzcG9uc2UgZW5kZWQgaW4gYSBgXFxuYCwgaW4gd2hpY2ggY2FzZSB0aGUgbGFzdFxuICAgIC8vIGVsZW1lbnQgb2YgbWVzc2FnZXMgc2hvdWxkIGJlIHRoZSBlbXB0eSBzdHJpbmcuXG4gICAgaWYgKGh0dHAuX2luZGV4ID09PSBtZXNzYWdlcy5sZW5ndGgpIHtcbiAgICAgIGlmICghaHR0cC5fYnVmZmVyKSB7XG4gICAgICAgIGh0dHAuX2J1ZmZlciA9IFtdO1xuICAgICAgfVxuICAgICAgaHR0cC5fYnVmZmVyLnB1c2goaHR0cC5faW5kZXggLSAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbWVzc2FnZSA9IEpTT04ucGFyc2UobWVzc2FnZSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgdXRpbC5sb2coJ0ludmFsaWQgc2VydmVyIG1lc3NhZ2UnLCBtZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgbWVzc2FnZSk7XG4gICAgfVxuICB9XG59XG5cblNvY2tldC5wcm90b3R5cGUuX3NldEhUVFBUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9sZCA9IHNlbGYuX2h0dHA7XG4gICAgaWYgKCFzZWxmLl93c09wZW4oKSkge1xuICAgICAgc2VsZi5fc3RhcnRYaHJTdHJlYW0ob2xkLl9zdHJlYW1JbmRleCArIDEpO1xuICAgICAgc2VsZi5faHR0cC5vbGQgPSBvbGQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZC5hYm9ydCgpO1xuICAgIH1cbiAgfSwgMjUwMDApO1xufVxuXG4vKiogSXMgdGhlIHdlYnNvY2tldCBjdXJyZW50bHkgb3Blbj8gKi9cblNvY2tldC5wcm90b3R5cGUuX3dzT3BlbiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fc29ja2V0ICYmIHRoaXMuX3NvY2tldC5yZWFkeVN0YXRlID09IDE7XG59XG5cbi8qKiBTZW5kIHF1ZXVlZCBtZXNzYWdlcy4gKi9cblNvY2tldC5wcm90b3R5cGUuX3NlbmRRdWV1ZWRNZXNzYWdlcyA9IGZ1bmN0aW9uKCkge1xuICBmb3IgKHZhciBpID0gMCwgaWkgPSB0aGlzLl9xdWV1ZS5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgdGhpcy5zZW5kKHRoaXMuX3F1ZXVlW2ldKTtcbiAgfVxufVxuXG4vKiogRXhwb3NlZCBzZW5kIGZvciBEQyAmIFBlZXIuICovXG5Tb2NrZXQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICh0aGlzLmRpc2Nvbm5lY3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIElmIHdlIGRpZG4ndCBnZXQgYW4gSUQgeWV0LCB3ZSBjYW4ndCB5ZXQgc2VuZCBhbnl0aGluZyBzbyB3ZSBzaG91bGQgcXVldWVcbiAgLy8gdXAgdGhlc2UgbWVzc2FnZXMuXG4gIGlmICghdGhpcy5pZCkge1xuICAgIHRoaXMuX3F1ZXVlLnB1c2goZGF0YSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCFkYXRhLnR5cGUpIHtcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgJ0ludmFsaWQgbWVzc2FnZScpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBtZXNzYWdlID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gIGlmICh0aGlzLl93c09wZW4oKSkge1xuICAgIHRoaXMuX3NvY2tldC5zZW5kKG1lc3NhZ2UpO1xuICB9IGVsc2Uge1xuICAgIHZhciBodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdmFyIHVybCA9IHRoaXMuX2h0dHBVcmwgKyAnLycgKyBkYXRhLnR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICBodHRwLm9wZW4oJ3Bvc3QnLCB1cmwsIHRydWUpO1xuICAgIGh0dHAuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBodHRwLnNlbmQobWVzc2FnZSk7XG4gIH1cbn1cblxuU29ja2V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuZGlzY29ubmVjdGVkICYmIHRoaXMuX3dzT3BlbigpKSB7XG4gICAgdGhpcy5fc29ja2V0LmNsb3NlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0ZWQgPSB0cnVlO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU29ja2V0O1xuIiwidmFyIGRlZmF1bHRDb25maWcgPSB7J2ljZVNlcnZlcnMnOiBbeyAndXJsJzogJ3N0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDInIH1dfTtcbnZhciBkYXRhQ291bnQgPSAxO1xuXG52YXIgQmluYXJ5UGFjayA9IHJlcXVpcmUoJ2pzLWJpbmFyeXBhY2snKTtcbnZhciBSVENQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vYWRhcHRlcicpLlJUQ1BlZXJDb25uZWN0aW9uO1xuXG52YXIgdXRpbCA9IHtcbiAgbm9vcDogZnVuY3Rpb24oKSB7fSxcblxuICBDTE9VRF9IT1NUOiAnMC5wZWVyanMuY29tJyxcbiAgQ0xPVURfUE9SVDogOTAwMCxcblxuICAvLyBCcm93c2VycyB0aGF0IG5lZWQgY2h1bmtpbmc6XG4gIGNodW5rZWRCcm93c2VyczogeydDaHJvbWUnOiAxfSxcbiAgY2h1bmtlZE1UVTogMTYzMDAsIC8vIFRoZSBvcmlnaW5hbCA2MDAwMCBieXRlcyBzZXR0aW5nIGRvZXMgbm90IHdvcmsgd2hlbiBzZW5kaW5nIGRhdGEgZnJvbSBGaXJlZm94IHRvIENocm9tZSwgd2hpY2ggaXMgXCJjdXQgb2ZmXCIgYWZ0ZXIgMTYzODQgYnl0ZXMgYW5kIGRlbGl2ZXJlZCBpbmRpdmlkdWFsbHkuXG5cbiAgLy8gTG9nZ2luZyBsb2dpY1xuICBsb2dMZXZlbDogMCxcbiAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgdmFyIGRlYnVnTGV2ZWwgPSBwYXJzZUludChsZXZlbCwgMTApO1xuICAgIGlmICghaXNOYU4ocGFyc2VJbnQobGV2ZWwsIDEwKSkpIHtcbiAgICAgIHV0aWwubG9nTGV2ZWwgPSBkZWJ1Z0xldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB0aGV5IGFyZSB1c2luZyB0cnV0aHkvZmFsc3kgdmFsdWVzIGZvciBkZWJ1Z1xuICAgICAgdXRpbC5sb2dMZXZlbCA9IGxldmVsID8gMyA6IDA7XG4gICAgfVxuICAgIHV0aWwubG9nID0gdXRpbC53YXJuID0gdXRpbC5lcnJvciA9IHV0aWwubm9vcDtcbiAgICBpZiAodXRpbC5sb2dMZXZlbCA+IDApIHtcbiAgICAgIHV0aWwuZXJyb3IgPSB1dGlsLl9wcmludFdpdGgoJ0VSUk9SJyk7XG4gICAgfVxuICAgIGlmICh1dGlsLmxvZ0xldmVsID4gMSkge1xuICAgICAgdXRpbC53YXJuID0gdXRpbC5fcHJpbnRXaXRoKCdXQVJOSU5HJyk7XG4gICAgfVxuICAgIGlmICh1dGlsLmxvZ0xldmVsID4gMikge1xuICAgICAgdXRpbC5sb2cgPSB1dGlsLl9wcmludDtcbiAgICB9XG4gIH0sXG4gIHNldExvZ0Z1bmN0aW9uOiBmdW5jdGlvbihmbikge1xuICAgIGlmIChmbi5jb25zdHJ1Y3RvciAhPT0gRnVuY3Rpb24pIHtcbiAgICAgIHV0aWwud2FybignVGhlIGxvZyBmdW5jdGlvbiB5b3UgcGFzc2VkIGluIGlzIG5vdCBhIGZ1bmN0aW9uLiBEZWZhdWx0aW5nIHRvIHJlZ3VsYXIgbG9ncy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXRpbC5fcHJpbnQgPSBmbjtcbiAgICB9XG4gIH0sXG5cbiAgX3ByaW50V2l0aDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgY29weS51bnNoaWZ0KHByZWZpeCk7XG4gICAgICB1dGlsLl9wcmludC5hcHBseSh1dGlsLCBjb3B5KTtcbiAgICB9O1xuICB9LFxuICBfcHJpbnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXJyID0gZmFsc2U7XG4gICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIGNvcHkudW5zaGlmdCgnUGVlckpTOiAnKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNvcHkubGVuZ3RoOyBpIDwgbDsgaSsrKXtcbiAgICAgIGlmIChjb3B5W2ldIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgY29weVtpXSA9ICcoJyArIGNvcHlbaV0ubmFtZSArICcpICcgKyBjb3B5W2ldLm1lc3NhZ2U7XG4gICAgICAgIGVyciA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGVyciA/IGNvbnNvbGUuZXJyb3IuYXBwbHkoY29uc29sZSwgY29weSkgOiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBjb3B5KTtcbiAgfSxcbiAgLy9cblxuICAvLyBSZXR1cm5zIGJyb3dzZXItYWdub3N0aWMgZGVmYXVsdCBjb25maWdcbiAgZGVmYXVsdENvbmZpZzogZGVmYXVsdENvbmZpZyxcbiAgLy9cblxuICAvLyBSZXR1cm5zIHRoZSBjdXJyZW50IGJyb3dzZXIuXG4gIGJyb3dzZXI6IChmdW5jdGlvbigpIHtcbiAgICBpZiAod2luZG93Lm1velJUQ1BlZXJDb25uZWN0aW9uKSB7XG4gICAgICByZXR1cm4gJ0ZpcmVmb3gnO1xuICAgIH0gZWxzZSBpZiAod2luZG93LndlYmtpdFJUQ1BlZXJDb25uZWN0aW9uKSB7XG4gICAgICByZXR1cm4gJ0Nocm9tZSc7XG4gICAgfSBlbHNlIGlmICh3aW5kb3cuUlRDUGVlckNvbm5lY3Rpb24pIHtcbiAgICAgIHJldHVybiAnU3VwcG9ydGVkJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdVbnN1cHBvcnRlZCc7XG4gICAgfVxuICB9KSgpLFxuICAvL1xuXG4gIC8vIExpc3RzIHdoaWNoIGZlYXR1cmVzIGFyZSBzdXBwb3J0ZWRcbiAgc3VwcG9ydHM6IChmdW5jdGlvbigpIHtcbiAgICBpZiAodHlwZW9mIFJUQ1BlZXJDb25uZWN0aW9uID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIHZhciBkYXRhID0gdHJ1ZTtcbiAgICB2YXIgYXVkaW9WaWRlbyA9IHRydWU7XG5cbiAgICB2YXIgYmluYXJ5QmxvYiA9IGZhbHNlO1xuICAgIHZhciBzY3RwID0gZmFsc2U7XG4gICAgdmFyIG9ubmVnb3RpYXRpb25uZWVkZWQgPSAhIXdpbmRvdy53ZWJraXRSVENQZWVyQ29ubmVjdGlvbjtcblxuICAgIHZhciBwYywgZGM7XG4gICAgdHJ5IHtcbiAgICAgIHBjID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKGRlZmF1bHRDb25maWcsIHtvcHRpb25hbDogW3tSdHBEYXRhQ2hhbm5lbHM6IHRydWV9XX0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRhdGEgPSBmYWxzZTtcbiAgICAgIGF1ZGlvVmlkZW8gPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZGMgPSBwYy5jcmVhdGVEYXRhQ2hhbm5lbCgnX1BFRVJKU1RFU1QnKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGF0YSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkYXRhKSB7XG4gICAgICAvLyBCaW5hcnkgdGVzdFxuICAgICAgdHJ5IHtcbiAgICAgICAgZGMuYmluYXJ5VHlwZSA9ICdibG9iJztcbiAgICAgICAgYmluYXJ5QmxvYiA9IHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbGlhYmxlIHRlc3QuXG4gICAgICAvLyBVbmZvcnR1bmF0ZWx5IENocm9tZSBpcyBhIGJpdCB1bnJlbGlhYmxlIGFib3V0IHdoZXRoZXIgb3Igbm90IHRoZXlcbiAgICAgIC8vIHN1cHBvcnQgcmVsaWFibGUuXG4gICAgICB2YXIgcmVsaWFibGVQQyA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihkZWZhdWx0Q29uZmlnLCB7fSk7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgcmVsaWFibGVEQyA9IHJlbGlhYmxlUEMuY3JlYXRlRGF0YUNoYW5uZWwoJ19QRUVSSlNSRUxJQUJMRVRFU1QnLCB7fSk7XG4gICAgICAgIHNjdHAgPSByZWxpYWJsZURDLnJlbGlhYmxlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgfVxuICAgICAgcmVsaWFibGVQQy5jbG9zZSgpO1xuICAgIH1cblxuICAgIC8vIEZJWE1FOiBub3QgcmVhbGx5IHRoZSBiZXN0IGNoZWNrLi4uXG4gICAgaWYgKGF1ZGlvVmlkZW8pIHtcbiAgICAgIGF1ZGlvVmlkZW8gPSAhIXBjLmFkZFN0cmVhbTtcbiAgICB9XG5cbiAgICAvLyBGSVhNRTogdGhpcyBpcyBub3QgZ3JlYXQgYmVjYXVzZSBpbiB0aGVvcnkgaXQgZG9lc24ndCB3b3JrIGZvclxuICAgIC8vIGF2LW9ubHkgYnJvd3NlcnMgKD8pLlxuICAgIGlmICghb25uZWdvdGlhdGlvbm5lZWRlZCAmJiBkYXRhKSB7XG4gICAgICAvLyBzeW5jIGRlZmF1bHQgY2hlY2suXG4gICAgICB2YXIgbmVnb3RpYXRpb25QQyA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihkZWZhdWx0Q29uZmlnLCB7b3B0aW9uYWw6IFt7UnRwRGF0YUNoYW5uZWxzOiB0cnVlfV19KTtcbiAgICAgIG5lZ290aWF0aW9uUEMub25uZWdvdGlhdGlvbm5lZWRlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBvbm5lZ290aWF0aW9ubmVlZGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gYXN5bmMgY2hlY2suXG4gICAgICAgIGlmICh1dGlsICYmIHV0aWwuc3VwcG9ydHMpIHtcbiAgICAgICAgICB1dGlsLnN1cHBvcnRzLm9ubmVnb3RpYXRpb25uZWVkZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgbmVnb3RpYXRpb25QQy5jcmVhdGVEYXRhQ2hhbm5lbCgnX1BFRVJKU05FR09USUFUSU9OVEVTVCcpO1xuXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBuZWdvdGlhdGlvblBDLmNsb3NlKCk7XG4gICAgICB9LCAxMDAwKTtcbiAgICB9XG5cbiAgICBpZiAocGMpIHtcbiAgICAgIHBjLmNsb3NlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGF1ZGlvVmlkZW86IGF1ZGlvVmlkZW8sXG4gICAgICBkYXRhOiBkYXRhLFxuICAgICAgYmluYXJ5QmxvYjogYmluYXJ5QmxvYixcbiAgICAgIGJpbmFyeTogc2N0cCwgLy8gZGVwcmVjYXRlZDsgc2N0cCBpbXBsaWVzIGJpbmFyeSBzdXBwb3J0LlxuICAgICAgcmVsaWFibGU6IHNjdHAsIC8vIGRlcHJlY2F0ZWQ7IHNjdHAgaW1wbGllcyByZWxpYWJsZSBkYXRhLlxuICAgICAgc2N0cDogc2N0cCxcbiAgICAgIG9ubmVnb3RpYXRpb25uZWVkZWQ6IG9ubmVnb3RpYXRpb25uZWVkZWRcbiAgICB9O1xuICB9KCkpLFxuICAvL1xuXG4gIC8vIEVuc3VyZSBhbHBoYW51bWVyaWMgaWRzXG4gIHZhbGlkYXRlSWQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgLy8gQWxsb3cgZW1wdHkgaWRzXG4gICAgcmV0dXJuICFpZCB8fCAvXltBLVphLXowLTldKyg/OlsgXy1dW0EtWmEtejAtOV0rKSokLy5leGVjKGlkKTtcbiAgfSxcblxuICB2YWxpZGF0ZUtleTogZnVuY3Rpb24oa2V5KSB7XG4gICAgLy8gQWxsb3cgZW1wdHkga2V5c1xuICAgIHJldHVybiAha2V5IHx8IC9eW0EtWmEtejAtOV0rKD86WyBfLV1bQS1aYS16MC05XSspKiQvLmV4ZWMoa2V5KTtcbiAgfSxcblxuXG4gIGRlYnVnOiBmYWxzZSxcblxuICBpbmhlcml0czogZnVuY3Rpb24oY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3I7XG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBleHRlbmQ6IGZ1bmN0aW9uKGRlc3QsIHNvdXJjZSkge1xuICAgIGZvcih2YXIga2V5IGluIHNvdXJjZSkge1xuICAgICAgaWYoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgZGVzdFtrZXldID0gc291cmNlW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZXN0O1xuICB9LFxuICBwYWNrOiBCaW5hcnlQYWNrLnBhY2ssXG4gIHVucGFjazogQmluYXJ5UGFjay51bnBhY2ssXG5cbiAgbG9nOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHV0aWwuZGVidWcpIHtcbiAgICAgIHZhciBlcnIgPSBmYWxzZTtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGNvcHkudW5zaGlmdCgnUGVlckpTOiAnKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY29weS5sZW5ndGg7IGkgPCBsOyBpKyspe1xuICAgICAgICBpZiAoY29weVtpXSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgY29weVtpXSA9ICcoJyArIGNvcHlbaV0ubmFtZSArICcpICcgKyBjb3B5W2ldLm1lc3NhZ2U7XG4gICAgICAgICAgZXJyID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZXJyID8gY29uc29sZS5lcnJvci5hcHBseShjb25zb2xlLCBjb3B5KSA6IGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIGNvcHkpO1xuICAgIH1cbiAgfSxcblxuICBzZXRaZXJvVGltZW91dDogKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAgIHZhciB0aW1lb3V0cyA9IFtdO1xuICAgIHZhciBtZXNzYWdlTmFtZSA9ICd6ZXJvLXRpbWVvdXQtbWVzc2FnZSc7XG5cbiAgICAvLyBMaWtlIHNldFRpbWVvdXQsIGJ1dCBvbmx5IHRha2VzIGEgZnVuY3Rpb24gYXJndW1lbnQuXHQgVGhlcmUnc1xuICAgIC8vIG5vIHRpbWUgYXJndW1lbnQgKGFsd2F5cyB6ZXJvKSBhbmQgbm8gYXJndW1lbnRzICh5b3UgaGF2ZSB0b1xuICAgIC8vIHVzZSBhIGNsb3N1cmUpLlxuICAgIGZ1bmN0aW9uIHNldFplcm9UaW1lb3V0UG9zdE1lc3NhZ2UoZm4pIHtcbiAgICAgIHRpbWVvdXRzLnB1c2goZm4pO1xuICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKG1lc3NhZ2VOYW1lLCAnKicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZU1lc3NhZ2UoZXZlbnQpIHtcbiAgICAgIGlmIChldmVudC5zb3VyY2UgPT0gZ2xvYmFsICYmIGV2ZW50LmRhdGEgPT0gbWVzc2FnZU5hbWUpIHtcbiAgICAgICAgaWYgKGV2ZW50LnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aW1lb3V0cy5sZW5ndGgpIHtcbiAgICAgICAgICB0aW1lb3V0cy5zaGlmdCgpKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZU1lc3NhZ2UsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoZ2xvYmFsLmF0dGFjaEV2ZW50KSB7XG4gICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGhhbmRsZU1lc3NhZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gc2V0WmVyb1RpbWVvdXRQb3N0TWVzc2FnZTtcbiAgfSh3aW5kb3cpKSxcblxuICAvLyBCaW5hcnkgc3R1ZmZcblxuICAvLyBjaHVua3MgYSBibG9iLlxuICBjaHVuazogZnVuY3Rpb24oYmwpIHtcbiAgICB2YXIgY2h1bmtzID0gW107XG4gICAgdmFyIHNpemUgPSBibC5zaXplO1xuICAgIHZhciBzdGFydCA9IGluZGV4ID0gMDtcbiAgICB2YXIgdG90YWwgPSBNYXRoLmNlaWwoc2l6ZSAvIHV0aWwuY2h1bmtlZE1UVSk7XG4gICAgd2hpbGUgKHN0YXJ0IDwgc2l6ZSkge1xuICAgICAgdmFyIGVuZCA9IE1hdGgubWluKHNpemUsIHN0YXJ0ICsgdXRpbC5jaHVua2VkTVRVKTtcbiAgICAgIHZhciBiID0gYmwuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgICAgIHZhciBjaHVuayA9IHtcbiAgICAgICAgX19wZWVyRGF0YTogZGF0YUNvdW50LFxuICAgICAgICBuOiBpbmRleCxcbiAgICAgICAgZGF0YTogYixcbiAgICAgICAgdG90YWw6IHRvdGFsXG4gICAgICB9O1xuXG4gICAgICBjaHVua3MucHVzaChjaHVuayk7XG5cbiAgICAgIHN0YXJ0ID0gZW5kO1xuICAgICAgaW5kZXggKz0gMTtcbiAgICB9XG4gICAgZGF0YUNvdW50ICs9IDE7XG4gICAgcmV0dXJuIGNodW5rcztcbiAgfSxcblxuICBibG9iVG9BcnJheUJ1ZmZlcjogZnVuY3Rpb24oYmxvYiwgY2Ipe1xuICAgIHZhciBmciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgZnIub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBjYihldnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgfTtcbiAgICBmci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcbiAgfSxcbiAgYmxvYlRvQmluYXJ5U3RyaW5nOiBmdW5jdGlvbihibG9iLCBjYil7XG4gICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICBmci5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIGNiKGV2dC50YXJnZXQucmVzdWx0KTtcbiAgICB9O1xuICAgIGZyLnJlYWRBc0JpbmFyeVN0cmluZyhibG9iKTtcbiAgfSxcbiAgYmluYXJ5U3RyaW5nVG9BcnJheUJ1ZmZlcjogZnVuY3Rpb24oYmluYXJ5KSB7XG4gICAgdmFyIGJ5dGVBcnJheSA9IG5ldyBVaW50OEFycmF5KGJpbmFyeS5sZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYmluYXJ5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBieXRlQXJyYXlbaV0gPSBiaW5hcnkuY2hhckNvZGVBdChpKSAmIDB4ZmY7XG4gICAgfVxuICAgIHJldHVybiBieXRlQXJyYXkuYnVmZmVyO1xuICB9LFxuICByYW5kb21Ub2tlbjogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMik7XG4gIH0sXG4gIC8vXG5cbiAgaXNTZWN1cmU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdXRpbDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBSZXByZXNlbnRhdGlvbiBvZiBhIHNpbmdsZSBFdmVudEVtaXR0ZXIgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gRXZlbnQgaGFuZGxlciB0byBiZSBjYWxsZWQuXG4gKiBAcGFyYW0ge01peGVkfSBjb250ZXh0IENvbnRleHQgZm9yIGZ1bmN0aW9uIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb25jZSBPbmx5IGVtaXQgb25jZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIEVFKGZuLCBjb250ZXh0LCBvbmNlKSB7XG4gIHRoaXMuZm4gPSBmbjtcbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgdGhpcy5vbmNlID0gb25jZSB8fCBmYWxzZTtcbn1cblxuLyoqXG4gKiBNaW5pbWFsIEV2ZW50RW1pdHRlciBpbnRlcmZhY2UgdGhhdCBpcyBtb2xkZWQgYWdhaW5zdCB0aGUgTm9kZS5qc1xuICogRXZlbnRFbWl0dGVyIGludGVyZmFjZS5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBhcGkgcHVibGljXG4gKi9cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHsgLyogTm90aGluZyB0byBzZXQgKi8gfVxuXG4vKipcbiAqIEhvbGRzIHRoZSBhc3NpZ25lZCBFdmVudEVtaXR0ZXJzIGJ5IG5hbWUuXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBSZXR1cm4gYSBsaXN0IG9mIGFzc2lnbmVkIGV2ZW50IGxpc3RlbmVycy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgVGhlIGV2ZW50cyB0aGF0IHNob3VsZCBiZSBsaXN0ZWQuXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uIGxpc3RlbmVycyhldmVudCkge1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW2V2ZW50XSkgcmV0dXJuIFtdO1xuICBpZiAodGhpcy5fZXZlbnRzW2V2ZW50XS5mbikgcmV0dXJuIFt0aGlzLl9ldmVudHNbZXZlbnRdLmZuXTtcblxuICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuX2V2ZW50c1tldmVudF0ubGVuZ3RoLCBlZSA9IG5ldyBBcnJheShsKTsgaSA8IGw7IGkrKykge1xuICAgIGVlW2ldID0gdGhpcy5fZXZlbnRzW2V2ZW50XVtpXS5mbjtcbiAgfVxuXG4gIHJldHVybiBlZTtcbn07XG5cbi8qKlxuICogRW1pdCBhbiBldmVudCB0byBhbGwgcmVnaXN0ZXJlZCBldmVudCBsaXN0ZW5lcnMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IFRoZSBuYW1lIG9mIHRoZSBldmVudC5cbiAqIEByZXR1cm5zIHtCb29sZWFufSBJbmRpY2F0aW9uIGlmIHdlJ3ZlIGVtaXR0ZWQgYW4gZXZlbnQuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiBlbWl0KGV2ZW50LCBhMSwgYTIsIGEzLCBhNCwgYTUpIHtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1tldmVudF0pIHJldHVybiBmYWxzZTtcblxuICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW2V2ZW50XVxuICAgICwgbGVuID0gYXJndW1lbnRzLmxlbmd0aFxuICAgICwgYXJnc1xuICAgICwgaTtcblxuICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxpc3RlbmVycy5mbikge1xuICAgIGlmIChsaXN0ZW5lcnMub25jZSkgdGhpcy5yZW1vdmVMaXN0ZW5lcihldmVudCwgbGlzdGVuZXJzLmZuLCB0cnVlKTtcblxuICAgIHN3aXRjaCAobGVuKSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCksIHRydWU7XG4gICAgICBjYXNlIDI6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCwgYTEpLCB0cnVlO1xuICAgICAgY2FzZSAzOiByZXR1cm4gbGlzdGVuZXJzLmZuLmNhbGwobGlzdGVuZXJzLmNvbnRleHQsIGExLCBhMiksIHRydWU7XG4gICAgICBjYXNlIDQ6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCwgYTEsIGEyLCBhMyksIHRydWU7XG4gICAgICBjYXNlIDU6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCwgYTEsIGEyLCBhMywgYTQpLCB0cnVlO1xuICAgICAgY2FzZSA2OiByZXR1cm4gbGlzdGVuZXJzLmZuLmNhbGwobGlzdGVuZXJzLmNvbnRleHQsIGExLCBhMiwgYTMsIGE0LCBhNSksIHRydWU7XG4gICAgfVxuXG4gICAgZm9yIChpID0gMSwgYXJncyA9IG5ldyBBcnJheShsZW4gLTEpOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgIH1cblxuICAgIGxpc3RlbmVycy5mbi5hcHBseShsaXN0ZW5lcnMuY29udGV4dCwgYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGxlbmd0aCA9IGxpc3RlbmVycy5sZW5ndGhcbiAgICAgICwgajtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGxpc3RlbmVyc1tpXS5vbmNlKSB0aGlzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcnNbaV0uZm4sIHRydWUpO1xuXG4gICAgICBzd2l0Y2ggKGxlbikge1xuICAgICAgICBjYXNlIDE6IGxpc3RlbmVyc1tpXS5mbi5jYWxsKGxpc3RlbmVyc1tpXS5jb250ZXh0KTsgYnJlYWs7XG4gICAgICAgIGNhc2UgMjogbGlzdGVuZXJzW2ldLmZuLmNhbGwobGlzdGVuZXJzW2ldLmNvbnRleHQsIGExKTsgYnJlYWs7XG4gICAgICAgIGNhc2UgMzogbGlzdGVuZXJzW2ldLmZuLmNhbGwobGlzdGVuZXJzW2ldLmNvbnRleHQsIGExLCBhMik7IGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICghYXJncykgZm9yIChqID0gMSwgYXJncyA9IG5ldyBBcnJheShsZW4gLTEpOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaiAtIDFdID0gYXJndW1lbnRzW2pdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpc3RlbmVyc1tpXS5mbi5hcHBseShsaXN0ZW5lcnNbaV0uY29udGV4dCwgYXJncyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgbmV3IEV2ZW50TGlzdGVuZXIgZm9yIHRoZSBnaXZlbiBldmVudC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgTmFtZSBvZiB0aGUgZXZlbnQuXG4gKiBAcGFyYW0ge0Z1bmN0b259IGZuIENhbGxiYWNrIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtNaXhlZH0gY29udGV4dCBUaGUgY29udGV4dCBvZiB0aGUgZnVuY3Rpb24uXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gb24oZXZlbnQsIGZuLCBjb250ZXh0KSB7XG4gIHZhciBsaXN0ZW5lciA9IG5ldyBFRShmbiwgY29udGV4dCB8fCB0aGlzKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cykgdGhpcy5fZXZlbnRzID0ge307XG4gIGlmICghdGhpcy5fZXZlbnRzW2V2ZW50XSkgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IGxpc3RlbmVyO1xuICBlbHNlIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50c1tldmVudF0uZm4pIHRoaXMuX2V2ZW50c1tldmVudF0ucHVzaChsaXN0ZW5lcik7XG4gICAgZWxzZSB0aGlzLl9ldmVudHNbZXZlbnRdID0gW1xuICAgICAgdGhpcy5fZXZlbnRzW2V2ZW50XSwgbGlzdGVuZXJcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZCBhbiBFdmVudExpc3RlbmVyIHRoYXQncyBvbmx5IGNhbGxlZCBvbmNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBOYW1lIG9mIHRoZSBldmVudC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIENhbGxiYWNrIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtNaXhlZH0gY29udGV4dCBUaGUgY29udGV4dCBvZiB0aGUgZnVuY3Rpb24uXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbiBvbmNlKGV2ZW50LCBmbiwgY29udGV4dCkge1xuICB2YXIgbGlzdGVuZXIgPSBuZXcgRUUoZm4sIGNvbnRleHQgfHwgdGhpcywgdHJ1ZSk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpIHRoaXMuX2V2ZW50cyA9IHt9O1xuICBpZiAoIXRoaXMuX2V2ZW50c1tldmVudF0pIHRoaXMuX2V2ZW50c1tldmVudF0gPSBsaXN0ZW5lcjtcbiAgZWxzZSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHNbZXZlbnRdLmZuKSB0aGlzLl9ldmVudHNbZXZlbnRdLnB1c2gobGlzdGVuZXIpO1xuICAgIGVsc2UgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IFtcbiAgICAgIHRoaXMuX2V2ZW50c1tldmVudF0sIGxpc3RlbmVyXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgZXZlbnQgbGlzdGVuZXJzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBUaGUgZXZlbnQgd2Ugd2FudCB0byByZW1vdmUuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgbGlzdGVuZXIgdGhhdCB3ZSBuZWVkIHRvIGZpbmQuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9uY2UgT25seSByZW1vdmUgb25jZSBsaXN0ZW5lcnMuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGZuLCBvbmNlKSB7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbZXZlbnRdKSByZXR1cm4gdGhpcztcblxuICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW2V2ZW50XVxuICAgICwgZXZlbnRzID0gW107XG5cbiAgaWYgKGZuKSB7XG4gICAgaWYgKGxpc3RlbmVycy5mbiAmJiAobGlzdGVuZXJzLmZuICE9PSBmbiB8fCAob25jZSAmJiAhbGlzdGVuZXJzLm9uY2UpKSkge1xuICAgICAgZXZlbnRzLnB1c2gobGlzdGVuZXJzKTtcbiAgICB9XG4gICAgaWYgKCFsaXN0ZW5lcnMuZm4pIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChsaXN0ZW5lcnNbaV0uZm4gIT09IGZuIHx8IChvbmNlICYmICFsaXN0ZW5lcnNbaV0ub25jZSkpIHtcbiAgICAgICAgZXZlbnRzLnB1c2gobGlzdGVuZXJzW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL1xuICAvLyBSZXNldCB0aGUgYXJyYXksIG9yIHJlbW92ZSBpdCBjb21wbGV0ZWx5IGlmIHdlIGhhdmUgbm8gbW9yZSBsaXN0ZW5lcnMuXG4gIC8vXG4gIGlmIChldmVudHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IGV2ZW50cy5sZW5ndGggPT09IDEgPyBldmVudHNbMF0gOiBldmVudHM7XG4gIH0gZWxzZSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1tldmVudF07XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgb3Igb25seSB0aGUgbGlzdGVuZXJzIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBUaGUgZXZlbnQgd2FudCB0byByZW1vdmUgYWxsIGxpc3RlbmVycyBmb3IuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uIHJlbW92ZUFsbExpc3RlbmVycyhldmVudCkge1xuICBpZiAoIXRoaXMuX2V2ZW50cykgcmV0dXJuIHRoaXM7XG5cbiAgaWYgKGV2ZW50KSBkZWxldGUgdGhpcy5fZXZlbnRzW2V2ZW50XTtcbiAgZWxzZSB0aGlzLl9ldmVudHMgPSB7fTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vXG4vLyBBbGlhcyBtZXRob2RzIG5hbWVzIGJlY2F1c2UgcGVvcGxlIHJvbGwgbGlrZSB0aGF0LlxuLy9cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uO1xuXG4vL1xuLy8gVGhpcyBmdW5jdGlvbiBkb2Vzbid0IGFwcGx5IGFueW1vcmUuXG4vL1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbiBzZXRNYXhMaXN0ZW5lcnMoKSB7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy9cbi8vIEV4cG9zZSB0aGUgbW9kdWxlLlxuLy9cbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIzID0gRXZlbnRFbWl0dGVyO1xuXG4vL1xuLy8gRXhwb3NlIHRoZSBtb2R1bGUuXG4vL1xubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG4iLCJ2YXIgQnVmZmVyQnVpbGRlciA9IHJlcXVpcmUoJy4vYnVmZmVyYnVpbGRlcicpLkJ1ZmZlckJ1aWxkZXI7XHJcbnZhciBiaW5hcnlGZWF0dXJlcyA9IHJlcXVpcmUoJy4vYnVmZmVyYnVpbGRlcicpLmJpbmFyeUZlYXR1cmVzO1xyXG5cclxudmFyIEJpbmFyeVBhY2sgPSB7XHJcbiAgdW5wYWNrOiBmdW5jdGlvbihkYXRhKXtcclxuICAgIHZhciB1bnBhY2tlciA9IG5ldyBVbnBhY2tlcihkYXRhKTtcclxuICAgIHJldHVybiB1bnBhY2tlci51bnBhY2soKTtcclxuICB9LFxyXG4gIHBhY2s6IGZ1bmN0aW9uKGRhdGEpe1xyXG4gICAgdmFyIHBhY2tlciA9IG5ldyBQYWNrZXIoKTtcclxuICAgIHBhY2tlci5wYWNrKGRhdGEpO1xyXG4gICAgdmFyIGJ1ZmZlciA9IHBhY2tlci5nZXRCdWZmZXIoKTtcclxuICAgIHJldHVybiBidWZmZXI7XHJcbiAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnlQYWNrO1xyXG5cclxuZnVuY3Rpb24gVW5wYWNrZXIgKGRhdGEpe1xyXG4gIC8vIERhdGEgaXMgQXJyYXlCdWZmZXJcclxuICB0aGlzLmluZGV4ID0gMDtcclxuICB0aGlzLmRhdGFCdWZmZXIgPSBkYXRhO1xyXG4gIHRoaXMuZGF0YVZpZXcgPSBuZXcgVWludDhBcnJheSh0aGlzLmRhdGFCdWZmZXIpO1xyXG4gIHRoaXMubGVuZ3RoID0gdGhpcy5kYXRhQnVmZmVyLmJ5dGVMZW5ndGg7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2sgPSBmdW5jdGlvbigpe1xyXG4gIHZhciB0eXBlID0gdGhpcy51bnBhY2tfdWludDgoKTtcclxuICBpZiAodHlwZSA8IDB4ODApe1xyXG4gICAgdmFyIHBvc2l0aXZlX2ZpeG51bSA9IHR5cGU7XHJcbiAgICByZXR1cm4gcG9zaXRpdmVfZml4bnVtO1xyXG4gIH0gZWxzZSBpZiAoKHR5cGUgXiAweGUwKSA8IDB4MjApe1xyXG4gICAgdmFyIG5lZ2F0aXZlX2ZpeG51bSA9ICh0eXBlIF4gMHhlMCkgLSAweDIwO1xyXG4gICAgcmV0dXJuIG5lZ2F0aXZlX2ZpeG51bTtcclxuICB9XHJcbiAgdmFyIHNpemU7XHJcbiAgaWYgKChzaXplID0gdHlwZSBeIDB4YTApIDw9IDB4MGYpe1xyXG4gICAgcmV0dXJuIHRoaXMudW5wYWNrX3JhdyhzaXplKTtcclxuICB9IGVsc2UgaWYgKChzaXplID0gdHlwZSBeIDB4YjApIDw9IDB4MGYpe1xyXG4gICAgcmV0dXJuIHRoaXMudW5wYWNrX3N0cmluZyhzaXplKTtcclxuICB9IGVsc2UgaWYgKChzaXplID0gdHlwZSBeIDB4OTApIDw9IDB4MGYpe1xyXG4gICAgcmV0dXJuIHRoaXMudW5wYWNrX2FycmF5KHNpemUpO1xyXG4gIH0gZWxzZSBpZiAoKHNpemUgPSB0eXBlIF4gMHg4MCkgPD0gMHgwZil7XHJcbiAgICByZXR1cm4gdGhpcy51bnBhY2tfbWFwKHNpemUpO1xyXG4gIH1cclxuICBzd2l0Y2godHlwZSl7XHJcbiAgICBjYXNlIDB4YzA6XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgY2FzZSAweGMxOlxyXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY2FzZSAweGMyOlxyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICBjYXNlIDB4YzM6XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgY2FzZSAweGNhOlxyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfZmxvYXQoKTtcclxuICAgIGNhc2UgMHhjYjpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX2RvdWJsZSgpO1xyXG4gICAgY2FzZSAweGNjOlxyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfdWludDgoKTtcclxuICAgIGNhc2UgMHhjZDpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX3VpbnQxNigpO1xyXG4gICAgY2FzZSAweGNlOlxyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfdWludDMyKCk7XHJcbiAgICBjYXNlIDB4Y2Y6XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja191aW50NjQoKTtcclxuICAgIGNhc2UgMHhkMDpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX2ludDgoKTtcclxuICAgIGNhc2UgMHhkMTpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX2ludDE2KCk7XHJcbiAgICBjYXNlIDB4ZDI6XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19pbnQzMigpO1xyXG4gICAgY2FzZSAweGQzOlxyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfaW50NjQoKTtcclxuICAgIGNhc2UgMHhkNDpcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNhc2UgMHhkNTpcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNhc2UgMHhkNjpcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNhc2UgMHhkNzpcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNhc2UgMHhkODpcclxuICAgICAgc2l6ZSA9IHRoaXMudW5wYWNrX3VpbnQxNigpO1xyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfc3RyaW5nKHNpemUpO1xyXG4gICAgY2FzZSAweGQ5OlxyXG4gICAgICBzaXplID0gdGhpcy51bnBhY2tfdWludDMyKCk7XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19zdHJpbmcoc2l6ZSk7XHJcbiAgICBjYXNlIDB4ZGE6XHJcbiAgICAgIHNpemUgPSB0aGlzLnVucGFja191aW50MTYoKTtcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX3JhdyhzaXplKTtcclxuICAgIGNhc2UgMHhkYjpcclxuICAgICAgc2l6ZSA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfcmF3KHNpemUpO1xyXG4gICAgY2FzZSAweGRjOlxyXG4gICAgICBzaXplID0gdGhpcy51bnBhY2tfdWludDE2KCk7XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19hcnJheShzaXplKTtcclxuICAgIGNhc2UgMHhkZDpcclxuICAgICAgc2l6ZSA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfYXJyYXkoc2l6ZSk7XHJcbiAgICBjYXNlIDB4ZGU6XHJcbiAgICAgIHNpemUgPSB0aGlzLnVucGFja191aW50MTYoKTtcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX21hcChzaXplKTtcclxuICAgIGNhc2UgMHhkZjpcclxuICAgICAgc2l6ZSA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfbWFwKHNpemUpO1xyXG4gIH1cclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja191aW50OCA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIGJ5dGUgPSB0aGlzLmRhdGFWaWV3W3RoaXMuaW5kZXhdICYgMHhmZjtcclxuICB0aGlzLmluZGV4Kys7XHJcbiAgcmV0dXJuIGJ5dGU7XHJcbn07XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX3VpbnQxNiA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkKDIpO1xyXG4gIHZhciB1aW50MTYgPVxyXG4gICAgKChieXRlc1swXSAmIDB4ZmYpICogMjU2KSArIChieXRlc1sxXSAmIDB4ZmYpO1xyXG4gIHRoaXMuaW5kZXggKz0gMjtcclxuICByZXR1cm4gdWludDE2O1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX3VpbnQzMiA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkKDQpO1xyXG4gIHZhciB1aW50MzIgPVxyXG4gICAgICgoYnl0ZXNbMF0gICogMjU2ICtcclxuICAgICAgIGJ5dGVzWzFdKSAqIDI1NiArXHJcbiAgICAgICBieXRlc1syXSkgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbM107XHJcbiAgdGhpcy5pbmRleCArPSA0O1xyXG4gIHJldHVybiB1aW50MzI7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfdWludDY0ID0gZnVuY3Rpb24oKXtcclxuICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWQoOCk7XHJcbiAgdmFyIHVpbnQ2NCA9XHJcbiAgICgoKCgoKGJ5dGVzWzBdICAqIDI1NiArXHJcbiAgICAgICBieXRlc1sxXSkgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbMl0pICogMjU2ICtcclxuICAgICAgIGJ5dGVzWzNdKSAqIDI1NiArXHJcbiAgICAgICBieXRlc1s0XSkgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbNV0pICogMjU2ICtcclxuICAgICAgIGJ5dGVzWzZdKSAqIDI1NiArXHJcbiAgICAgICBieXRlc1s3XTtcclxuICB0aGlzLmluZGV4ICs9IDg7XHJcbiAgcmV0dXJuIHVpbnQ2NDtcclxufVxyXG5cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfaW50OCA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIHVpbnQ4ID0gdGhpcy51bnBhY2tfdWludDgoKTtcclxuICByZXR1cm4gKHVpbnQ4IDwgMHg4MCApID8gdWludDggOiB1aW50OCAtICgxIDw8IDgpO1xyXG59O1xyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja19pbnQxNiA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIHVpbnQxNiA9IHRoaXMudW5wYWNrX3VpbnQxNigpO1xyXG4gIHJldHVybiAodWludDE2IDwgMHg4MDAwICkgPyB1aW50MTYgOiB1aW50MTYgLSAoMSA8PCAxNik7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfaW50MzIgPSBmdW5jdGlvbigpe1xyXG4gIHZhciB1aW50MzIgPSB0aGlzLnVucGFja191aW50MzIoKTtcclxuICByZXR1cm4gKHVpbnQzMiA8IE1hdGgucG93KDIsIDMxKSApID8gdWludDMyIDpcclxuICAgIHVpbnQzMiAtIE1hdGgucG93KDIsIDMyKTtcclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja19pbnQ2NCA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIHVpbnQ2NCA9IHRoaXMudW5wYWNrX3VpbnQ2NCgpO1xyXG4gIHJldHVybiAodWludDY0IDwgTWF0aC5wb3coMiwgNjMpICkgPyB1aW50NjQgOlxyXG4gICAgdWludDY0IC0gTWF0aC5wb3coMiwgNjQpO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX3JhdyA9IGZ1bmN0aW9uKHNpemUpe1xyXG4gIGlmICggdGhpcy5sZW5ndGggPCB0aGlzLmluZGV4ICsgc2l6ZSl7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0JpbmFyeVBhY2tGYWlsdXJlOiBpbmRleCBpcyBvdXQgb2YgcmFuZ2UnXHJcbiAgICAgICsgJyAnICsgdGhpcy5pbmRleCArICcgJyArIHNpemUgKyAnICcgKyB0aGlzLmxlbmd0aCk7XHJcbiAgfVxyXG4gIHZhciBidWYgPSB0aGlzLmRhdGFCdWZmZXIuc2xpY2UodGhpcy5pbmRleCwgdGhpcy5pbmRleCArIHNpemUpO1xyXG4gIHRoaXMuaW5kZXggKz0gc2l6ZTtcclxuXHJcbiAgICAvL2J1ZiA9IHV0aWwuYnVmZmVyVG9TdHJpbmcoYnVmKTtcclxuXHJcbiAgcmV0dXJuIGJ1ZjtcclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja19zdHJpbmcgPSBmdW5jdGlvbihzaXplKXtcclxuICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWQoc2l6ZSk7XHJcbiAgdmFyIGkgPSAwLCBzdHIgPSAnJywgYywgY29kZTtcclxuICB3aGlsZShpIDwgc2l6ZSl7XHJcbiAgICBjID0gYnl0ZXNbaV07XHJcbiAgICBpZiAoIGMgPCAxMjgpe1xyXG4gICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjKTtcclxuICAgICAgaSsrO1xyXG4gICAgfSBlbHNlIGlmICgoYyBeIDB4YzApIDwgMzIpe1xyXG4gICAgICBjb2RlID0gKChjIF4gMHhjMCkgPDwgNikgfCAoYnl0ZXNbaSsxXSAmIDYzKTtcclxuICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZSk7XHJcbiAgICAgIGkgKz0gMjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvZGUgPSAoKGMgJiAxNSkgPDwgMTIpIHwgKChieXRlc1tpKzFdICYgNjMpIDw8IDYpIHxcclxuICAgICAgICAoYnl0ZXNbaSsyXSAmIDYzKTtcclxuICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZSk7XHJcbiAgICAgIGkgKz0gMztcclxuICAgIH1cclxuICB9XHJcbiAgdGhpcy5pbmRleCArPSBzaXplO1xyXG4gIHJldHVybiBzdHI7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfYXJyYXkgPSBmdW5jdGlvbihzaXplKXtcclxuICB2YXIgb2JqZWN0cyA9IG5ldyBBcnJheShzaXplKTtcclxuICBmb3IodmFyIGkgPSAwOyBpIDwgc2l6ZSA7IGkrKyl7XHJcbiAgICBvYmplY3RzW2ldID0gdGhpcy51bnBhY2soKTtcclxuICB9XHJcbiAgcmV0dXJuIG9iamVjdHM7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfbWFwID0gZnVuY3Rpb24oc2l6ZSl7XHJcbiAgdmFyIG1hcCA9IHt9O1xyXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBzaXplIDsgaSsrKXtcclxuICAgIHZhciBrZXkgID0gdGhpcy51bnBhY2soKTtcclxuICAgIHZhciB2YWx1ZSA9IHRoaXMudW5wYWNrKCk7XHJcbiAgICBtYXBba2V5XSA9IHZhbHVlO1xyXG4gIH1cclxuICByZXR1cm4gbWFwO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX2Zsb2F0ID0gZnVuY3Rpb24oKXtcclxuICB2YXIgdWludDMyID0gdGhpcy51bnBhY2tfdWludDMyKCk7XHJcbiAgdmFyIHNpZ24gPSB1aW50MzIgPj4gMzE7XHJcbiAgdmFyIGV4cCAgPSAoKHVpbnQzMiA+PiAyMykgJiAweGZmKSAtIDEyNztcclxuICB2YXIgZnJhY3Rpb24gPSAoIHVpbnQzMiAmIDB4N2ZmZmZmICkgfCAweDgwMDAwMDtcclxuICByZXR1cm4gKHNpZ24gPT0gMCA/IDEgOiAtMSkgKlxyXG4gICAgZnJhY3Rpb24gKiBNYXRoLnBvdygyLCBleHAgLSAyMyk7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfZG91YmxlID0gZnVuY3Rpb24oKXtcclxuICB2YXIgaDMyID0gdGhpcy51bnBhY2tfdWludDMyKCk7XHJcbiAgdmFyIGwzMiA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gIHZhciBzaWduID0gaDMyID4+IDMxO1xyXG4gIHZhciBleHAgID0gKChoMzIgPj4gMjApICYgMHg3ZmYpIC0gMTAyMztcclxuICB2YXIgaGZyYWMgPSAoIGgzMiAmIDB4ZmZmZmYgKSB8IDB4MTAwMDAwO1xyXG4gIHZhciBmcmFjID0gaGZyYWMgKiBNYXRoLnBvdygyLCBleHAgLSAyMCkgK1xyXG4gICAgbDMyICAgKiBNYXRoLnBvdygyLCBleHAgLSA1Mik7XHJcbiAgcmV0dXJuIChzaWduID09IDAgPyAxIDogLTEpICogZnJhYztcclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbihsZW5ndGgpe1xyXG4gIHZhciBqID0gdGhpcy5pbmRleDtcclxuICBpZiAoaiArIGxlbmd0aCA8PSB0aGlzLmxlbmd0aCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZGF0YVZpZXcuc3ViYXJyYXkoaiwgaiArIGxlbmd0aCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignQmluYXJ5UGFja0ZhaWx1cmU6IHJlYWQgaW5kZXggb3V0IG9mIHJhbmdlJyk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBQYWNrZXIoKXtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIgPSBuZXcgQnVmZmVyQnVpbGRlcigpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLmdldEJ1ZmZlciA9IGZ1bmN0aW9uKCl7XHJcbiAgcmV0dXJuIHRoaXMuYnVmZmVyQnVpbGRlci5nZXRCdWZmZXIoKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrID0gZnVuY3Rpb24odmFsdWUpe1xyXG4gIHZhciB0eXBlID0gdHlwZW9mKHZhbHVlKTtcclxuICBpZiAodHlwZSA9PSAnc3RyaW5nJyl7XHJcbiAgICB0aGlzLnBhY2tfc3RyaW5nKHZhbHVlKTtcclxuICB9IGVsc2UgaWYgKHR5cGUgPT0gJ251bWJlcicpe1xyXG4gICAgaWYgKE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSl7XHJcbiAgICAgIHRoaXMucGFja19pbnRlZ2VyKHZhbHVlKTtcclxuICAgIH0gZWxzZXtcclxuICAgICAgdGhpcy5wYWNrX2RvdWJsZSh2YWx1ZSk7XHJcbiAgICB9XHJcbiAgfSBlbHNlIGlmICh0eXBlID09ICdib29sZWFuJyl7XHJcbiAgICBpZiAodmFsdWUgPT09IHRydWUpe1xyXG4gICAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4YzMpO1xyXG4gICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gZmFsc2Upe1xyXG4gICAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4YzIpO1xyXG4gICAgfVxyXG4gIH0gZWxzZSBpZiAodHlwZSA9PSAndW5kZWZpbmVkJyl7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4YzApO1xyXG4gIH0gZWxzZSBpZiAodHlwZSA9PSAnb2JqZWN0Jyl7XHJcbiAgICBpZiAodmFsdWUgPT09IG51bGwpe1xyXG4gICAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4YzApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdmFyIGNvbnN0cnVjdG9yID0gdmFsdWUuY29uc3RydWN0b3I7XHJcbiAgICAgIGlmIChjb25zdHJ1Y3RvciA9PSBBcnJheSl7XHJcbiAgICAgICAgdGhpcy5wYWNrX2FycmF5KHZhbHVlKTtcclxuICAgICAgfSBlbHNlIGlmIChjb25zdHJ1Y3RvciA9PSBCbG9iIHx8IGNvbnN0cnVjdG9yID09IEZpbGUpIHtcclxuICAgICAgICB0aGlzLnBhY2tfYmluKHZhbHVlKTtcclxuICAgICAgfSBlbHNlIGlmIChjb25zdHJ1Y3RvciA9PSBBcnJheUJ1ZmZlcikge1xyXG4gICAgICAgIGlmKGJpbmFyeUZlYXR1cmVzLnVzZUFycmF5QnVmZmVyVmlldykge1xyXG4gICAgICAgICAgdGhpcy5wYWNrX2JpbihuZXcgVWludDhBcnJheSh2YWx1ZSkpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLnBhY2tfYmluKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoJ0JZVEVTX1BFUl9FTEVNRU5UJyBpbiB2YWx1ZSl7XHJcbiAgICAgICAgaWYoYmluYXJ5RmVhdHVyZXMudXNlQXJyYXlCdWZmZXJWaWV3KSB7XHJcbiAgICAgICAgICB0aGlzLnBhY2tfYmluKG5ldyBVaW50OEFycmF5KHZhbHVlLmJ1ZmZlcikpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLnBhY2tfYmluKHZhbHVlLmJ1ZmZlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKGNvbnN0cnVjdG9yID09IE9iamVjdCl7XHJcbiAgICAgICAgdGhpcy5wYWNrX29iamVjdCh2YWx1ZSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoY29uc3RydWN0b3IgPT0gRGF0ZSl7XHJcbiAgICAgICAgdGhpcy5wYWNrX3N0cmluZyh2YWx1ZS50b1N0cmluZygpKTtcclxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUudG9CaW5hcnlQYWNrID09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQodmFsdWUudG9CaW5hcnlQYWNrKCkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVHlwZSBcIicgKyBjb25zdHJ1Y3Rvci50b1N0cmluZygpICsgJ1wiIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9IGVsc2Uge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdUeXBlIFwiJyArIHR5cGUgKyAnXCIgbm90IHlldCBzdXBwb3J0ZWQnKTtcclxuICB9XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmZsdXNoKCk7XHJcbn1cclxuXHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfYmluID0gZnVuY3Rpb24oYmxvYil7XHJcbiAgdmFyIGxlbmd0aCA9IGJsb2IubGVuZ3RoIHx8IGJsb2IuYnl0ZUxlbmd0aCB8fCBibG9iLnNpemU7XHJcbiAgaWYgKGxlbmd0aCA8PSAweDBmKXtcclxuICAgIHRoaXMucGFja191aW50OCgweGEwICsgbGVuZ3RoKTtcclxuICB9IGVsc2UgaWYgKGxlbmd0aCA8PSAweGZmZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGRhKSA7XHJcbiAgICB0aGlzLnBhY2tfdWludDE2KGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZGIpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQzMihsZW5ndGgpO1xyXG4gIH0gZWxzZXtcclxuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsZW5ndGgnKTtcclxuICB9XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZChibG9iKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX3N0cmluZyA9IGZ1bmN0aW9uKHN0cil7XHJcbiAgdmFyIGxlbmd0aCA9IHV0ZjhMZW5ndGgoc3RyKTtcclxuXHJcbiAgaWYgKGxlbmd0aCA8PSAweDBmKXtcclxuICAgIHRoaXMucGFja191aW50OCgweGIwICsgbGVuZ3RoKTtcclxuICB9IGVsc2UgaWYgKGxlbmd0aCA8PSAweGZmZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGQ4KSA7XHJcbiAgICB0aGlzLnBhY2tfdWludDE2KGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZDkpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQzMihsZW5ndGgpO1xyXG4gIH0gZWxzZXtcclxuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsZW5ndGgnKTtcclxuICB9XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZChzdHIpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfYXJyYXkgPSBmdW5jdGlvbihhcnkpe1xyXG4gIHZhciBsZW5ndGggPSBhcnkubGVuZ3RoO1xyXG4gIGlmIChsZW5ndGggPD0gMHgwZil7XHJcbiAgICB0aGlzLnBhY2tfdWludDgoMHg5MCArIGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkYylcclxuICAgIHRoaXMucGFja191aW50MTYobGVuZ3RoKTtcclxuICB9IGVsc2UgaWYgKGxlbmd0aCA8PSAweGZmZmZmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkZCk7XHJcbiAgICB0aGlzLnBhY2tfdWludDMyKGxlbmd0aCk7XHJcbiAgfSBlbHNle1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxlbmd0aCcpO1xyXG4gIH1cclxuICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuZ3RoIDsgaSsrKXtcclxuICAgIHRoaXMucGFjayhhcnlbaV0pO1xyXG4gIH1cclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX2ludGVnZXIgPSBmdW5jdGlvbihudW0pe1xyXG4gIGlmICggLTB4MjAgPD0gbnVtICYmIG51bSA8PSAweDdmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQobnVtICYgMHhmZik7XHJcbiAgfSBlbHNlIGlmICgweDAwIDw9IG51bSAmJiBudW0gPD0gMHhmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4Y2MpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQ4KG51bSk7XHJcbiAgfSBlbHNlIGlmICgtMHg4MCA8PSBudW0gJiYgbnVtIDw9IDB4N2Ype1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGQwKTtcclxuICAgIHRoaXMucGFja19pbnQ4KG51bSk7XHJcbiAgfSBlbHNlIGlmICggMHgwMDAwIDw9IG51bSAmJiBudW0gPD0gMHhmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhjZCk7XHJcbiAgICB0aGlzLnBhY2tfdWludDE2KG51bSk7XHJcbiAgfSBlbHNlIGlmICgtMHg4MDAwIDw9IG51bSAmJiBudW0gPD0gMHg3ZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkMSk7XHJcbiAgICB0aGlzLnBhY2tfaW50MTYobnVtKTtcclxuICB9IGVsc2UgaWYgKCAweDAwMDAwMDAwIDw9IG51bSAmJiBudW0gPD0gMHhmZmZmZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4Y2UpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQzMihudW0pO1xyXG4gIH0gZWxzZSBpZiAoLTB4ODAwMDAwMDAgPD0gbnVtICYmIG51bSA8PSAweDdmZmZmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkMik7XHJcbiAgICB0aGlzLnBhY2tfaW50MzIobnVtKTtcclxuICB9IGVsc2UgaWYgKC0weDgwMDAwMDAwMDAwMDAwMDAgPD0gbnVtICYmIG51bSA8PSAweDdGRkZGRkZGRkZGRkZGRkYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGQzKTtcclxuICAgIHRoaXMucGFja19pbnQ2NChudW0pO1xyXG4gIH0gZWxzZSBpZiAoMHgwMDAwMDAwMDAwMDAwMDAwIDw9IG51bSAmJiBudW0gPD0gMHhGRkZGRkZGRkZGRkZGRkZGKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhjZik7XHJcbiAgICB0aGlzLnBhY2tfdWludDY0KG51bSk7XHJcbiAgfSBlbHNle1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGludGVnZXInKTtcclxuICB9XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja19kb3VibGUgPSBmdW5jdGlvbihudW0pe1xyXG4gIHZhciBzaWduID0gMDtcclxuICBpZiAobnVtIDwgMCl7XHJcbiAgICBzaWduID0gMTtcclxuICAgIG51bSA9IC1udW07XHJcbiAgfVxyXG4gIHZhciBleHAgID0gTWF0aC5mbG9vcihNYXRoLmxvZyhudW0pIC8gTWF0aC5MTjIpO1xyXG4gIHZhciBmcmFjMCA9IG51bSAvIE1hdGgucG93KDIsIGV4cCkgLSAxO1xyXG4gIHZhciBmcmFjMSA9IE1hdGguZmxvb3IoZnJhYzAgKiBNYXRoLnBvdygyLCA1MikpO1xyXG4gIHZhciBiMzIgICA9IE1hdGgucG93KDIsIDMyKTtcclxuICB2YXIgaDMyID0gKHNpZ24gPDwgMzEpIHwgKChleHArMTAyMykgPDwgMjApIHxcclxuICAgICAgKGZyYWMxIC8gYjMyKSAmIDB4MGZmZmZmO1xyXG4gIHZhciBsMzIgPSBmcmFjMSAlIGIzMjtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4Y2IpO1xyXG4gIHRoaXMucGFja19pbnQzMihoMzIpO1xyXG4gIHRoaXMucGFja19pbnQzMihsMzIpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfb2JqZWN0ID0gZnVuY3Rpb24ob2JqKXtcclxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XHJcbiAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xyXG4gIGlmIChsZW5ndGggPD0gMHgwZil7XHJcbiAgICB0aGlzLnBhY2tfdWludDgoMHg4MCArIGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkZSk7XHJcbiAgICB0aGlzLnBhY2tfdWludDE2KGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZGYpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQzMihsZW5ndGgpO1xyXG4gIH0gZWxzZXtcclxuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsZW5ndGgnKTtcclxuICB9XHJcbiAgZm9yKHZhciBwcm9wIGluIG9iail7XHJcbiAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3ApKXtcclxuICAgICAgdGhpcy5wYWNrKHByb3ApO1xyXG4gICAgICB0aGlzLnBhY2sob2JqW3Byb3BdKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja191aW50OCA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZChudW0pO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfdWludDE2ID0gZnVuY3Rpb24obnVtKXtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKG51bSA+PiA4KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKG51bSAmIDB4ZmYpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfdWludDMyID0gZnVuY3Rpb24obnVtKXtcclxuICB2YXIgbiA9IG51bSAmIDB4ZmZmZmZmZmY7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobiAmIDB4ZmYwMDAwMDApID4+PiAyNCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobiAmIDB4MDBmZjAwMDApID4+PiAxNik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobiAmIDB4MDAwMGZmMDApID4+PiAgOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobiAmIDB4MDAwMDAwZmYpKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX3VpbnQ2NCA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdmFyIGhpZ2ggPSBudW0gLyBNYXRoLnBvdygyLCAzMik7XHJcbiAgdmFyIGxvdyAgPSBudW0gJSBNYXRoLnBvdygyLCAzMik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4ZmYwMDAwMDApID4+PiAyNCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4MDBmZjAwMDApID4+PiAxNik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4MDAwMGZmMDApID4+PiAgOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4MDAwMDAwZmYpKTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHhmZjAwMDAwMCkgPj4+IDI0KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHgwMGZmMDAwMCkgPj4+IDE2KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHgwMDAwZmYwMCkgPj4+ICA4KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHgwMDAwMDBmZikpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfaW50OCA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZChudW0gJiAweGZmKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX2ludDE2ID0gZnVuY3Rpb24obnVtKXtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChudW0gJiAweGZmMDApID4+IDgpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQobnVtICYgMHhmZik7XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja19pbnQzMiA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobnVtID4+PiAyNCkgJiAweGZmKTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChudW0gJiAweDAwZmYwMDAwKSA+Pj4gMTYpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKG51bSAmIDB4MDAwMGZmMDApID4+PiA4KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChudW0gJiAweDAwMDAwMGZmKSk7XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja19pbnQ2NCA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdmFyIGhpZ2ggPSBNYXRoLmZsb29yKG51bSAvIE1hdGgucG93KDIsIDMyKSk7XHJcbiAgdmFyIGxvdyAgPSBudW0gJSBNYXRoLnBvdygyLCAzMik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4ZmYwMDAwMDApID4+PiAyNCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4MDBmZjAwMDApID4+PiAxNik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4MDAwMGZmMDApID4+PiAgOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgoaGlnaCAmIDB4MDAwMDAwZmYpKTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHhmZjAwMDAwMCkgPj4+IDI0KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHgwMGZmMDAwMCkgPj4+IDE2KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHgwMDAwZmYwMCkgPj4+ICA4KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChsb3cgICYgMHgwMDAwMDBmZikpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdXRmOFJlcGxhY2UobSl7XHJcbiAgdmFyIGNvZGUgPSBtLmNoYXJDb2RlQXQoMCk7XHJcblxyXG4gIGlmKGNvZGUgPD0gMHg3ZmYpIHJldHVybiAnMDAnO1xyXG4gIGlmKGNvZGUgPD0gMHhmZmZmKSByZXR1cm4gJzAwMCc7XHJcbiAgaWYoY29kZSA8PSAweDFmZmZmZikgcmV0dXJuICcwMDAwJztcclxuICBpZihjb2RlIDw9IDB4M2ZmZmZmZikgcmV0dXJuICcwMDAwMCc7XHJcbiAgcmV0dXJuICcwMDAwMDAnO1xyXG59XHJcblxyXG5mdW5jdGlvbiB1dGY4TGVuZ3RoKHN0cil7XHJcbiAgaWYgKHN0ci5sZW5ndGggPiA2MDApIHtcclxuICAgIC8vIEJsb2IgbWV0aG9kIGZhc3RlciBmb3IgbGFyZ2Ugc3RyaW5nc1xyXG4gICAgcmV0dXJuIChuZXcgQmxvYihbc3RyXSkpLnNpemU7XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiBzdHIucmVwbGFjZSgvW15cXHUwMDAwLVxcdTAwN0ZdL2csIF91dGY4UmVwbGFjZSkubGVuZ3RoO1xyXG4gIH1cclxufVxyXG4iLCJ2YXIgYmluYXJ5RmVhdHVyZXMgPSB7fTtcclxuYmluYXJ5RmVhdHVyZXMudXNlQmxvYkJ1aWxkZXIgPSAoZnVuY3Rpb24oKXtcclxuICB0cnkge1xyXG4gICAgbmV3IEJsb2IoW10pO1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxufSkoKTtcclxuXHJcbmJpbmFyeUZlYXR1cmVzLnVzZUFycmF5QnVmZmVyVmlldyA9ICFiaW5hcnlGZWF0dXJlcy51c2VCbG9iQnVpbGRlciAmJiAoZnVuY3Rpb24oKXtcclxuICB0cnkge1xyXG4gICAgcmV0dXJuIChuZXcgQmxvYihbbmV3IFVpbnQ4QXJyYXkoW10pXSkpLnNpemUgPT09IDA7XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG59KSgpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuYmluYXJ5RmVhdHVyZXMgPSBiaW5hcnlGZWF0dXJlcztcclxudmFyIEJsb2JCdWlsZGVyID0gbW9kdWxlLmV4cG9ydHMuQmxvYkJ1aWxkZXI7XHJcbmlmICh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgQmxvYkJ1aWxkZXIgPSBtb2R1bGUuZXhwb3J0cy5CbG9iQnVpbGRlciA9IHdpbmRvdy5XZWJLaXRCbG9iQnVpbGRlciB8fFxyXG4gICAgd2luZG93Lk1vekJsb2JCdWlsZGVyIHx8IHdpbmRvdy5NU0Jsb2JCdWlsZGVyIHx8IHdpbmRvdy5CbG9iQnVpbGRlcjtcclxufVxyXG5cclxuZnVuY3Rpb24gQnVmZmVyQnVpbGRlcigpe1xyXG4gIHRoaXMuX3BpZWNlcyA9IFtdO1xyXG4gIHRoaXMuX3BhcnRzID0gW107XHJcbn1cclxuXHJcbkJ1ZmZlckJ1aWxkZXIucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uKGRhdGEpIHtcclxuICBpZih0eXBlb2YgZGF0YSA9PT0gJ251bWJlcicpIHtcclxuICAgIHRoaXMuX3BpZWNlcy5wdXNoKGRhdGEpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0aGlzLmZsdXNoKCk7XHJcbiAgICB0aGlzLl9wYXJ0cy5wdXNoKGRhdGEpO1xyXG4gIH1cclxufTtcclxuXHJcbkJ1ZmZlckJ1aWxkZXIucHJvdG90eXBlLmZsdXNoID0gZnVuY3Rpb24oKSB7XHJcbiAgaWYgKHRoaXMuX3BpZWNlcy5sZW5ndGggPiAwKSB7XHJcbiAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fcGllY2VzKTtcclxuICAgIGlmKCFiaW5hcnlGZWF0dXJlcy51c2VBcnJheUJ1ZmZlclZpZXcpIHtcclxuICAgICAgYnVmID0gYnVmLmJ1ZmZlcjtcclxuICAgIH1cclxuICAgIHRoaXMuX3BhcnRzLnB1c2goYnVmKTtcclxuICAgIHRoaXMuX3BpZWNlcyA9IFtdO1xyXG4gIH1cclxufTtcclxuXHJcbkJ1ZmZlckJ1aWxkZXIucHJvdG90eXBlLmdldEJ1ZmZlciA9IGZ1bmN0aW9uKCkge1xyXG4gIHRoaXMuZmx1c2goKTtcclxuICBpZihiaW5hcnlGZWF0dXJlcy51c2VCbG9iQnVpbGRlcikge1xyXG4gICAgdmFyIGJ1aWxkZXIgPSBuZXcgQmxvYkJ1aWxkZXIoKTtcclxuICAgIGZvcih2YXIgaSA9IDAsIGlpID0gdGhpcy5fcGFydHMubGVuZ3RoOyBpIDwgaWk7IGkrKykge1xyXG4gICAgICBidWlsZGVyLmFwcGVuZCh0aGlzLl9wYXJ0c1tpXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYnVpbGRlci5nZXRCbG9iKCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiBuZXcgQmxvYih0aGlzLl9wYXJ0cyk7XHJcbiAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMuQnVmZmVyQnVpbGRlciA9IEJ1ZmZlckJ1aWxkZXI7XHJcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qKlxuICogUmVsaWFibGUgdHJhbnNmZXIgZm9yIENocm9tZSBDYW5hcnkgRGF0YUNoYW5uZWwgaW1wbC5cbiAqIEF1dGhvcjogQG1pY2hlbGxlYnVcbiAqL1xuZnVuY3Rpb24gUmVsaWFibGUoZGMsIGRlYnVnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSZWxpYWJsZSkpIHJldHVybiBuZXcgUmVsaWFibGUoZGMpO1xuICB0aGlzLl9kYyA9IGRjO1xuXG4gIHV0aWwuZGVidWcgPSBkZWJ1ZztcblxuICAvLyBNZXNzYWdlcyBzZW50L3JlY2VpdmVkIHNvIGZhci5cbiAgLy8gaWQ6IHsgYWNrOiBuLCBjaHVua3M6IFsuLi5dIH1cbiAgdGhpcy5fb3V0Z29pbmcgPSB7fTtcbiAgLy8gaWQ6IHsgYWNrOiBbJ2FjaycsIGlkLCBuXSwgY2h1bmtzOiBbLi4uXSB9XG4gIHRoaXMuX2luY29taW5nID0ge307XG4gIHRoaXMuX3JlY2VpdmVkID0ge307XG5cbiAgLy8gV2luZG93IHNpemUuXG4gIHRoaXMuX3dpbmRvdyA9IDEwMDA7XG4gIC8vIE1UVS5cbiAgdGhpcy5fbXR1ID0gNTAwO1xuICAvLyBJbnRlcnZhbCBmb3Igc2V0SW50ZXJ2YWwuIEluIG1zLlxuICB0aGlzLl9pbnRlcnZhbCA9IDA7XG5cbiAgLy8gTWVzc2FnZXMgc2VudC5cbiAgdGhpcy5fY291bnQgPSAwO1xuXG4gIC8vIE91dGdvaW5nIG1lc3NhZ2UgcXVldWUuXG4gIHRoaXMuX3F1ZXVlID0gW107XG5cbiAgdGhpcy5fc2V0dXBEQygpO1xufTtcblxuLy8gU2VuZCBhIG1lc3NhZ2UgcmVsaWFibHkuXG5SZWxpYWJsZS5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICAvLyBEZXRlcm1pbmUgaWYgY2h1bmtpbmcgaXMgbmVjZXNzYXJ5LlxuICB2YXIgYmwgPSB1dGlsLnBhY2sobXNnKTtcbiAgaWYgKGJsLnNpemUgPCB0aGlzLl9tdHUpIHtcbiAgICB0aGlzLl9oYW5kbGVTZW5kKFsnbm8nLCBibF0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMuX291dGdvaW5nW3RoaXMuX2NvdW50XSA9IHtcbiAgICBhY2s6IDAsXG4gICAgY2h1bmtzOiB0aGlzLl9jaHVuayhibClcbiAgfTtcblxuICBpZiAodXRpbC5kZWJ1Zykge1xuICAgIHRoaXMuX291dGdvaW5nW3RoaXMuX2NvdW50XS50aW1lciA9IG5ldyBEYXRlKCk7XG4gIH1cblxuICAvLyBTZW5kIHByZWxpbSB3aW5kb3cuXG4gIHRoaXMuX3NlbmRXaW5kb3dlZENodW5rcyh0aGlzLl9jb3VudCk7XG4gIHRoaXMuX2NvdW50ICs9IDE7XG59O1xuXG4vLyBTZXQgdXAgaW50ZXJ2YWwgZm9yIHByb2Nlc3NpbmcgcXVldWUuXG5SZWxpYWJsZS5wcm90b3R5cGUuX3NldHVwSW50ZXJ2YWwgPSBmdW5jdGlvbigpIHtcbiAgLy8gVE9ETzogZmFpbCBncmFjZWZ1bGx5LlxuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5fdGltZW91dCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgIC8vIEZJWE1FOiBTdHJpbmcgc3R1ZmYgbWFrZXMgdGhpbmdzIHRlcnJpYmx5IGFzeW5jLlxuICAgIHZhciBtc2cgPSBzZWxmLl9xdWV1ZS5zaGlmdCgpO1xuICAgIGlmIChtc2cuX211bHRpcGxlKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgaWkgPSBtc2cubGVuZ3RoOyBpIDwgaWk7IGkgKz0gMSkge1xuICAgICAgICBzZWxmLl9pbnRlcnZhbFNlbmQobXNnW2ldKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5faW50ZXJ2YWxTZW5kKG1zZyk7XG4gICAgfVxuICB9LCB0aGlzLl9pbnRlcnZhbCk7XG59O1xuXG5SZWxpYWJsZS5wcm90b3R5cGUuX2ludGVydmFsU2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG1zZyA9IHV0aWwucGFjayhtc2cpO1xuICB1dGlsLmJsb2JUb0JpbmFyeVN0cmluZyhtc2csIGZ1bmN0aW9uKHN0cikge1xuICAgIHNlbGYuX2RjLnNlbmQoc3RyKTtcbiAgfSk7XG4gIGlmIChzZWxmLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcbiAgICBjbGVhclRpbWVvdXQoc2VsZi5fdGltZW91dCk7XG4gICAgc2VsZi5fdGltZW91dCA9IG51bGw7XG4gICAgLy9zZWxmLl9wcm9jZXNzQWNrcygpO1xuICB9XG59O1xuXG4vLyBHbyB0aHJvdWdoIEFDS3MgdG8gc2VuZCBtaXNzaW5nIHBpZWNlcy5cblJlbGlhYmxlLnByb3RvdHlwZS5fcHJvY2Vzc0Fja3MgPSBmdW5jdGlvbigpIHtcbiAgZm9yICh2YXIgaWQgaW4gdGhpcy5fb3V0Z29pbmcpIHtcbiAgICBpZiAodGhpcy5fb3V0Z29pbmcuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICB0aGlzLl9zZW5kV2luZG93ZWRDaHVua3MoaWQpO1xuICAgIH1cbiAgfVxufTtcblxuLy8gSGFuZGxlIHNlbmRpbmcgYSBtZXNzYWdlLlxuLy8gRklYTUU6IERvbid0IHdhaXQgZm9yIGludGVydmFsIHRpbWUgZm9yIGFsbCBtZXNzYWdlcy4uLlxuUmVsaWFibGUucHJvdG90eXBlLl9oYW5kbGVTZW5kID0gZnVuY3Rpb24obXNnKSB7XG4gIHZhciBwdXNoID0gdHJ1ZTtcbiAgZm9yICh2YXIgaSA9IDAsIGlpID0gdGhpcy5fcXVldWUubGVuZ3RoOyBpIDwgaWk7IGkgKz0gMSkge1xuICAgIHZhciBpdGVtID0gdGhpcy5fcXVldWVbaV07XG4gICAgaWYgKGl0ZW0gPT09IG1zZykge1xuICAgICAgcHVzaCA9IGZhbHNlO1xuICAgIH0gZWxzZSBpZiAoaXRlbS5fbXVsdGlwbGUgJiYgaXRlbS5pbmRleE9mKG1zZykgIT09IC0xKSB7XG4gICAgICBwdXNoID0gZmFsc2U7XG4gICAgfVxuICB9XG4gIGlmIChwdXNoKSB7XG4gICAgdGhpcy5fcXVldWUucHVzaChtc2cpO1xuICAgIGlmICghdGhpcy5fdGltZW91dCkge1xuICAgICAgdGhpcy5fc2V0dXBJbnRlcnZhbCgpO1xuICAgIH1cbiAgfVxufTtcblxuLy8gU2V0IHVwIERhdGFDaGFubmVsIGhhbmRsZXJzLlxuUmVsaWFibGUucHJvdG90eXBlLl9zZXR1cERDID0gZnVuY3Rpb24oKSB7XG4gIC8vIEhhbmRsZSB2YXJpb3VzIG1lc3NhZ2UgdHlwZXMuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5fZGMub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciBtc2cgPSBlLmRhdGE7XG4gICAgdmFyIGRhdGF0eXBlID0gbXNnLmNvbnN0cnVjdG9yO1xuICAgIC8vIEZJWE1FOiBtc2cgaXMgU3RyaW5nIHVudGlsIGJpbmFyeSBpcyBzdXBwb3J0ZWQuXG4gICAgLy8gT25jZSB0aGF0IGhhcHBlbnMsIHRoaXMgd2lsbCBoYXZlIHRvIGJlIHNtYXJ0ZXIuXG4gICAgaWYgKGRhdGF0eXBlID09PSBTdHJpbmcpIHtcbiAgICAgIHZhciBhYiA9IHV0aWwuYmluYXJ5U3RyaW5nVG9BcnJheUJ1ZmZlcihtc2cpO1xuICAgICAgbXNnID0gdXRpbC51bnBhY2soYWIpO1xuICAgICAgc2VsZi5faGFuZGxlTWVzc2FnZShtc2cpO1xuICAgIH1cbiAgfTtcbn07XG5cbi8vIEhhbmRsZXMgYW4gaW5jb21pbmcgbWVzc2FnZS5cblJlbGlhYmxlLnByb3RvdHlwZS5faGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICB2YXIgaWQgPSBtc2dbMV07XG4gIHZhciBpZGF0YSA9IHRoaXMuX2luY29taW5nW2lkXTtcbiAgdmFyIG9kYXRhID0gdGhpcy5fb3V0Z29pbmdbaWRdO1xuICB2YXIgZGF0YTtcbiAgc3dpdGNoIChtc2dbMF0pIHtcbiAgICAvLyBObyBjaHVua2luZyB3YXMgZG9uZS5cbiAgICBjYXNlICdubyc6XG4gICAgICB2YXIgbWVzc2FnZSA9IGlkO1xuICAgICAgaWYgKCEhbWVzc2FnZSkge1xuICAgICAgICB0aGlzLm9ubWVzc2FnZSh1dGlsLnVucGFjayhtZXNzYWdlKSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICAvLyBSZWFjaGVkIHRoZSBlbmQgb2YgdGhlIG1lc3NhZ2UuXG4gICAgY2FzZSAnZW5kJzpcbiAgICAgIGRhdGEgPSBpZGF0YTtcblxuICAgICAgLy8gSW4gY2FzZSBlbmQgY29tZXMgZmlyc3QuXG4gICAgICB0aGlzLl9yZWNlaXZlZFtpZF0gPSBtc2dbMl07XG5cbiAgICAgIGlmICghZGF0YSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgdGhpcy5fYWNrKGlkKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Fjayc6XG4gICAgICBkYXRhID0gb2RhdGE7XG4gICAgICBpZiAoISFkYXRhKSB7XG4gICAgICAgIHZhciBhY2sgPSBtc2dbMl07XG4gICAgICAgIC8vIFRha2UgdGhlIGxhcmdlciBBQ0ssIGZvciBvdXQgb2Ygb3JkZXIgbWVzc2FnZXMuXG4gICAgICAgIGRhdGEuYWNrID0gTWF0aC5tYXgoYWNrLCBkYXRhLmFjayk7XG5cbiAgICAgICAgLy8gQ2xlYW4gdXAgd2hlbiBhbGwgY2h1bmtzIGFyZSBBQ0tlZC5cbiAgICAgICAgaWYgKGRhdGEuYWNrID49IGRhdGEuY2h1bmtzLmxlbmd0aCkge1xuICAgICAgICAgIHV0aWwubG9nKCdUaW1lOiAnLCBuZXcgRGF0ZSgpIC0gZGF0YS50aW1lcik7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX291dGdvaW5nW2lkXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9wcm9jZXNzQWNrcygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBJZiAhZGF0YSwganVzdCBpZ25vcmUuXG4gICAgICBicmVhaztcbiAgICAvLyBSZWNlaXZlZCBhIGNodW5rIG9mIGRhdGEuXG4gICAgY2FzZSAnY2h1bmsnOlxuICAgICAgLy8gQ3JlYXRlIGEgbmV3IGVudHJ5IGlmIG5vbmUgZXhpc3RzLlxuICAgICAgZGF0YSA9IGlkYXRhO1xuICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgIHZhciBlbmQgPSB0aGlzLl9yZWNlaXZlZFtpZF07XG4gICAgICAgIGlmIChlbmQgPT09IHRydWUpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBkYXRhID0ge1xuICAgICAgICAgIGFjazogWydhY2snLCBpZCwgMF0sXG4gICAgICAgICAgY2h1bmtzOiBbXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9pbmNvbWluZ1tpZF0gPSBkYXRhO1xuICAgICAgfVxuXG4gICAgICB2YXIgbiA9IG1zZ1syXTtcbiAgICAgIHZhciBjaHVuayA9IG1zZ1szXTtcbiAgICAgIGRhdGEuY2h1bmtzW25dID0gbmV3IFVpbnQ4QXJyYXkoY2h1bmspO1xuXG4gICAgICAvLyBJZiB3ZSBnZXQgdGhlIGNodW5rIHdlJ3JlIGxvb2tpbmcgZm9yLCBBQ0sgZm9yIG5leHQgbWlzc2luZy5cbiAgICAgIC8vIE90aGVyd2lzZSwgQUNLIHRoZSBzYW1lIE4gYWdhaW4uXG4gICAgICBpZiAobiA9PT0gZGF0YS5hY2tbMl0pIHtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlTmV4dEFjayhpZCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9hY2soaWQpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIFNob3VsZG4ndCBoYXBwZW4sIGJ1dCB3b3VsZCBtYWtlIHNlbnNlIGZvciBtZXNzYWdlIHRvIGp1c3QgZ29cbiAgICAgIC8vIHRocm91Z2ggYXMgaXMuXG4gICAgICB0aGlzLl9oYW5kbGVTZW5kKG1zZyk7XG4gICAgICBicmVhaztcbiAgfVxufTtcblxuLy8gQ2h1bmtzIEJMIGludG8gc21hbGxlciBtZXNzYWdlcy5cblJlbGlhYmxlLnByb3RvdHlwZS5fY2h1bmsgPSBmdW5jdGlvbihibCkge1xuICB2YXIgY2h1bmtzID0gW107XG4gIHZhciBzaXplID0gYmwuc2l6ZTtcbiAgdmFyIHN0YXJ0ID0gMDtcbiAgd2hpbGUgKHN0YXJ0IDwgc2l6ZSkge1xuICAgIHZhciBlbmQgPSBNYXRoLm1pbihzaXplLCBzdGFydCArIHRoaXMuX210dSk7XG4gICAgdmFyIGIgPSBibC5zbGljZShzdGFydCwgZW5kKTtcbiAgICB2YXIgY2h1bmsgPSB7XG4gICAgICBwYXlsb2FkOiBiXG4gICAgfVxuICAgIGNodW5rcy5wdXNoKGNodW5rKTtcbiAgICBzdGFydCA9IGVuZDtcbiAgfVxuICB1dGlsLmxvZygnQ3JlYXRlZCcsIGNodW5rcy5sZW5ndGgsICdjaHVua3MuJyk7XG4gIHJldHVybiBjaHVua3M7XG59O1xuXG4vLyBTZW5kcyBBQ0sgTiwgZXhwZWN0aW5nIE50aCBibG9iIGNodW5rIGZvciBtZXNzYWdlIElELlxuUmVsaWFibGUucHJvdG90eXBlLl9hY2sgPSBmdW5jdGlvbihpZCkge1xuICB2YXIgYWNrID0gdGhpcy5faW5jb21pbmdbaWRdLmFjaztcblxuICAvLyBpZiBhY2sgaXMgdGhlIGVuZCB2YWx1ZSwgdGhlbiBjYWxsIF9jb21wbGV0ZS5cbiAgaWYgKHRoaXMuX3JlY2VpdmVkW2lkXSA9PT0gYWNrWzJdKSB7XG4gICAgdGhpcy5fY29tcGxldGUoaWQpO1xuICAgIHRoaXMuX3JlY2VpdmVkW2lkXSA9IHRydWU7XG4gIH1cblxuICB0aGlzLl9oYW5kbGVTZW5kKGFjayk7XG59O1xuXG4vLyBDYWxjdWxhdGVzIHRoZSBuZXh0IEFDSyBudW1iZXIsIGdpdmVuIGNodW5rcy5cblJlbGlhYmxlLnByb3RvdHlwZS5fY2FsY3VsYXRlTmV4dEFjayA9IGZ1bmN0aW9uKGlkKSB7XG4gIHZhciBkYXRhID0gdGhpcy5faW5jb21pbmdbaWRdO1xuICB2YXIgY2h1bmtzID0gZGF0YS5jaHVua3M7XG4gIGZvciAodmFyIGkgPSAwLCBpaSA9IGNodW5rcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgLy8gVGhpcyBjaHVuayBpcyBtaXNzaW5nISEhIEJldHRlciBBQ0sgZm9yIGl0LlxuICAgIGlmIChjaHVua3NbaV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgZGF0YS5hY2tbMl0gPSBpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuICBkYXRhLmFja1syXSA9IGNodW5rcy5sZW5ndGg7XG59O1xuXG4vLyBTZW5kcyB0aGUgbmV4dCB3aW5kb3cgb2YgY2h1bmtzLlxuUmVsaWFibGUucHJvdG90eXBlLl9zZW5kV2luZG93ZWRDaHVua3MgPSBmdW5jdGlvbihpZCkge1xuICB1dGlsLmxvZygnc2VuZFdpbmRvd2VkQ2h1bmtzIGZvcjogJywgaWQpO1xuICB2YXIgZGF0YSA9IHRoaXMuX291dGdvaW5nW2lkXTtcbiAgdmFyIGNoID0gZGF0YS5jaHVua3M7XG4gIHZhciBjaHVua3MgPSBbXTtcbiAgdmFyIGxpbWl0ID0gTWF0aC5taW4oZGF0YS5hY2sgKyB0aGlzLl93aW5kb3csIGNoLmxlbmd0aCk7XG4gIGZvciAodmFyIGkgPSBkYXRhLmFjazsgaSA8IGxpbWl0OyBpICs9IDEpIHtcbiAgICBpZiAoIWNoW2ldLnNlbnQgfHwgaSA9PT0gZGF0YS5hY2spIHtcbiAgICAgIGNoW2ldLnNlbnQgPSB0cnVlO1xuICAgICAgY2h1bmtzLnB1c2goWydjaHVuaycsIGlkLCBpLCBjaFtpXS5wYXlsb2FkXSk7XG4gICAgfVxuICB9XG4gIGlmIChkYXRhLmFjayArIHRoaXMuX3dpbmRvdyA+PSBjaC5sZW5ndGgpIHtcbiAgICBjaHVua3MucHVzaChbJ2VuZCcsIGlkLCBjaC5sZW5ndGhdKVxuICB9XG4gIGNodW5rcy5fbXVsdGlwbGUgPSB0cnVlO1xuICB0aGlzLl9oYW5kbGVTZW5kKGNodW5rcyk7XG59O1xuXG4vLyBQdXRzIHRvZ2V0aGVyIGEgbWVzc2FnZSBmcm9tIGNodW5rcy5cblJlbGlhYmxlLnByb3RvdHlwZS5fY29tcGxldGUgPSBmdW5jdGlvbihpZCkge1xuICB1dGlsLmxvZygnQ29tcGxldGVkIGNhbGxlZCBmb3InLCBpZCk7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNodW5rcyA9IHRoaXMuX2luY29taW5nW2lkXS5jaHVua3M7XG4gIHZhciBibCA9IG5ldyBCbG9iKGNodW5rcyk7XG4gIHV0aWwuYmxvYlRvQXJyYXlCdWZmZXIoYmwsIGZ1bmN0aW9uKGFiKSB7XG4gICAgc2VsZi5vbm1lc3NhZ2UodXRpbC51bnBhY2soYWIpKTtcbiAgfSk7XG4gIGRlbGV0ZSB0aGlzLl9pbmNvbWluZ1tpZF07XG59O1xuXG4vLyBVcHMgYmFuZHdpZHRoIGxpbWl0IG9uIFNEUC4gTWVhbnQgdG8gYmUgY2FsbGVkIGR1cmluZyBvZmZlci9hbnN3ZXIuXG5SZWxpYWJsZS5oaWdoZXJCYW5kd2lkdGhTRFAgPSBmdW5jdGlvbihzZHApIHtcbiAgLy8gQVMgc3RhbmRzIGZvciBBcHBsaWNhdGlvbi1TcGVjaWZpYyBNYXhpbXVtLlxuICAvLyBCYW5kd2lkdGggbnVtYmVyIGlzIGluIGtpbG9iaXRzIC8gc2VjLlxuICAvLyBTZWUgUkZDIGZvciBtb3JlIGluZm86IGh0dHA6Ly93d3cuaWV0Zi5vcmcvcmZjL3JmYzIzMjcudHh0XG5cbiAgLy8gQ2hyb21lIDMxKyBkb2Vzbid0IHdhbnQgdXMgbXVuZ2luZyB0aGUgU0RQLCBzbyB3ZSdsbCBsZXQgdGhlbSBoYXZlIHRoZWlyXG4gIC8vIHdheS5cbiAgdmFyIHZlcnNpb24gPSBuYXZpZ2F0b3IuYXBwVmVyc2lvbi5tYXRjaCgvQ2hyb21lXFwvKC4qPykgLyk7XG4gIGlmICh2ZXJzaW9uKSB7XG4gICAgdmVyc2lvbiA9IHBhcnNlSW50KHZlcnNpb25bMV0uc3BsaXQoJy4nKS5zaGlmdCgpKTtcbiAgICBpZiAodmVyc2lvbiA8IDMxKSB7XG4gICAgICB2YXIgcGFydHMgPSBzZHAuc3BsaXQoJ2I9QVM6MzAnKTtcbiAgICAgIHZhciByZXBsYWNlID0gJ2I9QVM6MTAyNDAwJzsgLy8gMTAwIE1icHNcbiAgICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHJldHVybiBwYXJ0c1swXSArIHJlcGxhY2UgKyBwYXJ0c1sxXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2RwO1xufTtcblxuLy8gT3ZlcndyaXR0ZW4sIHR5cGljYWxseS5cblJlbGlhYmxlLnByb3RvdHlwZS5vbm1lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cy5SZWxpYWJsZSA9IFJlbGlhYmxlO1xuIiwidmFyIEJpbmFyeVBhY2sgPSByZXF1aXJlKCdqcy1iaW5hcnlwYWNrJyk7XG5cbnZhciB1dGlsID0ge1xuICBkZWJ1ZzogZmFsc2UsXG4gIFxuICBpbmhlcml0czogZnVuY3Rpb24oY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3I7XG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBleHRlbmQ6IGZ1bmN0aW9uKGRlc3QsIHNvdXJjZSkge1xuICAgIGZvcih2YXIga2V5IGluIHNvdXJjZSkge1xuICAgICAgaWYoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgZGVzdFtrZXldID0gc291cmNlW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZXN0O1xuICB9LFxuICBwYWNrOiBCaW5hcnlQYWNrLnBhY2ssXG4gIHVucGFjazogQmluYXJ5UGFjay51bnBhY2ssXG4gIFxuICBsb2c6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodXRpbC5kZWJ1Zykge1xuICAgICAgdmFyIGNvcHkgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvcHlbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICBjb3B5LnVuc2hpZnQoJ1JlbGlhYmxlOiAnKTtcbiAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIGNvcHkpO1xuICAgIH1cbiAgfSxcblxuICBzZXRaZXJvVGltZW91dDogKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAgIHZhciB0aW1lb3V0cyA9IFtdO1xuICAgIHZhciBtZXNzYWdlTmFtZSA9ICd6ZXJvLXRpbWVvdXQtbWVzc2FnZSc7XG5cbiAgICAvLyBMaWtlIHNldFRpbWVvdXQsIGJ1dCBvbmx5IHRha2VzIGEgZnVuY3Rpb24gYXJndW1lbnQuXHQgVGhlcmUnc1xuICAgIC8vIG5vIHRpbWUgYXJndW1lbnQgKGFsd2F5cyB6ZXJvKSBhbmQgbm8gYXJndW1lbnRzICh5b3UgaGF2ZSB0b1xuICAgIC8vIHVzZSBhIGNsb3N1cmUpLlxuICAgIGZ1bmN0aW9uIHNldFplcm9UaW1lb3V0UG9zdE1lc3NhZ2UoZm4pIHtcbiAgICAgIHRpbWVvdXRzLnB1c2goZm4pO1xuICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKG1lc3NhZ2VOYW1lLCAnKicpO1xuICAgIH1cdFx0XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVNZXNzYWdlKGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQuc291cmNlID09IGdsb2JhbCAmJiBldmVudC5kYXRhID09IG1lc3NhZ2VOYW1lKSB7XG4gICAgICAgIGlmIChldmVudC5zdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGltZW91dHMubGVuZ3RoKSB7XG4gICAgICAgICAgdGltZW91dHMuc2hpZnQoKSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVNZXNzYWdlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBoYW5kbGVNZXNzYWdlKTtcbiAgICB9XG4gICAgcmV0dXJuIHNldFplcm9UaW1lb3V0UG9zdE1lc3NhZ2U7XG4gIH0odGhpcykpLFxuICBcbiAgYmxvYlRvQXJyYXlCdWZmZXI6IGZ1bmN0aW9uKGJsb2IsIGNiKXtcbiAgICB2YXIgZnIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIGZyLm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgY2IoZXZ0LnRhcmdldC5yZXN1bHQpO1xuICAgIH07XG4gICAgZnIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XG4gIH0sXG4gIGJsb2JUb0JpbmFyeVN0cmluZzogZnVuY3Rpb24oYmxvYiwgY2Ipe1xuICAgIHZhciBmciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgZnIub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBjYihldnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgfTtcbiAgICBmci5yZWFkQXNCaW5hcnlTdHJpbmcoYmxvYik7XG4gIH0sXG4gIGJpbmFyeVN0cmluZ1RvQXJyYXlCdWZmZXI6IGZ1bmN0aW9uKGJpbmFyeSkge1xuICAgIHZhciBieXRlQXJyYXkgPSBuZXcgVWludDhBcnJheShiaW5hcnkubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJpbmFyeS5sZW5ndGg7IGkrKykge1xuICAgICAgYnl0ZUFycmF5W2ldID0gYmluYXJ5LmNoYXJDb2RlQXQoaSkgJiAweGZmO1xuICAgIH1cbiAgICByZXR1cm4gYnl0ZUFycmF5LmJ1ZmZlcjtcbiAgfSxcbiAgcmFuZG9tVG9rZW46IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHV0aWw7XG4iXX0=
