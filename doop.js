#!/usr/bin/env node

var program = require('commander');

program
	.version(require('./package.json').version)
	.description('Perform a Doop operation on the currently active project')
	.command('list', 'List units installed for the current project', {isDefault: true})
	.command('install [unit]', 'Install a unit from the upstream Doop repo')
	.command('update [unit]', 'Attempt to merge a unit with the upstream Doop repo')
	.command('delete [unit]', 'Delete an exising unit from the project')
	.command('config', 'List Doop config')
	.option('-s, --server', 'Specify explicitally that a unit refers to a server side unit (cannot be used with `--client`)')
	.option('-c, --client', 'Specify explicitally that a unit refers to a client side unit (cannot be used with `--server`)')
	.option('--repo [repo]', 'Override the upstream Doop repo to use (defaults to `https://github.com/MomsFriendlyDevCo/Doop`). This can be a URL or directory on disk', 'https://github.com/MomsFriendlyDevCo/Doop')
	.option('--tool [alias]', 'Override the tool to use during update operations (defaults to `meld`)', 'meld')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.parse(process.argv);
