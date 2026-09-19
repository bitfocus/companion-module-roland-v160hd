'use strict'

// Shared harness for connection-lifecycle regression tests.
//
// Loads the REAL, installed @companion-module/base TCPHelper (this
// checkout's own node_modules, resolved at runtime — never hardcoded) via
// `vm`, backed by an in-memory fake `net.Socket` and deterministic virtual
// time, then loads the REAL src/commandQueue.js, src/api.js and index.js on
// top of it. This exercises TCPHelper's actual semantics — its
// isConnected/isDestroyed getters, its own internal reconnect scheduling on
// error/end, and its send() rejection behavior — rather than a hand-rolled
// stub. A stub that "helpfully" reset isConnected on destroy(), for example,
// would hide the exact teardown bug this suite exists to catch: see
// node_modules/@companion-module/base/dist/helpers/tcp.js destroy(), which
// deliberately does NOT touch #connected.
//
// No network or device I/O occurs anywhere in this file: FakeNetSocket never
// opens a real socket, and every connect/error/end outcome is driven
// explicitly by the test via emitting events on it.

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')
const { createRequire } = require('node:module')

const REPO_ROOT = path.resolve(__dirname, '..')
const TCP_HELPER_PATH = require.resolve('@companion-module/base/dist/helpers/tcp.js')
const baseRequire = createRequire(TCP_HELPER_PATH)

function makeClock() {
	let now = 1000
	let nextId = 0
	const scheduled = new Map()

	function schedule(fn, delay, repeat) {
		const id = ++nextId
		scheduled.set(id, { fn, at: now + (delay || 0), repeat })
		return id
	}

	const timerGlobals = {
		setTimeout: (fn, delay) => schedule(fn, delay),
		clearTimeout: (id) => scheduled.delete(id),
		setInterval: (fn, delay) => schedule(fn, delay, delay),
		clearInterval: (id) => scheduled.delete(id),
		setImmediate: (fn) => schedule(fn, 0),
		clearImmediate: (id) => scheduled.delete(id),
		Date: class extends Date {
			static now() {
				return now
			}
		},
	}

	// Advances virtual time by `ms`, running every timer/interval callback
	// due at or before the new time, in due-time order. Intervals re-arm.
	function advance(ms) {
		const until = now + (ms || 0)
		for (;;) {
			let nextEntry = null
			for (const entry of scheduled.entries()) {
				if (entry[1].at > until) continue
				if (!nextEntry || entry[1].at < nextEntry[1].at) nextEntry = entry
			}
			if (!nextEntry) break
			const [id, item] = nextEntry
			now = item.at
			scheduled.delete(id)
			if (item.repeat) scheduled.set(id, { ...item, at: now + item.repeat })
			item.fn()
		}
		now = until
	}

	return {
		timerGlobals,
		advance,
		get now() {
			return now
		},
		get pendingCount() {
			return scheduled.size
		},
	}
}

// Faithful fake of the underlying net.Socket surface TCPHelper touches:
// setKeepAlive, setNoDelay, connect, write(msg, cb), destroy, plus the
// 'error'/'ready'/'end'/'data'/'drain' events TCPHelper itself listens for
// (fired explicitly by tests, never automatically).
//
// connect() records each call (with the virtual-clock time it happened at,
// via _nowFn — wired up in createEnvironment) rather than auto-succeeding.
// This makes "did production code actually attempt a reconnect, and when"
// an observable, assertable fact instead of something a test can only
// assume by firing 'ready' unconditionally — a real reconnect-ownership
// regression (e.g. `reconnect: false`) would otherwise still let every
// lifecycle test pass, since nothing was checking that a retry was really
// requested. simulateReady/simulateError in this file only act on the
// *latest* connectAttempts entry, so firing them without a preceding
// attempt is itself something a test can detect and fail on.
class FakeNetSocket extends EventEmitter {
	constructor() {
		super()
		this.destroyed = false
		this.sent = []
		this.connectAttempts = []
		this._nowFn = () => undefined
	}
	setKeepAlive() {}
	setNoDelay() {}
	connect() {
		this.connectAttempts.push(this._nowFn())
	}
	write(message, cb) {
		if (this.destroyed) {
			if (cb) cb(new Error('This socket has been ended by the other party'))
			return false
		}
		this.sent.push(message)
		if (cb) cb(null)
		return true
	}
	destroy() {
		this.destroyed = true
	}
}

function loadInVm(file, requireFn, extraGlobals) {
	const moduleObj = { exports: {} }
	const context = vm.createContext({
		module: moduleObj,
		exports: moduleObj.exports,
		require: requireFn,
		console,
		process,
		...extraGlobals,
	})
	vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file })
	return moduleObj.exports
}

