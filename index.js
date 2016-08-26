var _ = require('lodash');
var async = require('async-chainable');
var fspath = require('path');
var glob = require('glob');
var doop = {}; // Gets populated as the module is processed

module.exports = doop;

doop.settings = {
	globs: {
		projectRoot: './package.json',
		units: {
			client: './client/units/*/',
			server: './server/units/*/',
		},
	},
	paths: {
		doop: '/media/LinuxSSD/Projects/Doop',
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
* Get the absolute Doop directory path and ensure that it exists
* @param {function} finish Callback function
* @param {string} [altPath] Alternative path to check (overrides `doop.settings.paths.doop`)
*/
doop.getDoopPath = function(finish, altPath) {
	var doopSource = _.trimEnd(altPath || doop.settings.paths.doop, '/') + '/';
	glob(doopSource, function(err, dirs) {
		if (err) return finish(err);
		if (!dirs.length) return finish('Doop directory not found: "' + doopSource + '"');
		if (dirs.length > 1) return finish('Multiple Doop sources found for "' + doopSource + '"');
		finish(null, dirs[0]);
	});
};


/**
* Get all installed units as an array of strings
* @param {function} finish Callback function
* @param {string} type The type of unit to retrieve. Must correspond with a key in `doop.settings.globs.units`
*/
doop.getUnits = function(finish, type) {
	glob(doop.settings.globs.units[type], function(err, paths) {
		if (err) return finish(err);
		finish(null, paths.map(path => fspath.basename(path)));
	});
};


/**
* Find the relative path for an installed unit
* If multiple units are found (usually when type=null) an error is raised
* If either NONE or ONE unit is found the callback is called
* @param {function} finish Callback function
* @param {string|null} type Optional type of unit to retrieve. If specified, must correspond with a key in `doop.settings.globs.units`, if unspecified all types will be searched
* @param {string} name The name of the unit to find. Globs can be used
*/
doop.getUnit = function(finish, type, name) {
	if (type) {
		glob(fspath.join(doop.settings.paths[type], name), function(err, path) {
			if (err) return finish(err);
			if (!path.length) return finish();
			if (path.length > 1) return finish('Multiple units matching "' + path + '"');
			finish(null, path);
		});
	} else {
		finish('Auto unit finding is currently unsupported');
	}
};
