
# flow-bin-status-webpack-plugin
[![package version](https://img.shields.io/npm/v/flow-bin-status-webpack-plugin.svg?style=flat-square)](https://npmjs.org/package/flow-bin-status-webpack-plugin)
[![package downloads](https://img.shields.io/npm/dm/flow-bin-status-webpack-plugin.svg?style=flat-square)](https://npmjs.org/package/flow-bin-status-webpack-plugin)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/flow-bin-status-webpack-plugin.svg?style=flat-square)](https://npmjs.org/package/flow-bin-status-webpack-plugin)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

> Get flow status on each webpack build

## Table of Contents

- [About](#about)
- [Install](#install)
- [Usage](#usage)
- [Configuration](configuration)
- [Contribute](#contribute)
- [License](#License)

## About

Forked from [flow-status-webpack-plugin](https://github.com/diegodurli/flow-status-webpack-plugin). Merged [open PRs](https://github.com/diegodurli/flow-status-webpack-plugin/pulls) and actively maintained.

## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com). Please follow the [Flow installation instructions](https://flow.org/en/docs/install/) before installing plugin.

```sh
$ npm install --dev flow-bin-status-webpack-plugin
$ # OR
$ yarn add --dev flow-bin-status-webpack-plugin
```

## Usage

```js
var FlowStatusWebpackPlugin = require('flow-bin-status-webpack-plugin');

module.exports = {
    ...
    plugins: [
        new FlowStatusWebpackPlugin()
    ]
}
```

## Configuration

If you want to pass additional command-line arguments to `flow start`, you can pass a `flowArgs` option to the plugin:

```js
var FlowStatusWebpackPlugin = require('flow-bin-status-webpack-plugin');

module.exports = {
    ...
    plugins: [
        new FlowStatusWebpackPlugin({
            flowArgs: '--lib path/to/interfaces/directory'
        })
    ]
}
```

If you don't want the plugin to automatically restart any running Flow server, pass `restartFlow: false`:

```js
var FlowStatusWebpackPlugin = require('flow-bin-status-webpack-plugin');

module.exports = {
    ...
    plugins: [
        new FlowStatusWebpackPlugin({
            restartFlow: false
        })
    ]
}
```

If provided a binary path, will run Flow from this path instead of running it from any global installation.

```js
var FlowStatusWebpackPlugin = require('flow-bin-status-webpack-plugin');

module.exports = {
    ...
    plugins: [
        new FlowStatusWebpackPlugin({
            binaryPath: '/path/to/your/flow/installation'
        })
    ]
}
```

If you want the plugin to fail the build if the code doesn't type check, pass `failOnError = true`, and include the `NoErrorsPlugin`:

```js
var FlowStatusWebpackPlugin = require('flow-bin-status-webpack-plugin');

module.exports = {
    ...
    plugins: [
        new webpack.NoErrorsPlugin(),
        new FlowStatusWebpackPlugin({
            failOnError: true
        })
    ]
}
```

If you want to perform an action on successful/failed Flow checks, use the `onSucess`/`onError` callbacks:

```js
var FlowStatusWebpackPlugin = require('flow-bin-status-webpack-plugin');
var notifier = require('node-notifier');

module.exports = {
    ...
    plugins: [
        new webpack.NoErrorsPlugin(),
        new FlowStatusWebpackPlugin({
            onSuccess: function(stdout) { notifier.notify({ title: 'Flow', message: 'Flow is happy!' }); },
            onError: function(stdout) { notifier.notify({ title: 'Flow', message: 'Flow is sad!' }); }
        })
    ]
}
```

## Contribute

1. Fork it and create your feature branch: git checkout -b my-new-feature
2. Commit your changes: git commit -am 'Add some feature'
3.Push to the branch: git push origin my-new-feature 
4. Submit a pull request

## License

MIT
    