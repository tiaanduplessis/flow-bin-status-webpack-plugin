'use strict'

const shell = require('shelljs')

function noop () {}

function FlowStatusWebpackPlugin (options) {
  this.options = options || {}
}

FlowStatusWebpackPlugin.prototype.apply = function (compiler) {
  let options = this.options
  let flowArgs = options.flowArgs || ''
  let flow = options.binaryPath || 'flow'
  let failOnError = options.failOnError || false
  let onSuccess = options.onSuccess || noop
  let onError = options.onError || noop
  let root = options.root || ''
  let firstRun = true
  let waitingForFlow = false

  function startFlow (cb) {
    if (options.restartFlow === false) {
      cb()
    } else {
      shell.exec(`${flow} stop ${root}`, {silent: true}, function () {
        shell.exec(`${flow} start ${flowArgs} ${root}`, {silent: true}, cb)
      })
    }
  }

  function startFlowIfFirstRun (compiler, cb) {
    if (firstRun) {
      firstRun = false
      startFlow(cb)
    } else {
      cb()
    }
  }

  function flowStatus (successCb, errorCb) {
    if (!waitingForFlow) {
      waitingForFlow = true

      // this will start a flow server if it was not running
      shell.exec(`${flow} status --color always --quiet ${root}`, {silent: true}, function (code, stdout, stderr) {
        let hasErrors = code !== 0
        let cb = hasErrors ? errorCb : successCb
        waitingForFlow = false

        cb(stdout, stderr)
      })
    }
  }

  let flowError = null

  function checkItWreckIt (compiler, cb) {
    startFlowIfFirstRun(compiler, function () {
      flowStatus(function success (stdout) {
        onSuccess(stdout)

        cb()
      }, function error (stdout, stderr) {
        let msg = stdout

        if (!stdout && !stderr) {
          stderr = 'Unknown error!'
        }

        if (stderr) {
          msg = (msg ? msg + '\n' : '') + 'flow server: ' + stderr
        }

        onError(msg)
        flowError = new Error(msg)
        // Here we don't pass error to callback because
        // webpack-dev-middleware would just throw it
        // and cause webpack dev server to exit with
        // an error status code. Obviously, having to restart
        // the development webpack server after every flow
        // check error would be too annoying.
        cb()
      })
    })
  }

  compiler.hooks.run.tapAsync('flow-bin-status-webpack-plugin', checkItWreckIt)
  compiler.hooks.watchRun.tapAsync('flow-bin-status-webpack-plugin', checkItWreckIt)

  // If there are flow errors, fail the build before compilation starts.
  compiler.hooks.compilation.tap('flow-bin-status-webpack-plugin', function (compilation) {
    if (flowError) {
      if (failOnError === true) {
        compilation.errors.push(flowError)
      }
      flowError = null
    }
  })
}

module.exports = FlowStatusWebpackPlugin
