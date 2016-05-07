'use strict';

app.config(function ($stateProvider) {
    $stateProvider.state('player', {
        url: '/:roomId',
        controller: 'PlayerCtrl',
        templateUrl: 'js/player/player.template.html'
    });
});