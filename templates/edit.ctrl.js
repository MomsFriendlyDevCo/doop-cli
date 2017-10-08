angular
	.module('app')
	.run($router => $router.when('/widgets/:id').title('Edit Widget').component('widgetsEditCtrl'))
	.component('widgetsEditCtrl', {
		templateUrl: '/units/widgets/edit.tmpl.html',
		controller: function($loader, $location, $scope, $session, $toast, $router, Widgets) {
			var $ctrl = this;
			$ctrl.$session = $session;

			// Data refresher {{{
			$ctrl.widget;
			$ctrl.refresh = ()=> {
				$loader.start($scope.$id);

				return Widgets.get({id: $router.params.id}).$promise
					.then(data => $ctrl.widget = data)
					.catch($toast.catch)
					.finally(() => $loader.stop($scope.$id))
			};
			// }}}

			// Data saving {{{
			$ctrl.save = ()=> {
				$loader.startBackground($scope.$id);

				return Widgets.save({id: $router.params.id}, $ctrl.widget).$promise
					.then(() => $location.path('/widgets'))
					.catch($toast.catch)
					.finally(() => $loader.stop($scope.$id))
			};
			// }}}

			$scope.$evalAsync($ctrl.refresh);
		},
	});
