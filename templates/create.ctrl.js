angular
	.module('app')
	.run($router => $router.when('/widgets/create').component('widgetsCreateCtrl'))
	.component('widgetsCreateCtrl', {
		controller: function($loader, $location, $router, $scope, $toast, Widgets) {
			var $ctrl = this;

			$ctrl.create = ()=> {
				$loader.start($scope.$id);

				return Widgets.create().$promise
					.then(data => $location.path(`/widgets/${data._id}`))
					.catch($toast.catch)
					.finally(()=> $loader.stop($scope.$id))
			};

			$scope.$evalAsync($ctrl.create);
		},
	})
