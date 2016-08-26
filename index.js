var _ = require('lodash');
var async = require('async-chainable');
var fspath = require('path');
var glob = require('glob');
var doop;
module.exports = doop = {};

doop.settings = {
	globs: {
		projectRoot: './package.json',
		units: {
			client: './client/units/*/',
			server: './server/units/*/',
		},
	},
	paths: {
		client: './client/units',
		server: './server/units',
	},
};


/**
* Chdir into a project root
* @param {function} finish Callback function
* @param {boolean} [strict=true] Also check for the existance of `doop.settings.globs.units.{client,server}`
*/
doop.chProjectRoot = function(finish, strict) {
	var checkDir = function() {
		glob(doop.settings.globs.projectRoot, function(err, files) {
			if (files.length) {
				if (strict || _.isUndefined(strict)) {
					// Strict checking {{{
					async()
						.parallel({
							client: function(next) {
								glob(doop.settings.globs.units.client, next);
							},
							server: function(next) {
								glob(doop.settings.globs.units.server, next);
							},
						})
						.end(function(err) {
							if (err) return finish(err);
							if (this.client.length && this.server.length) return finish();
							// No strict checks pass - keep recursing backwards
							process.chdir('..');
							return checkDir();
						});
					// }}}
				} else { // No strict checks
					finish();
				}
			} else if (process.cwd() == '/') {
				finish('Cannot find project root');
			} else {
				process.chdir('..');
				checkDir();
			}
		});
	}
	checkDir();
};


/**
* Get all installed units as an array of strings
* @param {function} finish Callback function
* @param {string} The type of unit to retrieve. Must correspond with a key in `doop.settings.globs.units`
*/
doop.getUnits = function(finish, type) {
	glob(doop.settings.globs.units[type], function(err, paths) {
		if (err) return finish(err);
		finish(null, paths.map(path => fspath.basename(path)));
	});
};
