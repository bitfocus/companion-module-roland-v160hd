'use strict'

/**
 * Auth prompts sent by the V-160HD at connection time.
 * These have no reliable terminator (no ';' or '\n'), so they are matched
 * by substring presence rather than by delimiter scanning.
 */
const AUTH_PROMPTS = ['Enter password:', 'Welcome to V-160HD.']

/**
 * Extract all complete messages from `buffer` and return them together with
 * whatever incomplete tail should be kept for the next TCP chunk.
 *
 * Delimiters are consumed in occurrence order (earliest first) so interleaved
 * message types are dispatched correctly:
 *   - Semicolon (';')           — DTH / RQH protocol responses
 *   - Newline ('\n')            — VER responses and similar lines
 *   - Auth prompt substring     — 'Enter password:' / 'Welcome to V-160HD.'
 *     (no terminator; matched as a substring at the current scan position)
 *
 * The delimiter itself is NOT included in the returned message string.
 * Every extracted message is trimmed. Empty strings are not included.
 * Any incomplete trailing content is returned as `remaining`.
 *
 * @param {string} buffer  Current accumulated TCP receive buffer.
 * @returns {{ messages: string[], remaining: string }}
 */
function extractMessages(buffer) {
	const messages = []
	let pos = 0

	while (pos < buffer.length) {
		// Find the earliest delimiter starting at or after pos.
		let best = { idx: Infinity, delimLen: 0, isAuth: false, authStr: '' }

		const semi = buffer.indexOf(';', pos)
		if (semi !== -1 && semi < best.idx) {
			best = { idx: semi, delimLen: 1, isAuth: false, authStr: '' }
		}

		const nl = buffer.indexOf('\n', pos)
		if (nl !== -1 && nl < best.idx) {
			best = { idx: nl, delimLen: 1, isAuth: false, authStr: '' }
		}

		for (const prompt of AUTH_PROMPTS) {
			const idx = buffer.indexOf(prompt, pos)
			if (idx !== -1 && idx < best.idx) {
				best = { idx, delimLen: prompt.length, isAuth: true, authStr: prompt }
			}
		}

		if (best.idx === Infinity) {
			// No complete delimiter found — keep the rest for the next chunk.
			break
		}

		if (best.isAuth) {
			// Auth prompt: any content between pos and the prompt start has no
			// terminator and is discarded (partial / junk data).
			messages.push(best.authStr)
		} else {
			const msg = buffer.slice(pos, best.idx).trim()
			if (msg) messages.push(msg)
		}

		pos = best.idx + best.delimLen
	}

	return { messages, remaining: buffer.slice(pos) }
}

module.exports = { extractMessages, AUTH_PROMPTS }
