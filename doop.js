#!/usr/bin/env node

var program = require('commander');

program
	.version(require('./package.json').version)
	.description('Perform a Doop operation on the currently active project')
	.command('config', 'List Doop config')
	.command('delete [unit]', 'Delete an exising unit from the project')
	.command('gen-test [unit...]', 'Generate Mocha/Chai tests from unit schema files')
	.command('glob [globs...]', 'Glob for files within units and perform operations on them')
	.command('install [unit...]', 'Install one or more units from the upstream Doop repo')
	.command('list', 'List units installed for the current project')
	.command('merge [unit]', 'Attempt to merge a unit with the upstream Doop repo')
	.command('setup', 'Configure Doop-Cli')
	.command('unknown', 'Unknown command catcher', {isDefault: true, noHelp: true})

	.parse(process.argv);
