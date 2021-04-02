var mongoose = require('mongoose');
var ObjectId = require('mongodb').ObjectId;
var passport = require('passport');
var jwt = require('jsonwebtoken');
var async = require('async');
var moment = require('moment');
var ObjectId = mongoose.Types.ObjectId;

var config = require('../config/database');
var User = require('../models/user');
var customer = require('../models/customer');
var products = require('../models/productuploads');
var orders = require('../models/placeorder');
var customerReview = require('../models/customerreview');

exports.getMessage = (req, res) => {
    res.status(200).json({ message: 'Connected!' });
}

exports.register = async (req, res) => {
    if (!req.body['email'] || !req.body['password']) {
        res.json({ success: false, msg: 'Please enter name and password.' });
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
            } else {
                res.status(403).json({ success: false, msg: 'Unable to create new user.', error: err });
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
                    res.send({ success: true, token: token, email: req.body.email });
                } else {
                    res.send({ success: false, msg: 'Authentication failed. Wrong password.' });
                }
            });
        }
    });
}

exports.dashboardCount = async (req, res) => {
    async.parallel({
        totalCustomer: function (callback) {
            customer.aggregate([
                { $group: { _id: null, myCount: { $sum: 1 } } },
                { $project: { _id: 0 } }
            ]).then((result, err) => {
                if (Array.isArray(result)) {
                    callback(null, result[0]['myCount']);
                } else {
                    callback(null, 0);
                }
            })
        },
        products: function (callback) {
            products.aggregate([
                { $group: { _id: null, myCount: { $sum: 1 } } },
                { $project: { _id: 0 } }
            ]).then((result, err) => {
                if (Array.isArray(result)) {
                    callback(null, result[0]['myCount']);
                } else {
                    callback(null, 0);
                }
            })
        },
        orders: function (callback) {
            var today = moment(new Date()).format('YYYY-MM-DD[T00:00:00.000Z]');
            var d = moment(today).add(1, 'days')
            var tomorrow = moment(d).format('YYYY-MM-DD[T00:00:00.000Z]');
            orders.aggregate([
                { $project: { _id: 0 } },
                { $match: { "requestdate": { $gte: new Date(today), $lte: new Date(tomorrow) } } },
                { $group: { _id: null, myCount: { $sum: 1 } } }
            ]).then((result, err) => {
                if (Array.isArray(result) && result.length > 0) {
                    callback(null, result[0]['myCount']);
                } else {
                    callback(null, 0);
                }
            })
        },
        maxReview: function (callback) {
            customerReview.aggregate([
                { $project: { _id: 0 } },
                { $match: { "starRate": { $gte: 4 } } },
                { $group: { _id: null, myCount: { $sum: 1 } } }
            ]).then((result, err) => {
                if (Array.isArray(result) && result.length > 0) {
                    callback(null, result[0]['myCount']);
                } else {
                    callback(null, 0);
                }
            })
        },

    }, function (err, results) {
        res.send(results)
    });
}

exports.orderStatistics = async (req, res) => {
    var currentMonth = moment(new Date()).format('YYYY-MM-DD[T00:00:00.000Z]');
    var d = moment(currentMonth).add(-1, 'month')
    var previousMonth = moment(d).format('YYYY-MM-DD[T00:00:00.000Z]');
    var projectQry = [
        { $project: { _id: 0 } },
        { $match: { "requestdate": { $gte: new Date(previousMonth), $lte: new Date(currentMonth) } } },
        { $group: { _id: "$requestdate", myCount: { $sum: 1 } } }
    ];
    orders.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send(err);
        }
    })
}

exports.orderByCustomer = async (req, res) => {
    var currentDay = moment(new Date()).format('YYYY-MM-DD[T00:00:00.000Z]');
    var d = moment(currentDay).add(-7, 'days');
    var previousDay = moment(d).format('YYYY-MM-DD[T00:00:00.000Z]');
    var projectQry = [
        { $project: { _id: 0 } },
        { $match: { "requestdate": { $gte: new Date(previousDay), $lte: new Date(currentDay) } } },
        { $addFields: { "userId": { "$toObjectId": "$customerId" } } },
        {
            $lookup:
            {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "customerDetails"
            }
        },
        { $unwind: { "path": "$customerDetails", "preserveNullAndEmptyArrays": true } },
        { $project: { customerDetails: { password: 0 } } },
    ];
    orders.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.productDetails = async (req, res) => {
    var productId = req.query.productId;
    var projectQry = [
        { $match: { "_id": ObjectId(productId) } },
    ];
    products.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}