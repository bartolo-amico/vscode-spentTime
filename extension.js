const vscode = require('vscode')
const exec = require('child_process').exec
const os = require('os')
const axios = require('axios')

let task, value, timeSpent

const projectPath = vscode.workspace.workspaceFolders[0].uri.path
module.exports = {
	activate,
}

const execShell = cmd =>
	new Promise(resolve => {
		exec(cmd, (err, out) => {
			if (err) {
				return resolve(err + ' error!')
			}
			return resolve(out)
		})
	})

let fsWait = false

function debounceFsWatch() {
	if (fsWait) return true
	setTimeout(() => {
		fsWait = false
	}, 300)
}

const addJiraTask = async () => {
	task = await vscode.window.showInputBox({ prompt: 'Enter the jira task you have completed' })
}

const addTime = async () => {
	if (!isNaN(timeSpent) || timeSpent > 0) return
	value = await vscode.window.showInputBox({ prompt: 'Enter the time spent on the task in hours' })
	timeSpent = parseFloat(value)
}

const addSpentTime = async (commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl) => {
	const branch = repoBranch.trim()
	await addTime()
	if (isNaN(timeSpent) || timeSpent <= 0) {
		vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
		if (value === undefined) {
			return
		}
		addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
	} else {
		await addJiraTask()
		if (/\w+-\d+/g.test(task) === false) {
			vscode.window.showErrorMessage('Invalid input. Please enter a valid task. ie (JIRA-000)')
			if (task === undefined) {
				return
			}
			addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
		} else {
			try {
				const OS = os.platform()
				if (OS !== `win32`) {
					await execShell(`curl --location 'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o' \
						--header 'Content-Type: application/json' \
						--data '{
								"commit-id": "${commitId}",
								"author-name": "${author}",
								"commit-timestamp": "${commitTimestamp}",
								"work-item-id": "${task}",
								"repository-url": "${repoUrl}",
								"spent-hours": "${timeSpent}",
								"commit-message": "${commitMessage}",
								"repo-branch": "${branch}"
						}'`)
				} else {
					await axios.post(
						'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track',
						{
							'commit-id': `${commitId}`,
							'author-name': `${author}`,
							'commit-timestamp': `${commitTimestamp}`,
							'work-item-id': `${task}`,
							'repository-url': `${repoUrl}`,
							'spent-hours': `${timeSpent}`,
							'commit-message': `${commitMessage}`,
							'repo-branch': `${branch}`,
						},
						{
							params: {
								'api-version': '2016-06-01',
								sp: '/triggers/manual/run',
								sv: '1.0',
								sig: 'YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o',
							},
							headers: {
								'Content-Type': 'application/json',
							},
						}
					)
				}
				vscode.window.showInformationMessage('Time spent successfully logged!')
			} catch (error) {
				console.log(error)
				vscode.window.showErrorMessage(error)
			}
			return true
		}
	}
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		const repoBranch = await execShell(`cd ${projectPath} & git branch --show-current`)
		const output = await execShell(`cd ${projectPath} && git log -1 --pretty=format:"%H,%an,%cd,%s"`)
		let [commitId, author, commitTimestamp, commitMessage] = output.split(',')
		let repoUrl = await execShell(`cd ${projectPath} && git config --get remote.origin.url`)
		// Check and remove username from repoUrl
		const regex = /https:\/\/[^@]+@/
		if (regex.test(repoUrl)) {
			repoUrl = repoUrl.replace(/https:\/\/[^@]+@/, 'https://')
		}

		addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
	})
	context.subscriptions.push(disposable)
}
