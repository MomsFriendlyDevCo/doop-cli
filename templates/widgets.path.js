var monoxide = require('monoxide');

app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
	data: req => req.user ? {user: req.user._id} : undefined,
	get: app.middleware.ensure.login,
	query: app.middleware.ensure.login,
	count: app.middleware.ensure.login,
	create: app.middleware.ensure.login,
	save: app.middleware.ensure.login,
	meta: app.middleware.ensure.login,

	delete: function(req, res, next) { // Override all incomming delete methods to set `status=deleted` instead
		monoxide.save({
			$collection: req.monoxide.collection,
			$id: req.monoxide.id,
			status: 'deleted',
		}, function(err) {
			if (err) return res.status(400).send(err).end();
			res.send({});
		});
	},
}));
