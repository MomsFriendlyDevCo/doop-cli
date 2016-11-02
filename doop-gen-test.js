#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncExec = require('async-chainable-exec');
var asyncFlush = require('async-chainable-flush');
var colors = require('chalk');
var doop = require('.');
var fs = require('fs');
var fspath = require('path');
var glob = require('glob');
var program = require('commander');
var temp = require('temp');

program
	.version(require('./package.json').version)
	.usage('[schms...]')
	.description('Generate Mocha/Chai tests from unit schema files')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.option('--no-clobber', 'Dont attempt to update existing files')
	.parse(process.argv);

async()
	.use(asyncFlush)
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Load project database {{{
	.then('models', function(next) {
		global.app = require(doop.settings.paths.project + '/units/core/app');
		global.app.config = require(doop.settings.paths.project + '/config/index.conf');
		require(doop.settings.paths.project + '/units/db/loader')(next);
	})
	// }}}
	// Glob all *.schm.js files to determine schemas {{{
	.then('schms', function(next) {
		glob('**/*.schm.js', {cwd: fspath.join(doop.settings.paths.project, doop.settings.paths.units)}, function(err, files) {
			if (err) return next(err);
			if (!files.length) return next('No matching models found');
			if (program.verbose >= 2) console.log('Found schm files:', files.map(f => colors.cyan(f)).join(', '));

			if (program.args.length) { // Apply filters
				files = files.filter(file => _.includes(program.args, fspath.basename(file, '.schm.js')));
			}

			next(null, files.map(function(file) {
				return {
					id: fspath.basename(file, '.schm.js'),
					path: file,
				};
			}));
		});
	})
	// }}}
	// Determine owning units from found paths {{{
	.forEach('schms', function(next, schm) {
		schm.unit = doop.getUnitByResource(schm.path);
		if (!schm.unit) return next('Unable to determine unit for model "' + schm.path + '"');
		doop.getUnit(function(err, path) {
			if (err) return next(err);
			schm.unitPath = path[0];
			next();
		}, schm.unit);
	})
	// }}}
	// Determine if the test file already exists {{{
	.forEach('schms', function(next, schm) {
		schm.testPath = fspath.join(schm.unitPath, schm.id + '.test.js');
		fs.access(schm.testPath, function(err, stat) {
			schm.testPathExisting = ! err;
			next();
		});
	})
	// }}}
	// Final sanity checks before we run {{{
	.then(function(next) {
		if (!program.clobber && this.schms.some(schm => schm.testPathExisting)) {
			return next('Refusing to overwrite existing test files: ' + this.schms.filter(schm => schm.testPathExisting).map(schm => schm.path).join(', '));
		}

		if (!this.schms.every(schm => this.models[schm.id])) {
			return next('Unable to find matching MongoDB models: ' + this.schms.filter(schm => !this.models[schm.id]).map(schm => schm.id).join(', '));
		}

		next();
	})
	// }}}
	// Generate testkit {{{
	.forEach('schms', function(next, schm) {
		schm.generated = {};

		async()
			.set('models', this.models)
			.parallel({
				get: function(next) {
					var test = schm.generated.get = [
						"\tit('GET /api/" + schm.unit + "', function(done) {",
						"\t\tapp.test.agent.get(app.config.url + '/api/" + schm.unit + "')",
						"\t\t\t.end(function(err, rs) {",
						"\t\t\t\tif (res.body.error) return done(res.body.error);",
						"\t\t\t\texpect(err).to.not.be.ok;",
						"\t\t\t\texpect(res.body).to.be.an.array",
						"",
						"\t\t\t\tres.body.forEach(function(i) {",
					];

					var sortedPaths = _(this.models[schm.id].$mongooseModel.schema.paths)
						.map((v,k) => v)
						.sortBy('path')
						.value();

					_.forEach(sortedPaths, function(path) {
						var id = path.path;
						if (id == '__v') return; // Weird item - ignore for now
						var isDeep = /\./.test(id); // Is the path nested? (sub-docs, objects of objects)

						if (id.startsWith('_') && id != '_id') { // Hidden value?
							test.push("\t\t\t\t\texpect(i).to.not.have." + (isDeep ? 'deep.' : '') + "property('" + id + "');");
						} else {
							test.push("\t\t\t\t\texpect(i).to.have." + (isDeep ? 'deep.' : '') + "property('" + id + "');");
							switch (path.instance.toLowerCase()) {
								case 'string':
									test.push("\t\t\t\t\texpect(i." + id + ").to.be.a.string;");
									break;
								case 'number':
									test.push("\t\t\t\t\texpect(i." + id + ").to.be.a.number;");
									break;
								case 'date':
									test.push("\t\t\t\t\texpect(i." + id + ").to.be.a.date;");
									break;
								case 'boolean':
									test.push("\t\t\t\t\texpect(i." + id + ").to.be.a.boolean;");
									break;
								case 'array':
									test.push("\t\t\t\t\texpect(i." + id + ").to.be.an.array;");
									break;
								case 'object':
									test.push("\t\t\t\t\texpect(i." + id + ").to.be.an.object;");
									break;
								case 'objectid':
									// Do nothing - also don't report an error
									break;
								default:
									if (program.verbose) console.log('Unknown Mongo data type:', colors.cyan(path.instance.toLowerCase()));
							}
						}
					});

					test.push('');
					test.push('\t\t\t\t\tdone();');
					test.push('\t\t\t\t});');
					test.push('\t\t\t});');
					test.push('\t\t});');
					test.push('\t});');
					next();
				},
			})
			.end(next);
	})
	// }}}
	// Write main file / temporary file {{{
	.forEach('schms', function(next, schm) {
		if (schm.testPathExisting) { // Write to temporary file
			schm.testPathTemp = temp.path({suffix: '--' + schm.id + '.schm.js'});
			if (program.verbose >= 2) console.log('Write', colors.cyan(schm.id), 'test to temporary file', colors.cyan(schm.testPathTemp));
			var outStream = fs.createWriteStream(schm.testPathTemp);
		} else { // Write to real file
			if (program.verbose >= 2) console.log('Write', colors.cyan(schm.id), 'test to', colors.cyan(schm.testPath));
			var outStream = fs.createWriteStream(schm.testPath);
		}

		outStream.on('finish', next);

		outStream.write("describe('ReST accessor /api/" + schm.id + "', function() {\n\n");

		_.forEach(schm.generated, function(text, method) {
			outStream.write(text.join('\n'));
		});

		outStream.write("\n\n});");
		outStream.end();
	})
	// }}}
	// Open merge session when needed {{{
	.limit(1)
	.forEach('schms', function(next, schm) {
		if (!schm.testPathExisting) return next();

		if (program.verbose) console.log('Merge', colors.cyan(schm.testPath), colors.cyan(schm.testPathTemp));

		async()
			.use(asyncExec)
			.execDefaults({stdio: 'inherit'})
			.exec([
				'meld',
				schm.testPath,
				schm.testPathTemp,
			])
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
			process.exit(0);
		}
	});
	// }}}
