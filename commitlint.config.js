/**
 ** Copyright (c) 2019-present, NEXI Digital.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = {
	extends: ['@commitlint/config-conventional'],
	plugins: [
		{
			rules: {
				'jira-commit-scope': parsed => {
					const regex = /[A-Z]-\d+/
					const isValid = regex.test(parsed.scope)
					return [isValid, `scope should be a JIRA task key (e.g., 'JIRA-123')`]
				},
			},
		},
	],
	parserPreset: 'conventional-changelog-conventionalcommits',
	formatter: '@commitlint/format',
	rules: {
		'jira-commit-scope': [2, 'always'],
		'body-leading-blank': [0],
		'body-max-line-length': [2, 'always', 100],
		'footer-max-line-length': [2, 'always', 100],
		'header-max-length': [2, 'never', 72],
		'footer-min-length': [2, 'never', 5],
		'footer-max-length': [2, 'never', 30],
		'scope-case': [2, 'always', ['snake-case', 'kebab-case', 'pascal-case', 'upper-case']],
		'scope-empty': [2, 'never'],
		'scope-min-length': [2, 'always', 5],
		'scope-max-length': [2, 'always', 15],
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'subject-max-length': [2, 'always', 57],
		'type-case': [2, 'always', 'lower-case'],
		'type-empty': [2, 'never'],
		'type-enum': [
			2,
			'always',
			['task', 'build', 'chore', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
		],
	},
	prompt: {
		messages: {
			skip: ':skip',
			max: 'upper %d chars',
			min: '%d chars at least',
			emptyWarning: 'can not be empty',
			upperLimitWarning: 'over limit',
			lowerLimitWarning: 'below limit',
		},
		questions: {
			type: {
				description: 'Select the type of change that you"re committing',
				enum: {
					task: {
						description: 'A simple commit that mentions the jira US your worked on. (e.g. IB-1010)',
						title: 'Task',
						emoji: '🔨',
					},
					feat: {
						description: 'A new feature',
						title: 'Features',
						emoji: '✨',
					},
					fix: {
						description: 'A bug fix',
						title: 'Bug Fixes',
						emoji: '🐛',
					},
					docs: {
						description: 'Documentation only changes',
						title: 'Documentation',
						emoji: '📝',
					},
					style: {
						description:
							'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
						title: 'Styles',
						emoji: '🎨',
					},
					refactor: {
						description: 'A code change that neither fixes a bug nor adds a feature',
						title: 'Code Refactoring',
						emoji: '♻️',
					},
					perf: {
						description: 'A code change that improves performance',
						title: 'Performance Improvements',
						emoji: '🚀',
					},
					test: {
						description: 'Adding missing tests or correcting existing tests',
						title: 'Tests',
						emoji: '🧪',
					},
					build: {
						description:
							'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)',
						title: 'Builds',
						emoji: '🛠',
					},
					ci: {
						description:
							'Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)',
						title: 'Continuous Integrations',
						emoji: '👷',
					},
					chore: {
						description: 'Other changes that don"t modify src or test files',
						title: 'Chores',
						emoji: '♻️',
					},
					revert: {
						description: 'Reverts a previous commit',
						title: 'Reverts',
						emoji: '⏪️',
					},
				},
			},
			scope: {
				description: 'What is the scope of this change (Ensure to insert the jira task)',
			},
			subject: {
				description: 'Write a short, imperative tense description of the change',
			},
			body: {
				description: 'Provide a longer description of the change',
			},
			isBreaking: {
				description: 'Are there any breaking changes?',
			},
			breakingBody: {
				description: 'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself',
			},
			breaking: {
				description: 'Describe the breaking changes',
			},
			isIssueAffected: {
				description: 'Does this change affect any open issues?',
			},
			issuesBody: {
				description:
					'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself',
			},
			issues: {
				description: "Add issue references (e.g. 'fix #123', 're #123'.)",
			},
			footer: {
				description: 'How many minutes did it take to complete this task',
			},
		},
	},
}
