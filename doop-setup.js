#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var colors = require('chalk');
var doop = require('.');
var glob = require('glob');
var fs = require('fs');
var fspath = require('path');
var inquirer = require('inquirer');
var program = require('commander');

program
	.version(require('./package.json').version)
	.description('Configure Doop-Cli')
	.option('-d, --dryrun', 'Dry run. Don\'t actually save the config, just print what would be saved')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.parse(process.argv);


async()
	// Retrieve existing settings + prompt to overwrite if they exist {{{
	.then('existingSettings', function(next) {
		doop.getUserSettings(function(err, config) {
			if (err) return next();
			return next(null, config);
		}, false);
	})
	.then(function(next) {
		if (!_.isObject(this.existingSettings)) return next(); // No settings - don't ask to re-setup
		inquirer.prompt([
			{
				name: 'runAgain',
				type: 'confirm',
				message: 'Doop-Cli is already configured. Are you sure you want to run setup again?',
			},
		])
			.then(function(answers) {
				if (!answers.runAgain) return next('Aborted setup');
				next();
			});
	})
	// }}}
	// Setup questions {{{
	.then('doopPath', function(next) {
		inquirer.prompt([
			{
				name: 'doopPath',
				type: 'input',
				message: 'Where is the Doop directory located on disk?',
				default: _.get(this.existingSettings, 'paths.doop'),
				validate: doopPath => new Promise(function(resolve, reject) {
					if (!doopPath) return resolve(true);
					doop.isDoopProject(function(err) {
						if (err) {
							resolve('Path "' + doopPath + '" does not look like a Doop project');
						} else {
							resolve(true);
						}
					}, doopPath);
				}),
			},
		])
			.then(function(answers) {
				if (!answers.doopPath) return next('Aborted setup');
				next(null, answers.doopPath);
			});
	})
	// }}}
	// Save settings {{{
	.then(function(next) {
		var saveConfig = {
			paths: {
				doop: this.doopPath,
			},
			aliases: doop.settings.aliases,
			tools: doop.settings.tools,
		};

		if (program.dryrun) {
			console.log('Would save:');
			console.log(JSON.stringify(saveConfig, null, '\t'));
			next();
		} else {
			doop.setUserSettings(next, saveConfig);
		}
	})
	// }}}
	// End {{{
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
	// }}}
