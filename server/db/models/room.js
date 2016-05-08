'use strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
	playerOne: {type: String},
	playerTwo: {type: String},
	isOpen: {type: Boolean, default: true}
});
module.exports = roomSchema;

roomSchema.methods.isEmpty = function(){
	return !this.playerOne && !this.playerTwo;
}

roomSchema.methods.isFull = function(){
	return !!this.playerOne && !!this.playerTwo;
}

mongoose.model('Room', roomSchema)

