'use strict'

const PRIORITY = { HIGH: 0, LOW: 1 }

/**
 * Two-priority outbound command queue with a minimum send interval.
 *
 * Commands at PRIORITY.HIGH are always dequeued before PRIORITY.LOW commands.
 * Within the same priority, commands are dispatched in FIFO order.
 *
 * The minimum interval between successive sends is enforced using wall-clock
 * timestamps (Date.now()) rather than assuming timer callbacks fire exactly on
 * schedule, so backpressure from a delayed event loop does not cause bunched
 * sends.
 *
 * @param {function(string): void} sendFn  Called with the formatted command string when it is time to send.
 * @param {{ minIntervalMs?: number }} [opts]
 */
function CommandQueue(sendFn, opts) {
	const minIntervalMs = (opts && opts.minIntervalMs) !== undefined ? opts.minIntervalMs : 20

	this._high = []
	this._low = []
	this._sendFn = sendFn
	this._minIntervalMs = minIntervalMs
	this._lastSentAt = 0
	this._timer = null
}

/**
 * Add a command to the queue.
 *
 * @param {string}  cmd       Fully-formatted command string (including trailing '\n').
 * @param {number}  priority  PRIORITY.HIGH or PRIORITY.LOW.
 */
CommandQueue.prototype.enqueue = function (cmd, priority) {
	if (priority === PRIORITY.HIGH) {
		this._high.push(cmd)
	} else {
		this._low.push(cmd)
	}
	this._schedule()
}

/**
 * Discard all queued commands and cancel any pending drain timer.
 * Call this when a new connection is established to avoid replaying
 * stale commands from a previous session.
 */
CommandQueue.prototype.clear = function () {
	this._high = []
	this._low = []
	if (this._timer !== null) {
		clearTimeout(this._timer)
		this._timer = null
	}
}

CommandQueue.prototype._schedule = function () {
	if (this._timer !== null) return
	if (this._high.length === 0 && this._low.length === 0) return

	const elapsed = Date.now() - this._lastSentAt
	const delay = elapsed >= this._minIntervalMs ? 0 : this._minIntervalMs - elapsed

	this._timer = setTimeout(() => {
		this._timer = null
		this._flush()
	}, delay)
}

CommandQueue.prototype._flush = function () {
	const cmd = this._high.length > 0 ? this._high.shift() : this._low.shift()
	if (cmd === undefined) return

	this._lastSentAt = Date.now()
	this._sendFn(cmd)
	this._schedule()
}

module.exports = { CommandQueue, PRIORITY }
