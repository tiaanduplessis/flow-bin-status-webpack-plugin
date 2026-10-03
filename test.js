'use strict'

const assert = require('assert')
const childProcess = require('child_process')
const PassThrough = require('stream').PassThrough

// Exercise the real ShellJS async implementation without starting a Flow server
// or allowing any other subprocess to run.
const originals = {}
let pending = []
let commands = []
const processMethods = ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']
processMethods.forEach(function (name) {
  originals[name] = childProcess[name]
  childProcess[name] = function () {
    throw new Error('Unexpected child_process.' + name)
  }
})
childProcess.exec = function (command, options, callback) {
  assert.strictEqual(options.silent, true)
  assert.strictEqual(options.encoding, 'utf8')
  assert.strictEqual(options.async, true)
  assert.strictEqual(typeof callback, 'function')
  commands.push(command)
  pending.push(callback)
  return {stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough()}
}

const FlowStatusWebpackPlugin = require('.')
const tests = []

function test (name, run) {
  tests.push({name: name, run: run})
}

function compilerFor (options) {
  const callbacks = {}
  const hooks = {}
  ;['run', 'watchRun', 'compilation'].forEach(function (hook) {
    hooks[hook] = {}
    hooks[hook][hook === 'compilation' ? 'tap' : 'tapAsync'] = function (name, callback) {
      assert.strictEqual(name, 'flow-bin-status-webpack-plugin')
      assert.strictEqual(callbacks[hook], undefined)
      callbacks[hook] = callback
    }
  })
  const compiler = {hooks: hooks}
  const plugin = new FlowStatusWebpackPlugin(options)
  plugin.apply(compiler)
  assert.deepStrictEqual(Object.keys(callbacks).sort(), ['compilation', 'run', 'watchRun'])
  return {
    plugin: plugin,
    run: function (hook) {
      const completion = {calls: 0}
      callbacks[hook || 'run'](compiler, function () {
        assert.strictEqual(arguments.length, 0, 'Flow failures must not abort the webpack hook')
        completion.calls += 1
      })
      assert.strictEqual(completion.calls, 0, 'the hook must wait for the Flow result')
      return completion
    },
    compile: function () {
      const compilation = {errors: []}
      callbacks.compilation(compilation)
      return compilation.errors
    }
  }
}

