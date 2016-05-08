'use strict';
const router = require('express').Router();
const mongoose = require('mongoose');

const Room = mongoose.model('Room');

module.exports = router;

router.get('/', (req, res, next) => {
	Room.find()
	.then( rooms => {
		res.json(rooms);
	})
	.catch(next);
})
router.get('/:id', (req, res, next) => {
	Room.findById(req.params.id)
	.then( room => {
		res.json(room);
	})
	.catch(next);
})

router.post('/', (req, res, next) => {
	Room.create({playerOne: req.body.socketId})
	.then( createdRoom => {
		res.json(createdRoom);
	})
	.catch(next)
})

router.put('/:id', (req, res, next) => {
	Room.findById(req.params.id)
	.then( room => {
		if(room.isFull()){
			res.status(500).send({error: 'Room full!'});
			return;
		} else if (room.isEmpty()){
			room.playerOne = req.body.socketId;
		} else {
			room.playerTwo = req.body.socketId
			room.isOpen = false;
		}
		return room.save();
	})
	.then( updatedRoom => {
		//client should check to see which player they are and redirect accordingly
		res.json(updatedRoom);
	})
});