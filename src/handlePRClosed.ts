import * as github from '@actions/github';
import axios from 'axios';

export async function handlePRClosed(
    slackToken: string, 
    slackChannel: string, 
    githubToken: string, 
    closeMessageTemplate: string
) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('No pull request found');
    }

    if (!pr.merged) {
        console.log('Pull request was closed but not merged. No notification sent.');
        return;
    }

    const prTitle = pr.title;
    const prUrl = pr.html_url || '';
    const mergedBy = pr.merged_by.login;

    const prBody = pr.body || '';
    const messageTsMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
    const messageTs = messageTsMatch ? messageTsMatch[1] : null;

    if (!messageTs) {
        throw new Error('No Slack message_ts found in pull request description');
    }

    const defaultCloseMessageTemplate = `Pull request <${prUrl}|${prTitle}> was merged by @${mergedBy}`;
    const closeMessage = (closeMessageTemplate || defaultCloseMessageTemplate)
        .replace('${prUrl}', prUrl)
        .replace('${prTitle}', prTitle)
        .replace('${mergedBy}', mergedBy);

    await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: closeMessage,
        thread_ts: messageTs
    }, {
        headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json'
        }
    });
}
