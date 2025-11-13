const crypto = require('crypto')

const KEY = 'trackedCommits.v1'

function repoKey(repoUrl) {
	// Stable key from sanitized URL
	const url = String(repoUrl || '').trim()
	return crypto.createHash('sha1').update(url).digest('hex')
}

function getAll(context) {
	return context.globalState.get(KEY, {})
}

function hasTrackedCommit(context, repoUrl, commitId) {
	const all = getAll(context)
	const rk = repoKey(repoUrl)
	const repo = all[rk] || {}
	return Boolean(repo[commitId])
}

async function markCommitTracked(context, repoUrl, commitId, meta) {
	const all = getAll(context)
	const rk = repoKey(repoUrl)
	const repo = all[rk] || {}
	repo[commitId] = { ...meta, at: Date.now() }
	all[rk] = repo
	await context.globalState.update(KEY, all)
}

module.exports = { hasTrackedCommit, markCommitTracked }
