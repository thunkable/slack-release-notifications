import {
  buildSortedCommitBlocks,
  chunkBlocks,
  SlackBlock,
} from "../src/utils/buildSlackBlocks";

describe("buildSortedCommitBlocks", () => {
  const changelogUrl = "https://github.com/owner/repo/compare/main...release";
  const branchName = "release";
  const targetBranch = "main";

  it("builds blocks with scopes sorted alphabetically", () => {
    const categorized = {
      frontend: {
        fix: ["• fix(frontend): Fix button by @user"],
      },
      backend: {
        chore: ["• chore(backend): Update deps by @user"],
      },
    };

    const blocks = buildSortedCommitBlocks(
      categorized,
      changelogUrl,
      branchName,
      targetBranch,
    );

    // Backend comes first alphabetically
    expect(blocks[0]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "Backend", emoji: true },
    });
    expect(blocks[1]).toEqual({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*chore*\n• chore(backend): Update deps by @user",
      },
    });
    // Divider between scopes
    expect(blocks[2]).toEqual({ type: "divider" });
    // Frontend second
    expect(blocks[3]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "Frontend", emoji: true },
    });
    expect(blocks[4]).toEqual({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*fix*\n• fix(frontend): Fix button by @user",
      },
    });
    // Divider before changelog
    expect(blocks[5]).toEqual({ type: "divider" });
    // Changelog link
    expect(blocks[6]).toEqual({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${changelogUrl}|Full Changelog: ${branchName} to ${targetBranch}>`,
      },
    });
    expect(blocks).toHaveLength(7);
  });

  it("sorts types within a scope alphabetically", () => {
    const categorized = {
      backend: {
        fix: ["• fix(backend): Fix auth by @user"],
        chore: ["• chore(backend): Update deps by @user"],
        feat: ["• feat(backend): Add endpoint by @user"],
      },
    };

    const blocks = buildSortedCommitBlocks(
      categorized,
      changelogUrl,
      branchName,
      targetBranch,
    );

    // Single scope: header + section + divider + changelog = 4 blocks
    expect(blocks).toHaveLength(4);
    const sectionText = blocks[1].text!.text;
    const typeOrder = sectionText
      .split("\n")
      .filter((l: string) => l.startsWith("*"))
      .map((l: string) => l.replace(/\*/g, ""));
    expect(typeOrder).toEqual(["chore", "feat", "fix"]);
  });

  it("handles a single scope without inter-scope divider", () => {
    const categorized = {
      other: {
        chore: ["• chore: Misc task by @user"],
      },
    };

    const blocks = buildSortedCommitBlocks(
      categorized,
      changelogUrl,
      branchName,
      targetBranch,
    );

    // header + section + divider(changelog) + changelog = 4
    expect(blocks).toHaveLength(4);
    expect(blocks[0].type).toBe("header");
    expect(blocks[1].type).toBe("section");
    expect(blocks[2].type).toBe("divider");
    expect(blocks[3].type).toBe("section"); // changelog
  });
});

describe("chunkBlocks", () => {
  const makeBlocks = (n: number): SlackBlock[] =>
    Array.from({ length: n }, (_, i) => ({
      type: "section",
      text: { type: "mrkdwn", text: `block ${i}` },
    }));

  it("returns a single chunk when blocks fit within limit", () => {
    const blocks = makeBlocks(10);
    const chunks = chunkBlocks(blocks, 48);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(blocks);
  });

  it("splits blocks into multiple chunks when exceeding limit", () => {
    const blocks = makeBlocks(100);
    const chunks = chunkBlocks(blocks, 48);
    expect(chunks).toHaveLength(3); // 48 + 48 + 4
    expect(chunks[0]).toHaveLength(48);
    expect(chunks[1]).toHaveLength(48);
    expect(chunks[2]).toHaveLength(4);
  });

  it("handles exactly the limit", () => {
    const blocks = makeBlocks(48);
    const chunks = chunkBlocks(blocks, 48);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(48);
  });

  it("handles empty blocks array", () => {
    const chunks = chunkBlocks([], 48);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual([]);
  });
});
