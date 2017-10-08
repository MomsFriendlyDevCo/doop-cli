angular
	.module('app')
	.run($router => $router.when('/widgets').title('Widgets').component('widgetsListCtrl'))
	.component('widgetsListCtrl', {
		templateUrl: '/units/widgets/list.tmpl.html',
		controller: function($loader, $q, $scope, $session, $toast, Widgets) {
			var $ctrl = this;
			$ctrl.$session = $session;

			// Data refresher {{{
			$ctrl.query = {};
			$ctrl.widgets;
			$ctrl.widgetsMeta;
			$ctrl.refresh = function() {
				$loader.start($scope.$id, $ctrl.widgets === undefined);

				$q.all([
					// Fetch widgets
					Widgets.query($ctrl.query).$promise
						.then(data => $ctrl.widgets = data),

					// Fetch meta (once)
					! $ctrl.widgetsMeta
					? Widgets.meta().$promise
						.then(data => $ctrl.widgetsMeta = data)
					: undefined,
				])
					.catch($toast.catch)
					.finally(() => $loader.stop($scope.$id));

			};
			// }}}

			// React to query changes / Initial data fetch {{{
			$scope.$watch('$ctrl.query', ()=> $ctrl.refresh());
			// }}}
		},
	})
