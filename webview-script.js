// webview-script.js
;(function () {
	const vscode = acquireVsCodeApi()

	window.cancelForm = function () {
		vscode.postMessage({ command: 'cancel' })
	}

	window.submitForm = function (type) {
		const hours = document.getElementById('hours').value
		const workItem = document.getElementById('work-item').value
		const rating = document.querySelector('input[name="rating"]:checked')
			? document.querySelector('input[name="rating"]:checked').value
			: 0
		const commitId = document.getElementById('commit-id').value
		const commitTimestamp = document.getElementById('commit-timestamp').value
		const repoUrl = document.getElementById('repo-url').value
		const commitMessage = document.getElementById('commit-message').innerText
		const repoBranch = document.getElementById('repo-branch').value
		const projectPath = document.getElementById('project').value

		vscode.postMessage({
			command: type,
			data: { hours, workItem, rating, commitId, commitTimestamp, repoUrl, commitMessage, repoBranch, projectPath },
		})
	}

	window.addEventListener('DOMContentLoaded', function () {
		const projectSelect = document.getElementById('project')
		if (projectSelect && !projectSelect.disabled) {
			projectSelect.addEventListener('change', function () {
				const selectedPath = projectSelect.value
				vscode.postMessage({ command: 'projectChanged', data: { projectPath: selectedPath } })
			})
		}
	})

	window.addEventListener('message', event => {
		const message = event.data
		if (message.command === 'updateProjectInfo') {
			// Update branch and commit message in the UI
			document.querySelector('.static-info').innerText = message.repoBranch
			// Find the commit message paragraph (second .static-info)
			const staticInfos = document.querySelectorAll('.static-info')
			if (staticInfos.length > 1) {
				staticInfos[1].innerText = message.commitMessage
			}
			// Also update hidden fields if needed
			document.getElementById('commit-id').value = message.commitId
			document.getElementById('commit-timestamp').value = message.formattedDate
			document.getElementById('repo-url').value = message.url
		}
	})
})()
