const axios = require('axios')

const TRACK_URL =
	'https://defaultb00367e2193a4f4894de7245d45c09.47.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Ctu5IB1uaHYMXJ6TTYPaRYdeGISpvOqb7A3PfH5bBIg'

async function addSpentTime({
	commitId,
	author,
	commitTimestamp,
	task,
	timeSpent,
	commitMessage,
	repoBranch,
	repoUrl,
	rating,
	pluginVersion,
}) {
	try {
		await axios.post(
			TRACK_URL,
			{
				'commit-id': `${commitId}`,
				'author-name': `${author}`,
				'commit-timestamp': `${commitTimestamp}`,
				'work-item-id': `${task}`,
				'repository-url': `${repoUrl}`,
				'spent-hours': `${Number(timeSpent)}`,
				'commit-message': `${commitMessage}`,
				'repo-branch': `${repoBranch}`,
				'ai-tools-rating': `${rating}`,
				metadata: {
					'tracking-method': 'ide-plugin',
					'plugin-name': 'spenttime',
					'plugin-version': `${pluginVersion}`,
				},
			},
			{
				headers: { 'Content-Type': 'application/json' },
				timeout: 10000,
			}
		)
		return true
	} catch (err) {
		// Normalize axios/network errors to a concise message for the UI
		if (err && err.response) {
			const status = err.response.status
			const statusText = err.response.statusText || 'Request failed'
			let detail = ''
			try {
				const data = err.response.data
				if (typeof data === 'string') detail = ` - ${data.substring(0, 200)}`
				else if (data && typeof data === 'object') detail = ` - ${JSON.stringify(data).substring(0, 200)}`
			} catch (_) {
				// Ignore JSON parsing errors - detail will remain empty
			}
			throw new Error(`Tracking failed (${status} ${statusText})${detail}`)
		}
		if (err && (err.code === 'ECONNABORTED' || /timeout/i.test(String(err.message)))) {
			throw new Error('Tracking request timed out. Please check your connection to Azure and try again.')
		}
		throw new Error(`Tracking failed: ${String(err && err.message ? err.message : err)}`)
	}
}

module.exports = { addSpentTime }
