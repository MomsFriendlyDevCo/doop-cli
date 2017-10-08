angular.module('app')
.factory('Widgets', function($resource) {
	return $resource('/api/widgets/:id', {}, {
	});
});
