app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/:roomId/host',
        controller: 'HomeCtrl',
        templateUrl: '/home.html'
    });
});
