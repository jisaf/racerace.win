app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html',
        controller: function($scope, socket){
        	let players = 0;
        	socket.on('playerconnected', function(){
        		console.log('playerconnected event')
        		players++;
        		console.log('num players:', players)
        	})
        	socket.on('connect', function(){
        		socket.emit('playerconnected')
        		players++;
        		console.log('num players:', players)
        	});

        	socket.on('disconnect', function(){console.log('disconnected')})
        }
    });
});