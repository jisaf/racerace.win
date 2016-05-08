'use strict';

app.controller('HomepageCtrl', function($scope, $http, rooms){
	/**
	@GOD @JESUS @JEFFBEZOS @JEFFDEAN I'M SORRY FOR PUTTING API REQUESTS IN THE CONTROLLER. 
	IT'S GETTING LATE OVER HERE AT THE HACKATHON. 
	PLEASE FORGIVE. 

	YOURS TRULY,
	DANIEL
	**/
	const socketId = 'mynameisssam';
	$scope.rooms = rooms.filter( room => {
		return room.playerOne !== socketId && room.playerTwo !== socketId;
	});
	$scope.doMessage = "Create or join a game";

	function getRooms(){
		return $http.get('/api/rooms')
		.then( res => {
			$scope.rooms = res.data.filter( room => {
				return room.playerOne !== socketId && room.playerTwo !== socketId;
			});
		})
	}

	$scope.joinRoom = (room) => {
		let joinedRoom;
		$http.put(`/api/rooms/${room._id}`, {socketId: 'mynameisntsam'})
		.then( res => {
			joinedRoom = res.data;
			getRooms();
		})
		.then( () => {
			$scope.doMessage = `You just joined a room! Go to racerace.win/${joinedRoom._id} to play
			or racerace.win/${joinedRoom._id}/host to watch!`;
		})
	}

	$scope.createGame = function(){
		let createdRoom;
		$http.post('/api/rooms', {socketId: 'mynameissam'})
		.then( res => {
			createdRoom = res.data;
			getRooms();
		})
		.then( () => {
			$scope.doMessage = `You just created a room! Go to racerace.win/${createdRoom._id} to play
			or racerace.win/${createdRoom._id}/host to watch!`;
		})
	}

	$scope.filterInactive = {
		isOpen: true,
	};
})