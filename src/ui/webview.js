const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const ejs = require('ejs')

function getWebviewContent(author, commitMessage, repoBranch, panel, commitId, formattedDate, url, projects) {
	const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview-script.js')))
	const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview-style.css')))
	const templatePath = path.join(__dirname, 'webview-template.ejs')
	const template = fs.readFileSync(templatePath, 'utf8')
	return ejs.render(template, {
		author,
		commitMessage,
		repoBranch,
		commitId,
		formattedDate,
		url,
		scriptUri,
		styleUri,
		projects,
	})
}

module.exports = { getWebviewContent }
