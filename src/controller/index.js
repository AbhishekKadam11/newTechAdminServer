var mongoose = require('mongoose');
var ObjectId = require('mongodb').ObjectId;
var passport = require('passport');
var jwt = require('jsonwebtoken');
var async = require('async');
var moment = require('moment');
var async = require("async");
const fs = require('fs');
const multer = require('multer');
const Gridfs = require('multer-gridfs-storage');
const bodyparser = require('body-parser');
const Grid = require('gridfs-stream');
const crypto = require('crypto');

var config = require('../config/database');
var User = require('../models/user');
var customer = require('../models/customer');
var products = require('../models/productuploads');
var orders = require('../models/placeorder');
var customerReview = require('../models/customerreview');
var categorytype = require('../models/category');
var brands = require('../models/brands');
var cities = require('../models/cities');

var gfs;
mongoose.connect(config.database, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    gfs = Grid(db.db, mongoose.mongo);
    console.log("mongoose connected");
});

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
                    res.send({ success: true, token: token, email: req.body.email, role: user['role'] });
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
    var d = moment(currentMonth).add(-1, 'year')
    var previousMonth = moment(d).format('YYYY-MM-DD[T00:00:00.000Z]');
    var projectQry = [
        { $project: { _id: 0, month: { $month: { $toDate: "$requestdate" } }, requestdate: "$requestdate" } },
        { $match: { "requestdate": { $gte: new Date(previousMonth), $lte: new Date(currentMonth) } } },
       
        { $group: { _id: "$month", requestdate: { "$first": "$requestdate" }, myCount: { $sum: 1 } } },
        { $sort: { "requestdate": 1 }}
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
        {
            $lookup:
            {
                from: "orderrequests",
                pipeline: [
                    { $match: { "orderData.productId": productId } }
                ],
                as: "orderDetails"
            }
        },
        { $unwind: { "path": "$orderDetails", "preserveNullAndEmptyArrays": true } },
        { $addFields: { "customerId": { "$toObjectId": "$orderDetails.customerId" } } },
        {
            $lookup:
            {
                from: "users",
                localField: "customerId",
                foreignField: "_id",
                as: "customerDetails"
            }
        },
        { $unwind: { "path": "$customerDetails", "preserveNullAndEmptyArrays": true } },
        {
            $project: {
                "customerDetails.password": 0, "orderDetails._class": 0, "customerDetails._class": 0,
            }
        },
        {
            $addFields: {
                "orderDetails.customerDetails": "$customerDetails"
            }
        },
        {
            $group: {
                _id: '$_id',
                title: { $first: "$title" },
                brand: { $first: "$brand" },
                brand: { $first: "$brand" },
                category: { $first: "$category" },
                modalno: { $first: "$modalno" },
                price: { $first: "$price" },
                image: { $first: "$image" },
                fulldescription: { $first: { $arrayElemAt: ["$fulldescription", 0] } },
                shortdescription: { $first: { $arrayElemAt: ["$shortdescription", 0] } },
                productimages: { $first: "$productimages" },
                arrivaldate: { $first: "$arrivaldate" },
                orderDetails: { $push: "$orderDetails" },
            }
        },
    ];
    products.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result[0]);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.productCategories = async (req, res) => {
    var data = {};
    async.parallel({
        categoryList: function (callback) {
            let projectQry = [
                { $sort: { "name": 1 } }];
            categorytype.aggregate(projectQry).then((result, err) => {
                if (Array.isArray(result) && result.length > 0) {
                    data['category'] = result.map(item => ({
                        text: item.name,
                        id: item._id
                    }));
                    callback(null, data['category']);
                } else {
                    callback(null, err);
                    console.log(err)
                }
            })
        },
        brandList: function (callback) {
            let projectQry = [
                { $sort: { "name": 1 } }];
            brands.aggregate(projectQry).then((result, err) => {
                if (Array.isArray(result) && result.length > 0) {
                    data['brand'] = result.map(item => ({
                        text: item.name,
                        id: item._id
                    }));
                    callback(null, data['brand']);
                } else {
                    callback(null, err);
                    console.log(err)
                }
            })
        }
    }, function (err, results) {
        res.send(results);
    });
}

