var express = require('express');
var path = require('path');
// var bodyParser = require('body-parser');

var app = express();



app.set('port', process.env.PORT || 2013);
//app.use(logger('dev'));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));

//TODO: change this to use websockets
var rooms = {};

app.get('/', function(req, res) {
	
		res.render('index');
    
});
// app.get('/:room', function(req, res) {
// 	console.log(req.params.room);
// 	if(rooms[req.params.room]==undefined){
// 		rooms[req.params.room] = 1;
// 		res.render('index', {host: true, id: req.params.room, connections: rooms[req.params.room]});
// 	} else {
// 		rooms[req.params.room]++;
// 		res.render('index', {host: false, id: req.params.room, connections: rooms[req.params.room]});
// 		console.log(rooms[req.params.room] + " in " + req.params.room);
// 	}
    
// });


var server = require('http').createServer(app);
server.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

