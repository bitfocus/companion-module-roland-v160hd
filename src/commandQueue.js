'use strict'

const PRIORITY = { HIGH: 0, LOW: 1 }

/**
 * Two-priority outbound command queue with a per-priority send interval.
 *
 * Commands at PRIORITY.HIGH (Roland Data Set / DTH writes) are always
 * dequeued before PRIORITY.LOW commands (RQH reads).  Within the same
 * priority, commands are dispatched in FIFO order.
 *
 * The minimum interval (`minIntervalMs`, default 20) applies only to
 * consecutive HIGH / DTH sends and is enforced using wall-clock timestamps
 * (Date.now()) so backpressure from a delayed event loop does not cause
 * bunched writes.  LOW / RQH commands are not subject to this interval and
 * drain as fast as the event loop allows.
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
	this._lastHighSentAt = 0
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
		// A HIGH command may arrive while a LOW-only timer is pending.  Cancel
		// it and reschedule so the HIGH rate-limit delay is applied correctly.
		if (this._timer !== null) {
			clearTimeout(this._timer)
			this._timer = null
		}
	} else {
		this._low.push(cmd)
	}
	this._schedule()
}

/**
 * Discard all queued commands, cancel any pending drain timer, and reset
 * the HIGH rate-limit timestamp.  Call this whenever a connection is
 * replaced so stale commands and inherited DTH timing state do not carry
 * over to the new session.
 */
CommandQueue.prototype.clear = function () {
	this._high = []
	this._low = []
	this._lastHighSentAt = 0
	if (this._timer !== null) {
		clearTimeout(this._timer)
		this._timer = null
	}
}

CommandQueue.prototype._schedule = function () {
	if (this._timer !== null) return
	if (this._high.length === 0 && this._low.length === 0) return

	let delay
	if (this._high.length > 0) {
		const elapsed = Date.now() - this._lastHighSentAt
		delay = elapsed >= this._minIntervalMs ? 0 : this._minIntervalMs - elapsed
	} else {
		// LOW commands are not subject to the HIGH rate limit, but using a
		// 1 ms minimum avoids scheduling a timer at the exact current tick
		// boundary, which can cause multiple LOW drains within one tick() call.
		delay = 1
	}

	this._timer = setTimeout(() => {
		this._timer = null
		this._flush()
	}, delay)
}

CommandQueue.prototype._flush = function () {
	const isHigh = this._high.length > 0
	const cmd = isHigh ? this._high.shift() : this._low.shift()
	if (cmd === undefined) return

	if (isHigh) {
		this._lastHighSentAt = Date.now()
	}
	this._sendFn(cmd)
	this._schedule()
}

module.exports = { CommandQueue, PRIORITY }
