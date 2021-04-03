var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var brandSchema = new Schema({
    name: {
        type: String
    }
},{
    timestamps:true
});

module.exports = mongoose.model('brands', brandSchema);