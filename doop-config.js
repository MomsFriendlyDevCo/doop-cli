#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncFlush = require('async-chainable-flush');
var colors = require('chalk');
var doop = require('.');
var program = require('commander');

program
	.version(require('./package.json').version)
	.description('List Doop config')
	.parse(process.argv);

async()
	.use(asyncFlush)
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Walk over all config values and output a tree {{{
	.then(function(next) {
		var configWalker = function(branch, level) {
			_.forEach(branch, function(val, key) {
				var prefix = _.repeat('  ', level) + '-';
				if (_.isObject(val)) {
					console.log(prefix, colors.cyan(key) + ':');
					configWalker(val, level + 1);
				} else if (_.isString(val)) {
					console.log(prefix, colors.cyan(key) + ':', '"' + val + '"');
				} else if (_.isNumber(val)) {
					console.log(prefix, colors.cyan(key) + ':', colors.magenta(val));
				} else {
					console.log(perfix, colors.cyan(key) + ':', colors.red('UNKNOWN'), val);
				};
			});
		};
		configWalker(doop.settings, 0);
		next();
	})
	// }}}
	// End {{{
	.flush()
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
	// }}}
