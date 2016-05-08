app.config(function ($stateProvider) {
    $stateProvider.state('homepage', {
        url: '/',
        controller: 'HomepageCtrl',
        templateUrl: 'js/homepage/homepage.template.html',
        resolve: {
        	rooms: function($http){
        		return $http.get('/api/rooms')
                .then( res => res.data )
        	}
        }
    });
});
