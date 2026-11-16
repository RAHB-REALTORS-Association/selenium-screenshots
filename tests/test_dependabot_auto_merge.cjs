const test = require("node:test");
const assert = require("node:assert/strict");
const {
  eligiblePull,
  versionPinsOnly,
  checkGate,
  run,
} = require("../.github/scripts/dependabot-auto-merge.cjs");

const repository = "example/screenshots";
const sha = "a".repeat(40),
  baseSha = "b".repeat(40);
const pull = () => ({
  number: 12,
  state: "open",
  draft: false,
  merged: false,
  user: { login: "dependabot[bot]", type: "Bot" },
  head: {
    sha,
    ref: "dependabot/pip/gunicorn-27.0.1",
    repo: { full_name: repository },
  },
  base: { sha: baseSha, ref: "master", repo: { full_name: repository } },
  mergeable: true,
  mergeable_state: "clean",
});
const workflow = () => ({
  id: 8,
  workflow_id: 4,
  event: "pull_request",
  head_branch: pull().head.ref,
  head_sha: sha,
  status: "completed",
  conclusion: "success",
});
const check = () => ({
  name: "test",
  head_sha: sha,
  app: { id: 15368 },
  status: "completed",
  conclusion: "success",
});
const gate = () => ({
  sha,
  ciWorkflowId: 4,
  runs: [workflow()],
  checks: [check()],
  status: { total_count: 0, statuses: [], state: "pending" },
});

test("only genuine, open, same-repository Dependabot PRs are eligible", () => {
  assert.ok(eligiblePull(pull(), repository, "master"));
  for (const changes of [
    { draft: true },
    { state: "closed" },
    { merged: true },
    { user: { login: "maintainer", type: "User" } },
    { user: { login: "dependabot[bot]", type: "User" } },
    { head: { ...pull().head, ref: "codex/fix" } },
    { head: { ...pull().head, repo: { full_name: "attacker/screenshots" } } },
    { base: { ...pull().base, ref: "other" } },
    { base: { ...pull().base, repo: { full_name: "other/screenshots" } } },
  ])
    assert.equal(
      eligiblePull({ ...pull(), ...changes }, repository, "master"),
      false,
    );
});

test("only existing pinned dependency versions may change, including major bumps", () => {
  assert.ok(
    versionPinsOnly(
      "Flask==3.1.3\ngunicorn==26.2.0\n",
      "Flask==3.1.3\ngunicorn==27.0.1\n",
    ),
  );
  for (const after of [
    "gunicorn==26.2.0",
    "gunicorn @ https://example.test/evil.whl",
    "--extra-index-url https://example.test\ngunicorn==27.0.1",
    "gunicorn==27.0.1\nnew-package==1.0",
    "other==27.0.1",
    "gunicorn==27.0.1\ngunicorn==27.0.2",
  ]) {
    assert.equal(versionPinsOnly("gunicorn==26.2.0", after), false);
  }
});

test("missing CI, wrong SHA, and a forged test check never satisfy the gate", () => {
  assert.equal(checkGate(gate()), null);
  assert.ok(checkGate({ ...gate(), runs: [] }));
  assert.ok(
    checkGate({ ...gate(), runs: [{ ...workflow(), head_sha: "other" }] }),
  );
  assert.ok(
    checkGate({ ...gate(), runs: [{ ...workflow(), workflow_id: 999 }] }),
  );
  assert.ok(checkGate({ ...gate(), checks: [] }));
  assert.ok(
    checkGate({ ...gate(), checks: [{ ...check(), app: { id: 123 } }] }),
  );
});

test("pending, cancelled or failing checks and workflows block merging", () => {
  for (const status of ["queued", "in_progress", "waiting"]) {
    assert.ok(
      checkGate({
        ...gate(),
        runs: [{ ...workflow(), status, conclusion: null }],
      }),
    );
    assert.ok(
      checkGate({
        ...gate(),
        checks: [
          check(),
          { ...check(), name: "extra", status, conclusion: null },
        ],
      }),
    );
  }
  for (const conclusion of [
    "failure",
    "cancelled",
    "timed_out",
    "action_required",
    null,
  ]) {
    assert.ok(
      checkGate({
        ...gate(),
        checks: [check(), { ...check(), name: "extra", conclusion }],
      }),
    );
    assert.ok(
      checkGate({
        ...gate(),
        runs: [
          workflow(),
          { ...workflow(), id: 9, workflow_id: 5, conclusion },
        ],
      }),
    );
  }
});

