var mongoose = require('mongoose');
var ObjectId = require('mongodb').ObjectId;
var passport = require('passport');
var jwt = require('jsonwebtoken');

var User = require('../models/user');
var config = require('../config/database');

exports.getMessage = (req, res) => {
    res.status(200).json({ message: 'Connected!' });
}

exports.register = async (req, res) => {
    if (!req.body['email'] || !req.body['password']) {
        res.json({success: false, msg: 'Please enter name and password.'});
    } else {
        var newUser = new User({
            email: req.body['email'],
            password: req.body['password']
        });
        // save the user
        newUser.save(function (err) {
            if (!err) {
                User.findOne({
                    email: req.body['email']
                }, function (err, user) {
                    var token = jwt.sign({ id: user._id }, config.secret, {
                        expiresIn: 86400 // expires in 24 hours
                      });
                    res.status(200).json({ success: true, token: token });
                })
            } else{
                res.status(403).json({success: false, msg: 'Unable to create new user.', error: err});
            }
        });
    }
}

exports.login = async (req, res) => {
    User.findOne({
        email: req.body.email
    }, function (err, user) {
        if (err) throw err;
        if (!user) {
            res.send({ success: false, msg: 'Authentication failed. User not found.', error: user });
        } else {
            // check if password matches
            user.comparePassword(req.body.password, function (err, isMatch) {
                if (isMatch && !err) {
                    // if user is found and password is right create a token
                    var token = jwt.sign({ id: user._id }, config.secret, {
                        expiresIn: 86400 // expires in 24 hours
                      });                  
                    res.send({ success: true, token: token});
                } else {
                    res.send({ success: false, msg: 'Authentication failed. Wrong password.' });
                }
            });
        }
    });
}
