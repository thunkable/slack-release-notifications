# Slack Release Notifications GitHub Action

This GitHub Action sends notifications to a Slack channel whenever a pull request event occurs. The supported pull request events are opened, synchronize and closed. You can choose to use this action for any combination of these events depending on your needs.

## Features

1. **Initial Commit List Notification**: When a pull request is created (opened), the action sends a message to a designated Slack channel with the PR details:

   - **Message**:
     ```
     New release pull request created: "PR title"
     Branch: source_branch -> target_branch
     ```
   - Additionally, a thread is created with a list of commits related to the PR:
     ```
     Commits in this pull request:
     - commit1 by @SlackUser1
     - commit2 by @commit.author
     ```
   - If `github-to-slack-map` is provided, the action will use the Slack user instead of GitHub usernames to tag users in Slack messages.

2. **Slack Message Timestamp in PR Description**: The action updates the PR description to include the Slack message timestamp (`Slack message_ts`). This allows the timestamp to be retrieved later for sending follow-up messages in the same Slack thread when new commits are pushed to the branch.

3. **New Commits Notification**: When a pull request is updated (synchronized), the action retrieves the Slack message timestamp from the PR body (description) and sends a message with the last commit added to the PR using the GitHub username of the commit author:

   - **Message**:
     ```
     New commit added: last commit by @githubUser
     ```

4. **PR Merged Notification**: When a pull request is merged (closed), the action fetches the Slack message timestamp and sends a notification to the same Slack thread, informing the team that the PR has been merged using the GitHub username of the user who merged the PR:
   - **Message**:
     ```
     Pull request "PR title" was merged by @githubUser
     ```

## Inputs

| Input                        | Required | Description                                                                                                                                                                                                                                | Default Value                                                                                                                 |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| slack-bot-token              | required | The Slack bot token.                                                                                                                                                                                                                       | N/A                                                                                                                           |
| slack-channel                | required | The Slack channel ID where the notifications will be sent.                                                                                                                                                                                 | N/A                                                                                                                           |
| github-token                 | required | The GitHub token (typically `${{ secrets.GITHUB_TOKEN }}`).                                                                                                                                                                                | N/A                                                                                                                           |
| github-to-slack-map          | optional | A JSON string mapping GitHub usernames to Slack user IDs for tagging in messages. If not provided, GitHub usernames will be used in the Slack messages. Example: `{"githubUsername1": "slackUserID1", "githubUsername2": "slackUserID2"}`. | N/A                                                                                                                           |
| initial-message-template     | optional | Template for the initial message when a PR is created.                                                                                                                                                                                     | `New release pull request created: \<${prUrl}\|\${prTitle}>\n*From*: ${branchName} → *To*: ${targetBranch}`                   |
| commit-list-message-template | optional | Template for the message with the list of commits when a PR is created.                                                                                                                                                                    | `Commits in this pull request:\n${commitListMessage}\n\n\<${changelogUrl}\|Full Changelog: ${branchName} to ${targetBranch}>` |
| update-message-template      | optional | Template for the message when a PR is updated with new commits.                                                                                                                                                                            | `New commit added: \<${commitUrl}\|\${commitMessage}> by @${githubUser}`                                                      |
| close-message-template       | optional | Template for the message when a PR is merged.                                                                                                                                                                                              | `Pull request \<${prUrl}\|\${prTitle}> was merged by @${mergedBy}`                                                            |

To use this action, create a workflow file in your repository (e.g., `.github/workflows/release-notifications.yml`) with the following content:

```yml
name: Release Notification on PR Opened or Updated

on:
  pull_request:
    types: [opened, synchronize, closed]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Slack notification action
        uses: thunkable/slack-release-notifications@v1.0.0
        with:
          slack-token: ${{ secrets.SLACK_BOT_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-channel: 'AB123DEF456'
          github-to-slack-map: |
            {
              "githubUsername1": "slackUserID1",
              "githubUsername2": "slackUserID2",
              "githubUsername3": "slackUserID3",
            }
```

## Setup Guide

### Step-by-Step Guide to Create a Slack App with Bot Token

#### Create a Slack App:

1. Go to the Slack API website: [https://api.slack.com/apps](https://api.slack.com/apps).
2. Click on the "Create New App" button.
3. Choose "From scratch" and provide a name for your app (e.g., "Release Notification Bot") and select the Slack workspace where you want to install the app.
4. Click "Create App".

#### Add Bot Token Scopes:

1. In your app settings, go to "OAuth & Permissions".
2. Scroll down to "Bot Token Scopes" and add the following scopes:
   - `chat:write`
   - `chat:write.public`
3. Click "Save Changes".

#### Install App to Workspace:

1. Go to "Install App" in the left sidebar.
2. Click "Install App to Workspace".
3. Authorize the app to post in your workspace.
4. After installation, you will receive a "Bot User OAuth Access Token". Copy this token.

#### Set Up GitHub Secrets:

1. Go to your GitHub repository and navigate to `Settings > Secrets and variables > Actions`.
2. Add a new secret named `SLACK_BOT_TOKEN` and paste your Slack Bot User OAuth Access Token.

### Note

Ensure that the GitHub token (`GITHUB_TOKEN`) has read and write permissions. You can configure this in your repository settings under `Settings` > `Actions` > `General` > `Workflow permissions`.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
3
4
