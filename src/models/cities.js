var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var categorySchema = new Schema({
    id: {
        type: Number
    },
    name: {
        type: String
    },
    state: {
        type: String
    }
},{
    timestamps:true
});

module.exports = mongoose.model('cities', categorySchema, 'cities');