test("external commit statuses must pass as well", () => {
  for (const state of ["pending", "failure", "error"])
    assert.ok(checkGate({ ...gate(), status: { total_count: 1, state } }));
  assert.equal(
    checkGate({ ...gate(), status: { total_count: 1, state: "success" } }),
    null,
  );
  assert.ok(checkGate({ ...gate(), status: {} }));
});

test("the latest rerun supersedes an earlier failure without ignoring other workflows", () => {
  const older = { ...workflow(), id: 7, conclusion: "failure" };
  assert.equal(checkGate({ ...gate(), runs: [workflow(), older] }), null);
  assert.ok(
    checkGate({
      ...gate(),
      runs: [
        older,
        workflow(),
        { ...workflow(), workflow_id: 5, conclusion: "failure" },
      ],
    }),
  );
});

function fixture(options = {}) {
  const attempts = [],
    logs = [],
    rows = [];
  let reads = 0;
  const encode = (content) => ({
    data: {
      type: "file",
      encoding: "base64",
      size: content.length,
      content: Buffer.from(content).toString("base64"),
    },
  });
  const github = {
    paginate: (method, args) => method(args),
    rest: {
      repos: {
        get: async () => ({ data: { default_branch: "master" } }),
        getContent: async ({ ref }) =>
          encode(
            ref === baseSha
              ? "gunicorn==26.2.0"
              : options.manifest || "gunicorn==27.0.1",
          ),
        getCombinedStatusForRef: async () => ({
          data: options.status || gate().status,
        }),
      },
      pulls: {
        list: async () => [options.pull || pull()],
        get: async () => ({
          data:
            options.current && ++reads > 1
              ? options.current
              : options.pull || pull(),
        }),
        listFiles: async () =>
          options.files || [
            { filename: "requirements.txt", status: "modified" },
          ],
        merge: async (args) => {
          attempts.push(args);
          if (options.error) throw options.error;
          return { data: { merged: true } };
        },
      },
      actions: {
        getWorkflow: async () => ({ data: { id: 4 } }),
        listWorkflowRunsForRepo: async () => options.runs || [workflow()],
      },
      checks: { listForRef: async () => options.checks || [check()] },
    },
  };
  const summary = {
    addHeading() {
      return this;
    },
    addRaw(text) {
      logs.push(text);
      return this;
    },
    addTable(table) {
      rows.push(...table);
      return this;
    },
    async write() {},
  };
  const core = { info: (message) => logs.push(message), summary };
  const context = {
    repo: { owner: "example", repo: "screenshots" },
    eventName: "workflow_run",
    payload: {
      workflow_run: {
        head_sha: sha,
        head_repository: { full_name: options.sourceRepo || repository },
      },
    },
  };
  return { github, core, context, attempts, logs, rows };
}

test("a passing Dependabot update is squash-merged with the tested SHA", async () => {
  const f = fixture();
  await run(f);
  assert.deepEqual(f.attempts, [
    {
      owner: "example",
      repo: "screenshots",
      pull_number: 12,
      sha,
      merge_method: "squash",
    },
  ]);
});

test("no merge occurs for human PRs, foreign workflow runs or unexpected file changes", async () => {
  for (const options of [
    { pull: { ...pull(), user: { login: "human", type: "User" } } },
    { sourceRepo: "attacker/screenshots" },
    { files: [{ filename: "app.py", status: "modified" }] },
    { files: [{ filename: "requirements.txt", status: "renamed" }] },
    { manifest: "gunicorn @ https://example.test/evil.whl" },
  ]) {
    const f = fixture(options);
    await run(f);
    assert.equal(f.attempts.length, 0);
  }
});

test("head or base changes during evaluation prevent a merge", async () => {
  for (const current of [
    { ...pull(), head: { ...pull().head, sha: "new" } },
    { ...pull(), base: { ...pull().base, sha: "new" } },
  ]) {
    const f = fixture({ current });
    await run(f);
    assert.equal(f.attempts.length, 0);
  }
});

test("GitHub review requirements, conflicts and outdated branches remain enforced", async () => {
  for (const state of ["blocked", "dirty", "behind", "unknown"]) {
    const f = fixture({ pull: { ...pull(), mergeable_state: state } });
    await run(f);
    assert.equal(f.attempts.length, 0);
  }
  const f = fixture({
    error: Object.assign(Error("Protected branch"), { status: 405 }),
  });
  await run(f);
  assert.equal(f.attempts.length, 1);
  assert.match(f.logs.at(-1), /GitHub blocked/);
});

test("an additional failing check prevents an otherwise passing PR from merging", async () => {
  const f = fixture({
    checks: [check(), { ...check(), name: "security", conclusion: "failure" }],
  });
  await run(f);
  assert.equal(f.attempts.length, 0);
});
