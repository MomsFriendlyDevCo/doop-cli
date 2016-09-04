var _ = require('lodash');
var async = require('async-chainable');
var fs = require('fs');
var fspath = require('path');
var glob = require('glob');
var homedir = require('homedir');
var ini = require('ini');

var doop = {}; // Gets populated as the module is processed

module.exports = doop;

var iniPath = fspath.join(homedir(), '.dooprc');

doop.settings = {
	globs: {
		projectRoot: './package.json',
		units: {
			client: './client/units/*/',
			server: './server/units/*/',
		},
	},
	paths: {
		doop: '',
		client: './client/units',
		server: './server/units',
	},
	aliases: {
		default: 'list',
		ls: 'list',
		i: 'install',
		rm: 'delete',
	},
	tools: {
		// Mustache templates for merge tools (NOTE: Use three brackets to avoid HTML escaping)
		meld: 'meld {{{project.path}}} {{{doop.path}}}',
	},
	list: {
		changes: {
			maxEdited: 3,
			maxCreated: 3,
		},
	},
};


/**
* Chdir into a project root
* @param {function} finish Callback function
* @param {boolean} [strict=true] Validate the path via doop.isDoopProject()
*/
doop.chProjectRoot = function(finish, strict) {
	var checkDir = function() {
		glob(doop.settings.globs.projectRoot, function(err, files) {
			if (files.length) {
				if (strict || _.isUndefined(strict)) {
					// Strict checking {{{
					doop.isDoopProject(function(err) {
						if (err) {
							process.chdir('..');
							return checkDir();
						} else {
							return finish();
						}
					}, '.');
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
* Validates a given directory against various paths to ensure its a valid Doop project
* @param {function} finish Callback function
* @param {string} path Path to validate
*/
doop.isDoopProject = function(finish, path) {
	async()
		.parallel({
			client: function(next) {
				glob(fspath.join(path, doop.settings.globs.units.client), next);
			},
			server: function(next) {
				glob(fspath.join(path, doop.settings.globs.units.server), next);
			},
		})
		.end(function(err) {
			if (err) return finish(err);
			if (this.client.length && this.server.length) return finish();
			finish('Not a valid Doop project: "' + path + '"');
		});
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


/**
* Load user settings from ~/.dooprc
* @param {function} finish Callback function
* @param {boolean} [mutate=true] Whether the doop.settings object should be mutated with the incomming settings. Set to false to just return the settings
*/
doop.getUserSettings = function(finish, mutate) {
	fs.readFile(iniPath, 'utf-8', function(err, content) {
		if (err && err.errno == -2 && err.code == 'ENOENT') return finish('Doop settings not found. Run `doop setup` to configure'); // No ini file
		if (err) return finish(err);
		var decoded = ini.parse(content);

		if (mutate || _.isUndefined(mutate)) _.merge(doop.settings, decoded);

		finish(null, decoded);
	});
};


/**
* Save user settings into ~/.dooprc
* @param {function} finish Callback function
* @param {Object} settings The settings object to save
*/
doop.setUserSettings = function(finish, settings) {
	var encoded = ini.encode(settings);
	fs.writeFile(iniPath, '# Doop-CLI generated INI file. Setup ran on ' + (new Date).toISOString() + '\n\n' + encoded, 'utf-8', finish);
};
