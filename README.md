Doop-CLI
========
Command Line Interface for the [Doop Framework](https://github.com/MomsFriendlyDevCo/Doop).

```
  Usage: doop [options] [command]


  Commands:

    config                    List Doop config
    delete [unit]             Delete an exising unit from the project
    gentest-schema [unit...]  Generate Mocha/Chai tests from unit schema files
    glob [glob]               Glob for files within units and perform operations on them
    install [unit...]         Install one or more units from the upstream Doop repo
    list                      List units installed for the current project
    merge [unit]              Attempt to merge a unit with the upstream Doop repo
    setup                     Configure Doop-Cli
    help [cmd]                display help for [cmd]

  Perform a Doop operation on the currently active project

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```


Configuration
-------------
The `~/.dooprc` file is read for additional Doop settings. This file will be created with a basic layout when running `doop setup` for the first time.

Run the `doop config` command for the current configuration.


| Config path               | Type   | Default          | Description                                                                            |
|---------------------------|--------|------------------|----------------------------------------------------------------------------------------|
| `globs.projectRoot`       | string | `./package.json` | The glob to use to identify the project root                                           |
| `globs.units`             | string | `./units/*/`     | Where to find a projects Units                                                         |
| `paths.doopCli`           | string | Programatic      | The file path to the Doop CLI file (automatically determined by default)               |
| `paths.doop`              | string | Null             | The path on disk of the master Doop repo                                               |
| `paths.project`           | string | Programatic      | The path on disk of the current project (automatically determined by default)          |
| `aliases`                 | Object | `{default: 'list', ls: 'list', i: 'install', 'rm': 'delete'}` | An object containing a list of valid [alias](#aliases) commands |
| `tools`                   | Object | `{meld: 'meld {{{project.path}}} {{{doop.path}}}'}` | An object of available tools (used mainly to merge) |
| `list.changes.maxEdited`  | number | `3`              | The maximum number of files to show per unit before compressing the list display       |
| `list.changes.maxCreated` | number | `3`              | As with `list.changes.maxEdited` but for created files                                 |


Aliases
-------
Doop supports command line aliasing similar to Git. By specifying an alias you can provide a shortcut to the full command without constant repetion.

* The meta `default` alias specifies what command to actually run if the CLI is run with no arguments
* All commands are assumed to assume a `doop` prefix unless the alias begins with an exclaimation mark (to run the command as is)


For example setting the following in your `~/.dooprc` file will configure a selection of aliases:

```ini
[aliases]
default=list
ls=list
i=install
rm=delete
schm=glob *.schm.js
status=!git status
```

* The `default` parameter tells Doop what to run if no command is specified (i.e. you run the CLI as just `doop` with no arguments).
* Running `doop ls` will actually run `doop list`
* Running `doop status` will run `git status`. The exclaimation mark prefix indicates that the command should be run as-is without an automatic `doop` prefix
* Running `doop schm` will run `doop glob *.schm.js` files. Note that this will also carry any command line arguments automatically. For example `doop schm -e` will actually run `doop glob *.schm.js -e`