function respond (error, stdout, stderr) {
  assert.strictEqual(pending.length, 1, 'exactly one async command should be pending')
  const callback = pending.shift()
  return new Promise(function (resolve, reject) {
    process.nextTick(function () {
      try {
        callback(error || null, stdout || '', stderr || '')
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
}

test('default first run stops, starts and checks Flow in order', function () {
  const compiler = compilerFor()
  assert.deepStrictEqual(compiler.plugin.options, {})
  const completion = compiler.run()
  assert.deepStrictEqual(commands, ['flow stop '])
  return respond().then(function () {
    assert.strictEqual(completion.calls, 0)
    assert.deepStrictEqual(commands, ['flow stop ', 'flow start  '])
    return respond()
  }).then(function () {
    assert.strictEqual(completion.calls, 0)
    assert.deepStrictEqual(commands, ['flow stop ', 'flow start  ', 'flow status --color always --quiet '])
    return respond(null, 'No errors!')
  }).then(function () {
    assert.strictEqual(completion.calls, 1)
    assert.deepStrictEqual(compiler.compile(), [])
    const repeat = compiler.run('watchRun')
    assert.strictEqual(commands.length, 4)
    assert.strictEqual(commands[3], 'flow status --color always --quiet ')
    return respond().then(function () {
      assert.strictEqual(repeat.calls, 1)
    })
  })
})

test('custom binary, root and start arguments survive ShellJS unchanged', function () {
  const compiler = compilerFor({binaryPath: '/tools/flow', root: '/project', flowArgs: '--lib /types'})
  const completion = compiler.run('watchRun')
  assert.deepStrictEqual(commands, ['/tools/flow stop /project'])
  // Stop/start results have historically not been treated as status failures.
  return respond({code: 2}, '', 'not running').then(function () {
    assert.strictEqual(commands[1], '/tools/flow start --lib /types /project')
    return respond({code: 3}, '', 'already running')
  }).then(function () {
    assert.strictEqual(commands[2], '/tools/flow status --color always --quiet /project')
    return respond()
  }).then(function () {
    assert.strictEqual(completion.calls, 1)
  })
})

test('restartFlow false skips startup and reports successful stdout once per hook', function () {
  const results = []
  const compiler = compilerFor({restartFlow: false, onSuccess: function (stdout) { results.push(stdout) }})
  const first = compiler.run('watchRun')
  assert.deepStrictEqual(commands, ['flow status --color always --quiet '])
  return respond(null, 'first result', 'warning').then(function () {
    assert.deepStrictEqual(results, ['first result'])
    assert.strictEqual(first.calls, 1)
    const second = compiler.run()
    assert.deepStrictEqual(commands, ['flow status --color always --quiet ', 'flow status --color always --quiet '])
    return respond(null, 'second result').then(function () {
      assert.deepStrictEqual(results, ['first result', 'second result'])
      assert.strictEqual(second.calls, 1)
    })
  })
})

;[
  {name: 'stdout', stdout: 'type mismatch', stderr: '', message: 'type mismatch'},
  {name: 'stderr', stdout: '', stderr: 'server failed', message: 'flow server: server failed'},
  {name: 'both streams', stdout: 'type mismatch', stderr: 'server failed', message: 'type mismatch\nflow server: server failed'},
  {name: 'empty output', stdout: '', stderr: '', message: 'flow server: Unknown error!'},
  {name: 'missing exit code', stdout: '', stderr: 'could not execute', message: 'flow server: could not execute', error: new Error('exec failed')}
].forEach(function (fixture) {
  test('status failure with ' + fixture.name + ' is reported and consumed by one compilation', function () {
    const errors = []
    const compiler = compilerFor({
      restartFlow: false,
      failOnError: true,
      onSuccess: function () { throw new Error('Unexpected success') },
      onError: function (message) { errors.push(message) }
    })
    const completion = compiler.run()
    return respond(fixture.error || {code: 2}, fixture.stdout, fixture.stderr).then(function () {
      assert.strictEqual(completion.calls, 1)
      assert.deepStrictEqual(errors, [fixture.message])
      const compilationErrors = compiler.compile()
      assert.strictEqual(compilationErrors.length, 1)
      assert(compilationErrors[0] instanceof Error)
      assert.strictEqual(compilationErrors[0].message, fixture.message)
      assert.deepStrictEqual(compiler.compile(), [])
    })
  })
})

test('failOnError defaults to false while onError still receives the failure', function () {
  const errors = []
  const compiler = compilerFor({restartFlow: false, onError: function (message) { errors.push(message) }})
  const completion = compiler.run()
  return respond({code: 1}, 'type mismatch').then(function () {
    assert.strictEqual(completion.calls, 1)
    assert.deepStrictEqual(errors, ['type mismatch'])
    assert.deepStrictEqual(compiler.compile(), [])
  })
})

test('a successful later build recovers after a compiled failure', function () {
  const compiler = compilerFor({restartFlow: false, failOnError: true})
  const first = compiler.run()
  return respond({code: 2}, 'type mismatch').then(function () {
    assert.strictEqual(first.calls, 1)
    assert.strictEqual(compiler.compile().length, 1)
    const second = compiler.run('watchRun')
    return respond(null, 'fixed').then(function () {
      assert.strictEqual(second.calls, 1)
      assert.deepStrictEqual(compiler.compile(), [])
    })
  })
})

function restore () {
  processMethods.forEach(function (name) { childProcess[name] = originals[name] })
}

tests.reduce(function (previous, fixture) {
  return previous.then(function () {
    commands = []
    pending = []
    return fixture.run()
  }).then(function () {
    assert.strictEqual(pending.length, 0, 'all commands must complete')
    console.log('ok - ' + fixture.name)
  })
}, Promise.resolve()).then(function () {
  restore()
  console.log(tests.length + ' tests passed')
}, function (error) {
  restore()
  console.error(error.stack)
  process.exitCode = 1
})
