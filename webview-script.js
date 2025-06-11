// webview-script.js
;(function () {
	const vscode = acquireVsCodeApi()

	window.cancelForm = function () {
		vscode.postMessage({ command: 'cancel' })
	}

	window.submitForm = function (type) {
		const form = document.getElementById('form')
		const hours = document.getElementById('hours').value
		const workItem = document.getElementById('work-item').value
		const rating = document.querySelector('input[name="rating"]:checked')
			? document.querySelector('input[name="rating"]:checked').value
			: 0
		const commitId = document.getElementById('commit-id').value
		const commitTimestamp = document.getElementById('commit-timestamp').value
		const repoUrl = document.getElementById('repo-url').value

		vscode.postMessage({ command: type, data: { hours, workItem, rating, commitId, commitTimestamp, repoUrl } })
	}
})()
