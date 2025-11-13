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

		// Focus first actionable input
		const workItemInput = document.getElementById('work-item')
		if (workItemInput) {
			workItemInput.focus()
			// Inline validity feedback
			workItemInput.addEventListener('input', function () {
				if (this.validity.patternMismatch) {
					this.setCustomValidity('Expected format like PRJ-1234')
				} else {
					this.setCustomValidity('')
				}
			})
		}

		// Submit on Enter
		const form = document.getElementById('form')
		if (form) {
			form.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
					e.preventDefault()
					submitForm('validate')
				}
			})
		}

		// Enable toggling off rating (uncheck all stars)
		const ratingContainer = document.querySelector('.star-rating')
		if (ratingContainer) {
			// Toggle off when clicking the already selected label
			ratingContainer.querySelectorAll('label').forEach(label => {
				label.addEventListener('mousedown', e => {
					const forId = label.getAttribute('for')
					const input = forId ? document.getElementById(forId) : null
					label.dataset.toggleOff = input && input.checked ? '1' : ''
				})
				label.addEventListener('click', e => {
					const forId = label.getAttribute('for')
					const input = forId ? document.getElementById(forId) : null
					if (label.dataset.toggleOff === '1' && input) {
						e.preventDefault()
						input.checked = false
						label.dataset.toggleOff = ''
						input.dispatchEvent(new Event('change', { bubbles: true }))
					}
				})
			})

			// Also support toggling off when clicking directly on the input
			ratingContainer.querySelectorAll('input[type="radio"]').forEach(input => {
				input.addEventListener('mousedown', function () {
					this.dataset.wasChecked = this.checked ? '1' : ''
				})
				input.addEventListener('click', function (e) {
					if (this.dataset.wasChecked === '1') {
						e.preventDefault()
						this.checked = false
						this.dataset.wasChecked = ''
						this.dispatchEvent(new Event('change', { bubbles: true }))
					}
				})
			})
			// Clear link support
			const clearBtn = document.getElementById('clear-rating')
			if (clearBtn) {
				clearBtn.addEventListener('click', function () {
					const checked = ratingContainer.querySelector('input[type="radio"]:checked')
					if (checked) {
						checked.checked = false
						checked.dispatchEvent(new Event('change', { bubbles: true }))
					}
				})
			}
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