/**
 * Build one isolated module instance wired to the real TCPHelper, a fake
 * net.Socket per TCPHelper instance, and deterministic virtual time.
 *
 * Returns:
 *   self       - the live v160Instance, with initConnection/handleError/
 *                _safeSend/updateData/destroy/etc. from the real src/api.js
 *                and index.js (action/feedback/variable/preset/constants
 *                modules are not loaded — irrelevant to lifecycle behaviour
 *                and not exercised by these tests).
 *   statuses   - every self.updateStatus(status, message) call, in order.
 *   logs       - every self.log(level, message) call, in order.
 *   sockets    - every FakeNetSocket created, in creation order.
 *   helpers    - every TCPHelper instance created, in creation order.
 *   advance(ms)- deterministically advance virtual time, running due timers.
 *   pendingTimers() - count of still-scheduled timers (interval/timeout).
 */
function createEnvironment(overrides) {
	const clock = makeClock()
	const sockets = []
	const helpers = []

	const netModule = {
		Socket: class extends FakeNetSocket {
			constructor() {
				super()
				this._nowFn = () => clock.now
				sockets.push(this)
			}
		},
	}

	const { TCPHelper: RealTCPHelper } = loadInVm(
		TCP_HELPER_PATH,
		(name) => (name === 'net' ? netModule : name === 'eventemitter3' ? { EventEmitter } : baseRequire(name)),
		clock.timerGlobals,
	)

	class TrackedTCPHelper extends RealTCPHelper {
		constructor(...args) {
			super(...args)
			helpers.push(this)
		}
	}

	let CapturedInstance
	const base = {
		TCPHelper: TrackedTCPHelper,
		InstanceStatus: {
			Ok: 'ok',
			Connecting: 'connecting',
			ConnectionFailure: 'connection_failure',
			Disconnected: 'disconnected',
			UnknownError: 'unknown_error',
		},
		InstanceBase: class {},
		Regex: {},
		runEntrypoint: (cls) => {
			CapturedInstance = cls
		},
	}

	const queueModule = loadInVm(path.join(REPO_ROOT, 'src/commandQueue.js'), require, clock.timerGlobals)
	const apiModule = loadInVm(
		path.join(REPO_ROOT, 'src/api.js'),
		(name) => {
			if (name === '@companion-module/base') return base
			if (name === './commandQueue') return queueModule
			return require(path.join(REPO_ROOT, 'src', name))
		},
		clock.timerGlobals,
	)
	loadInVm(
		path.join(REPO_ROOT, 'index.js'),
		(name) => {
			if (name === '@companion-module/base') return base
			if (name === './src/api') return apiModule
			// action/feedback/variable/preset/constants/upgrades modules:
			// irrelevant to connection lifecycle, intentionally not loaded.
			return {}
		},
		clock.timerGlobals,
	)

	const self = new CapturedInstance()
	const statuses = []
	const logs = []
	Object.assign(self, {
		config: { host: 'memory-only', port: 8023, polling: false, password: 'S3cret-Passw0rd', verbose: false },
		log: (level, msg) => logs.push({ level, msg: String(msg) }),
		updateStatus: (status, message) => statuses.push({ status, message }),
		checkFeedbacks: () => {},
		checkVariables: () => {},
	})
	if (overrides) Object.assign(self.config, overrides)

	return {
		self,
		statuses,
		logs,
		sockets,
		helpers,
		advance: clock.advance,
		pendingTimers: () => clock.pendingCount,
	}
}

/**
 * Simulate a successful TCP-level connect for the given TCPHelper instance.
 * Throws if production code never actually called connect() on this
 * socket — i.e. refuses to simulate success for an attempt that was never
 * really made, which is exactly what let a disabled-reconnect regression
 * go unnoticed before this check existed.
 */
function simulateReady(helper) {
	if (helper._socket.connectAttempts.length === 0) {
		throw new Error('simulateReady: no connect() attempt was recorded on this socket — nothing to simulate succeeding')
	}
	helper._socket.emit('ready')
}

/** Simulate a socket error with the given code (or a plain Error if code is omitted). */
function simulateError(helper, code, message) {
	const err = new Error(message || code || 'socket error')
	if (code) err.code = code
	helper._socket.emit('error', err)
}

/** Simulate the device closing the connection gracefully. */
function simulateEnd(helper) {
	helper._socket.emit('end')
}

/** Drive a full successful connect + Roland auth handshake on the current socket. */
function authenticate(env) {
	const helper = env.helpers[env.helpers.length - 1]
	simulateReady(helper)
	env.self.updateData('Enter password:')
	env.self.updateData('Welcome to V-160HD.')
}

module.exports = { createEnvironment, simulateReady, simulateError, simulateEnd, authenticate, FakeNetSocket }
