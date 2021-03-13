var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var serverless = require('serverless-http');
var mongoose = require('mongoose');
var passport = require('passport');
var config = require('./config/database');
var routes = require('./routes');

app.use(bodyParser.json());
app.use('/.netlify/functions/server', router);  
app.use('/', routes);
serverless(app);

var server_port = process.env.PORT || 8080;

var server = app.listen(server_port, function() {
  var host = server.address().address || "127.0.0.1";
  console.log('Listening on port %d', server_port, 'host at:',host);
});

//----------connect to database-------------------

mongoose.connect(config.database, { useNewUrlParser: true, useUnifiedTopology: true});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    console.log("mongoose connected");
});

//CORS middleware 
var allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next(); 
};
app.use(allowCrossDomain);
 