#!/usr/bin/env node

var program = require('commander');

program
	.version(require('./package.json').version)
	.description('Perform a Doop operation on the currently active project')
	.command('list', 'List units installed for the current project')
	.command('install [unit...]', 'Install one or more units from the upstream Doop repo')
	.command('merge [unit]', 'Attempt to merge a unit with the upstream Doop repo')
	.command('delete [unit]', 'Delete an exising unit from the project')
	.command('config', 'List Doop config')
	.command('setup', 'Configure Doop-Cli')
	.command('unknown', 'Unknown command catcher', {isDefault: true, noHelp: true})

	.parse(process.argv);