exports.categoryList = async (req, res) => {
    let projectQry = [
        { $sort: { "name": 1 } }];
    categorytype.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.productList = async (req, res) => {
    var page = req.query.page || 0;
    var limit = req.query.limit || 10;
    var skip = page * limit;
    let projectQry = [
        { $project: { _id: 1, "title": 1, "brand": 1, "category": 1, "modalno": 1, "price": 1, "image": 1, "createdAt": 1 } },
        { $sort: { "createdAt": -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page: parseInt(page) } }],
                data: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }] // add projection here wish you re-shape the docs
            }
        }
    ];
    if (req.query.title) {
        projectQry.push({ $match: { "title": { $regex: req.query.title, $options: 'g' } } });
    }
    if (req.query.brand) {
        projectQry.push({ $match: { "brand": { $regex: req.query.brand, $options: 'g' } } });
    }
    if (req.query.category) {
        projectQry.push({ $match: { "category": { $regex: req.query.category, $options: 'g' } } });
    }
    if (req.query.price) {
        projectQry.push({ $match: { "price": { $regex: req.query.price, $options: 'g' } } });
    }
    if (req.query.createdAt) {
        projectQry.push({ $match: { "createdAt": { $regex: req.query.createdAt, $options: 'g' } } });
    }
    products.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.customerList = async (req, res) => {
    var page = req.query.page || 0;
    var limit = req.query.limit || 10;
    var skip = page * limit;
    let projectQry = [
        { $project: { _id: 1, "email": 1, "profilename": 1, "profilePic": 1, "mobileNo": 1, "city_id": 1, "state_id": 1, "createdAt": 1 } },
        { $sort: { "createdAt": -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page: parseInt(page) } }],
                data: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }] // add projection here wish you re-shape the docs
            }
        }
    ];
    if (req.query.profilename) {
        projectQry.push({ $match: { "profilename": { $regex: req.query.profilename, $options: 'g' } } });
    }
    if (req.query.mobileNo) {
        projectQry.push({ $match: { "mobileNo": { $regex: req.query.mobileNo, $options: 'g' } } });
    }
    if (req.query.createdAt) {
        projectQry.push({ $match: { "createdAt": { $regex: req.query.createdAt, $options: 'g' } } });
    }

    customer.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.customerDetails = async (req, res) => {
    var customerId = req.query.customerId;
    var projectQry = [
        { $match: { "_id": ObjectId(customerId) } },
    ];
    customer.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result[0]);
        } else {
            res.status(400).send("No data found");
        }
    })
}

//create file storage
const storage = new Gridfs({
    url: config.database,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = file.originalname;
                const fileinfo = {
                    filename: filename,
                };
                resolve(fileinfo);
            });
        });
    }
});
exports.multerUpload = multer({ storage, limits: { fieldSize: 25 * 1024 * 1024 } });

exports.uploads = async (req, res) => {
    res.json({ "fileId": req.file.originalname });
}

exports.productUpload = async (req, res) => {
    var payload = req.body;
    var productDetails = new products(payload);
    if (payload) {
        payload.shortdescription = [payload.shortdescription];
        payload.fulldescription = [payload.fulldescription];
        productDetails.save().then(result => {
            // console.log(result)
            res.status(200).send({ "message": "Data saved successfully" });
        }).catch(error => {
            res.status(400).send(error);
        })
    } else {
        res.status(400).send({ "message": "Please provide payload" });
    }
}

