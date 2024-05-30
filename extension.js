const vscode = require('vscode')
const exec = require('child_process').exec
const fs = require('fs')

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
	}, 100)
}

const addSpentTime = async (commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl) => {
	const branch = repoBranch.split('>')[1].trim()
	const jiraId = /\(([^)]*)\)/.exec(commitMessage)[1]
	const value = await vscode.window.showInputBox({ prompt: 'Enter the time spent on the task in hours' })
	let timeSpent = parseFloat(value)
	if (isNaN(timeSpent) || timeSpent <= 0) {
		vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
		addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
	} else {
		try {
			await execShell(`curl --location 'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o' \
      --header 'Content-Type: application/json' \
      --data '{
          "commit-id": "${commitId}",
          "author-name": "${author}",
          "commit-timestamp": "${commitTimestamp}",
          "work-item-id": "${jiraId}",
          "repository-url": "${repoUrl}",
          "spent-hours": "${timeSpent}",
          "commit-message": "${commitMessage}",
          "repo-branch": "${branch}"
      }'`)
			execShell(`rm -rf ${projectPath}/.shacommit`)
			vscode.window.showInformationMessage('Time spent successfully logged!')
		} catch (error) {
			vscode.window.showErrorMessage(error)
		}
		return true
	}
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		const output = await execShell(`cd ${projectPath} && git log -1 --pretty=format:"%H,%an,%cd,%s,%D"`)
		let [commitId, author, commitTimestamp, commitMessage, repoBranch] = output.split(',')
		let repoUrl = await execShell(`cd ${projectPath} && git config --get remote.origin.url`)
		// Validate the input
		fs.watchFile(`${projectPath}/.shacommit`, async (evt, filename) => {
			const sha = fs.readFileSync(`${projectPath}/.shacommit`, 'utf8').toString().trim()
			let newSha = await execShell(`cd ${projectPath} && git rev-parse HEAD`)
			newSha = newSha.trim()
			if (newSha.trim() !== sha) {
				if (debounceFsWatch()) return
				if (filename) {
					addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
				}
			} else {
				vscode.window.showWarningMessage('Please commit your changes before logging time')
			}
		})
	})

	context.subscriptions.push(disposable)
}
