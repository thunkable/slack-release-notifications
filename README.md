# Slack Notification Action

This action sends notifications to Slack for release PRs.

## Inputs

### `slack-token`

**Required** The Slack Bot Token.

### `github-token`

**Required** The GitHub Token.

### `slack-channel`

**Required** The Slack Channel ID.

## Example usage

```yaml
name: Release Notification on PR Opened or Updated

on:
  pull_request:
    types: [opened, synchronize]
    branches:
      - 'release-*'

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Run Slack notification action
        uses: ./ # or 'username/repository@version' if published on GitHub Marketplace
        with:
          slack-token: ${{ secrets.SLACK_BOT_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-channel: 'C0759V2S70A'