/* 
    GET: Fetches a particular image and render on browser
*/
exports.getFile = async (req, res) => {
    try {
        gfs.exist({ filename: req.query.filename }, function (err, file) {
            if (err || !file) {
                res.send('File Not Found');
            } else {
                // gfs.createReadStream(req.query.filename).pipe(res);
                var buffer = [], base64Data;
                var readstream = gfs.createReadStream(req.query.filename);
                readstream.on('data', function (chunk) {
                    buffer.push(chunk);
                });
                readstream.on('end', function () {
                    const fbuf = Buffer.concat(buffer);
                    base64Data = fbuf.toString('base64');
                    res.status(200).json(base64Data);
                });
            }
        });
    } catch (e) {
        res.status(400).send(e);
    }
}

exports.customerbuyProduct = async (req, res) => {
    var productId = req.query.productId;
    var projectQry = [
        { $match: { "orderData.productId": (productId) } },
        { $unwind: { "path": "$orderData", "preserveNullAndEmptyArrays": true } },
        { $addFields: { "productId": { "$toObjectId": "$orderData.productId" } } },
        {
            $lookup:
            {
                from: "productuploads",
                localField: "productId",
                foreignField: "_id",
                as: "productDetails"
            }
        },
        { $unwind: { "path": "$productDetails", "preserveNullAndEmptyArrays": true } },
    ];
    orders.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.productReview = async (req, res) => {
    var productId = req.query.productId;
    var projectQry = [
        { $match: { "productId": (productId) } },
        { $addFields: { "customerId": { "$toObjectId": "$customerId" } } },
        {
            $lookup:
            {
                from: "users",
                localField: "customerId",
                foreignField: "_id",
                as: "customerDetails"
            }
        },
        { $unwind: { "path": "$customerDetails", "preserveNullAndEmptyArrays": true } },
        {
            $project: {
                "customerDetails.password": 0, "_class": 0, "productId": 0, "customerDetails._class": 0
            }
        },
    ];
    customerReview.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.productUpdate = async (req, res) => {
    var payload = req.body;
    if (payload && req.query.productId) {
        payload.shortdescription = [payload.shortdescription];
        payload.fulldescription = [payload.fulldescription];
        products.updateOne({ "_id": req.query.productId }, { $set: payload }, (err, result) => {
            if (err) {
                res.status(400).send({ "error": err });
            }
            res.status(200).send({ "message": "Data saved successfully" });
        })
    } else {
        res.status(400).send({ "message": "Please provide payload" });
    }
}

exports.customerUpdate = async (req, res) => {
    var payload = req.body;
    if (payload && req.query.customerId) {
        customer.updateOne({ "_id": req.query.customerId }, { $set: payload }, (err, result) => {
            if (err) {
                res.status(400).send({ "error": err });
            }
            res.status(200).send({ "message": "Data saved successfully" });
        })
    } else {
        res.status(400).send({ "message": "Please provide payload" });
    }
}

exports.orderCountByCustomer = async (req, res) => {
    var projectQry = [
        { $project: { _id: 0 } },
        // { $match: { "requestdate": { $gte: new Date(previousDay), $lte: new Date(currentDay) } } },
        { $addFields: { "productId": "$orderData.productId" } },
        { $unwind: { "path": "$productId", "preserveNullAndEmptyArrays": true } },
        { $addFields: { "productId": { "$toObjectId": "$productId" } } },
        {
            $lookup:
            {
                from: "productuploads",
                localField: "productId",
                foreignField: "_id",
                as: "productDetails"
            }
        },
        { $unwind: { "path": "$productDetails", "preserveNullAndEmptyArrays": true } },
        { $project: { productDetails: { category: 1, } } },
        { $group: { _id: "$productDetails.category", myCount: { $sum: 1 } } }
    ];
    orders.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.orderList = async (req, res) => {
    var page = req.query.page || 0;
    var limit = req.query.limit || 10;
    var skip = page * limit;
    let projectQry = [
        { $sort: { "_id": -1 } },
        { $unwind: { "path": "$orderData", "preserveNullAndEmptyArrays": true } },
        { $addFields: { "productId": "$orderData.productId" } },
        { $unwind: { "path": "$productId", "preserveNullAndEmptyArrays": true } },
        { $addFields: { "productId": { "$toObjectId": "$productId" } } },
        { $addFields: { "customerId": { "$toObjectId": "$customerId" } } },
        {
            $lookup:
            {
                from: "productuploads",
                localField: "productId",
                foreignField: "_id",
                as: "productDetails"
            }
        },
        { $unwind: { "path": "$productDetails", "preserveNullAndEmptyArrays": true } },
        {
            $project: {
                "productDetails.fulldescription": 0, "productDetails.shortdescription": 0, "productDetails.productimages": 0,
                "productDetails.__v": 0
            }
        },
        {
            $lookup:
            {
                from: "users",
                localField: "customerId",
                foreignField: "_id",
                as: "customerDetails"
            }
        },
        { $unwind: { "path": "$customerDetails", "preserveNullAndEmptyArrays": true } },
        {
            $project: {
                "customerDetails._class": 0, "customerDetails._id": 0, "customerDetails.password": 0,
                "customerDetails.gender": 0
            }
        },
        {
            $group: {
                _id: '$_id',
                customerId: { $first: "$customerId" },
                orderId: { $first: "$orderId" },
                totalamount: { $first: "$totalamount" },
                requestdate: { $first: "$requestdate" },
                orderData: { $push: "$orderData" },
                productDetails: { $push: "$productDetails" },
                customerDetails: { $first: "$customerDetails" },
            }
        },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page: parseInt(page) } }],
                data: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }]
            }
        },
    ];
    if (req.query.email) {
        projectQry.splice(10, 0, { $match: { "customerDetails.email": { $regex: req.query.email, $options: 'g' } } });
    }
    if (req.query.profilename) {
        projectQry.splice(10, 0, { $match: { "customerDetails.profilename": { $regex: req.query.profilename, $options: 'g' } } });
    }
    if (req.query.title) {
        projectQry.splice(10, 0, { $match: { "productDetails.title": { $regex: req.query.title, $options: 'g' } } });
    }
    if (req.query.category) {
        projectQry.splice(10, 0, { $match: { "productDetails.category": { $regex: req.query.category, $options: 'g' } } });
    }
    if (req.query.modalno) {
        projectQry.splice(10, 0, { $match: { "productDetails.modalno": { $regex: req.query.modalno, $options: 'g' } } });
    }
    orders.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.stateList = async (req, res) => {
    var projectQry = [
        { $project: { _id: 0, id:1, state: 1 } }
    ];
    cities.aggregate(projectQry).then((result, err) => {
        if (Array.isArray(result) && result.length > 0) {
            res.status(200).send(result);
        } else {
            res.status(400).send("No data found");
        }
    })
}

exports.cityList = async (req, res) => {
    if (req.query.state) {
        var projectQry = [
            { $match: { "state": req.query.state } },
            { $project: { _id: 0, id: 1, city: "$name" } },
           
        ];
        cities.aggregate(projectQry).then((result, err) => {
            if (Array.isArray(result) && result.length > 0) {
                res.status(200).send(result);
            } else {
                res.status(400).send({ "message": "No data found" });
            }
        })
    } else {
        res.status(400).send({ "message": "Please provide payload" });
    }
}

exports.stateWiseCount = async (req, res) => {
    if (req.query.state) {
        var projectQry = [
            { $project: { _id: 0 } },
            { $match: { "state": req.query.state } },
            { $group: { _id: "$city", myCount: { $sum: 1 } } }
        ];
        customer.aggregate(projectQry).then((result, err) => {
            if (Array.isArray(result) && result.length > 0) {
                res.status(200).send(result);
            } else {
                res.status(400).send({"message": "No data found" });
            }
        })
    } else {
        res.status(400).send({"message": "Please provide payload" });
    }
}