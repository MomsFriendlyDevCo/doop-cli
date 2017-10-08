#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncFlush = require('async-chainable-flush');
var colors = require('chalk');
var doop = require('.');
var fs = require('fs');
var fspath = require('path');
var glob = require('glob');
var inquirer = require('inquirer');
var mkdirp = require('mkdirp');
var program = require('commander');

program
	.version(require('./package.json').version)
	.usage('[unit]')
	.description('Create a unit skeleton from the given name (plurals for unit names are recommended)')
	.option('-d, --dryrun', 'Dry run. Don\'t actually do anything')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', (i, v) => v + 1, 0)
	.parse(process.argv);

async()
	.limit(program.verbose ? 1 : undefined) // Set to only do one thing at once if verbose
	.use(asyncFlush)
	// Sanity checks {{{
	.then(function(next) {
		if (program.args.length > 1) return next('Only one unit name can be specified');
		next();
	})
	// }}}
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Ask for the unit name if none was provided {{{
	.then('unit', function(next) {
		if (program.args.length == 1) return next(null, program.args[0].toLowerCase());

		inquirer.prompt({
			name: 'nameInput',
			type: 'input',
			message: 'What do you want to call the unit (plural please)',
			default: 'widgets',
		}).then(answers => {
			if (!answers.nameInput) return next('Cancelled');
			next(null, answers.nameInput.toLowerCase());
		});
	})
	// }}}
	// Check that the unit doesn't exist {{{
	.then(function(next) {
		doop.getUnit(function(err, found) {
			if (err) return next(err);
			if (found) return next('A unit with that name already exists');
			next();
		}, this.unit);
	})
	// }}}
	// Get a list of supported template files {{{
	.then('templates', function(next) {
		if (program.verbose) console.log(`Searching for templates in '${__dirname}/templates/*'`);
		glob(`${__dirname}/templates/*`, function(err, files) {
			if (err) return next(err);
			if (!files.length) return next('No templates were found');
			next(null, files.map(f => ({
				templatePath: f,
				name: fspath.basename(f),
			})));
		});
	})
	// }}}
	// Confirm that the naming looks right {{{
	.then('names', function(next) {
		var singular = this.unit.replace(/s$/, '');
		next(null, {
			lcSingular: singular,
			lcPlural: this.unit,
			scSingular: _.startCase(singular),
			scPlural: _.startCase(this.unit),
		});
	})
	.then(function(next) {
		inquirer.prompt({
			name: 'nameConfirm',
			type: 'confirm',
			message: `Does the follwing unit name look ok: ${this.names.scPlural} (plural + unit name) / ${this.names.scSingular} (singular)`,
			default: true,
		}).then(answers => {
			if (!answers.nameConfirm) return next('Cancelled');
			next();
		});
	})
	// }}}
	// Ask which template files should be created {{{
	.then('templates', function(next) {
		inquirer.prompt({
			name: 'templates',
			type: 'checkbox',
			message: 'Select files to create',
			choices: this.templates,
			default: this.templates.map(t => t.name), // Select all by default
		}).then(answers => {
			next(null, this.templates.filter(t => answers.templates.includes(t.name)));
		});
	})
	// }}}
	// Create the unit directory {{{
	.then(function(next) {
		if (program.dryrun) {
			console.log(`Would make dir 'units/${this.unit}'`);
			return next();
		}
		mkdirp(`units/${this.unit}`, next);
	})
	// }}}
	// Create each template {{{
	.forEach('templates', function(next, template) {
		async()
			// Calculate the destination name {{{
			.set('names', this.names)
			.set('unit', this.unit)
			.set('writePath',
				`units/${this.unit}/`
				+ template.name
					.replace(/widgets/g, this.names.lcPlural)
					.replace(/widget/g, this.names.lcSingular)
					.replace(/Widgets/g, this.names.scPlural)
					.replace(/Widget/g, this.names.scSingular)
			)
			// }}}
			// Read in file contents {{{
			.then('contents', function(next) {
				if (program.verbose > 1) console.log('READ', template.name);
				fs.readFile(template.templatePath, 'utf-8', next);
			})
			// }}}
			// Replace `widgets` (both cases and plurals) with our unit names {{{
			.then('contents', function(next) {
				next(null, this.contents
					.replace(/widgets/g, this.names.lcPlural)
					.replace(/widget/g, this.names.lcSingular)
					.replace(/Widgets/g, this.names.scPlural)
					.replace(/Widget/g, this.names.scSingular)
				);
			})
			// }}}
			// Write the new file {{{
			.then(function(next) {
				if (program.verbose > 1) console.log('WRITE', this.writePath);
				if (program.dryrun) {
					console.log(`Would write file '${this.writePath}'`);
					return next();
				}
				fs.writeFile(this.writePath, this.contents, next);
			})
			// }}}
			.end(next);
	})
	// }}}
	// End {{{
	.flush()
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			console.log(`${this.templates.length} files created in directory 'units/${this.unit}'`);
			process.exit(0);
		}
	});
	// }}}
