"use strict";

const CI_APP_ID = 15368; // GitHub Actions
const FINISHED = new Set(["success", "neutral", "skipped"]);
const sameRepo = (left, right) =>
  typeof left === "string" && left.toLowerCase() === right.toLowerCase();

function eligiblePull(pull, repository, baseBranch) {
  return (
    pull.state === "open" &&
    !pull.draft &&
    !pull.merged &&
    pull.user?.login === "dependabot[bot]" &&
    pull.user?.type === "Bot" &&
    pull.head?.ref?.startsWith("dependabot/") &&
    pull.base?.ref === baseBranch &&
    sameRepo(pull.head?.repo?.full_name, repository) &&
    sameRepo(pull.base?.repo?.full_name, repository)
  );
}

function versionPinsOnly(before, after) {
  function parse(text) {
    const pins = new Map();
    for (const line of text.trim().split(/\r?\n/)) {
      const match =
        /^([A-Za-z0-9][A-Za-z0-9._-]*)==([0-9][A-Za-z0-9.!+_-]*)$/.exec(line);
      if (!match || pins.has(match[1].toLowerCase())) return null;
      pins.set(match[1].toLowerCase(), match[2]);
    }
    return pins;
  }
  const oldPins = parse(before),
    newPins = parse(after);
  return Boolean(
    oldPins &&
      newPins &&
      oldPins.size === newPins.size &&
      [...oldPins.keys()].every((name) => newPins.has(name)) &&
      [...oldPins].some(([name, version]) => newPins.get(name) !== version),
  );
}

function checkGate({ sha, ciWorkflowId, runs, checks, status }) {
  // Older failed runs must not block a successful rerun; distinct workflows and
  // event types still count separately. Check-runs use GitHub's latest filter.
  const latest = new Map();
  for (const run of runs.filter((run) => run.head_sha === sha)) {
    const key = `${run.workflow_id}:${run.event}:${run.head_branch}`;
    if (!latest.has(key) || run.id > latest.get(key).id) latest.set(key, run);
  }
  const workflows = [...latest.values()];
  if (
    !workflows.some(
      (run) =>
        run.workflow_id === ciWorkflowId &&
        run.status === "completed" &&
        run.conclusion === "success",
    )
  )
    return "CI has not passed";
  if (
    workflows.some(
      (run) => run.status !== "completed" || !FINISHED.has(run.conclusion),
    )
  ) {
    return "A workflow is pending or unsuccessful";
  }
  if (
    !checks.some(
      (check) =>
        check.name === "test" &&
        check.app?.id === CI_APP_ID &&
        check.status === "completed" &&
        check.conclusion === "success",
    )
  )
    return "The CI test check has not passed";
  if (
    checks.some(
      (check) =>
        check.head_sha !== sha ||
        check.status !== "completed" ||
        !FINISHED.has(check.conclusion),
    )
  ) {
    return "A check is pending or unsuccessful";
  }
  const statusCount = status.total_count ?? status.statuses?.length;
  if (
    typeof statusCount !== "number" ||
    (statusCount > 0 && status.state !== "success") ||
    (statusCount === 0 && !["success", "pending"].includes(status.state))
  ) {
    return "A commit status is missing, pending or unsuccessful";
  }
  return null;
}

async function run({ github, context, core }) {
  const repo = context.repo;
  const repository = `${repo.owner}/${repo.repo}`;
  const { data: metadata } = await github.rest.repos.get(repo);
  const baseBranch = metadata.default_branch;
  const eventSha =
    context.eventName === "workflow_run"
      ? context.payload.workflow_run?.head_sha
      : context.eventName === "check_suite"
        ? context.payload.check_suite?.head_sha
        : context.eventName === "status"
          ? context.payload.sha
          : null;
  if (
    context.eventName === "workflow_run" &&
    !sameRepo(
      context.payload.workflow_run?.head_repository?.full_name,
      repository,
    )
  ) {
    core.info("Ignoring a workflow from another repository.");
    return;
  }
  const pulls = await github.paginate(github.rest.pulls.list, {
    ...repo,
    state: "open",
    base: baseBranch,
    per_page: 100,
  });
  const candidates = pulls.filter(
    (pull) =>
      eligiblePull(pull, repository, baseBranch) &&
      (!eventSha || pull.head.sha === eventSha),
  );
  if (!candidates.length) {
    core.info("No eligible Dependabot pull requests.");
    await core.summary
      .addHeading("Dependabot auto-merge")
      .addRaw("No eligible Dependabot pull requests.")
      .write();
    return;
  }
  const { data: ci } = await github.rest.actions.getWorkflow({
    ...repo,
    workflow_id: "python-app.yml",
  });
  const results = [];
  for (const candidate of candidates) {
    const pullNumber = candidate.number;
    const { data: pull } = await github.rest.pulls.get({
      ...repo,
      pull_number: pullNumber,
    });
    if (!eligiblePull(pull, repository, baseBranch)) continue;
    const sha = pull.head.sha;
    const skip = (reason) => {
      core.info(`#${pullNumber}: ${reason}`);
      results.push([String(pullNumber), reason]);
    };
    const files = await github.paginate(github.rest.pulls.listFiles, {
      ...repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    if (
      files.length !== 1 ||
      files[0].filename !== "requirements.txt" ||
      files[0].status !== "modified"
    ) {
      skip("Requires manual review: changes extend beyond requirements.txt");
      continue;
    }
    const manifests = await Promise.all(
      [pull.base.sha, sha].map((ref) =>
        github.rest.repos.getContent({
          ...repo,
          path: "requirements.txt",
          ref,
        }),
      ),
    );
    if (
      manifests.some(
        ({ data }) =>
          data.type !== "file" ||
          data.encoding !== "base64" ||
          data.size > 65536,
      ) ||
      !versionPinsOnly(
        ...manifests.map(({ data }) =>
          Buffer.from(data.content, "base64").toString("utf8"),
        ),
      )
    ) {
      skip(
        "Requires manual review: changes are not existing dependency version pins",
      );
      continue;
    }
    const [runs, checks, { data: status }] = await Promise.all([
      github.paginate(github.rest.actions.listWorkflowRunsForRepo, {
        ...repo,
        head_sha: sha,
        per_page: 100,
      }),
      github.paginate(github.rest.checks.listForRef, {
        ...repo,
        ref: sha,
        filter: "latest",
        per_page: 100,
      }),
      github.rest.repos.getCombinedStatusForRef({
        ...repo,
        ref: sha,
        per_page: 100,
      }),
    ]);
    const reason = checkGate({
      sha,
      ciWorkflowId: ci.id,
      runs,
      checks,
      status,
    });
    if (reason) {
      skip(reason);
      continue;
    }
    // Re-read immediately before merging and send the tested SHA to GitHub.
    // GitHub still enforces required checks, reviews, and up-to-date branches.
    const { data: current } = await github.rest.pulls.get({
      ...repo,
      pull_number: pullNumber,
    });
    if (
      !eligiblePull(current, repository, baseBranch) ||
      current.head.sha !== sha ||
      current.base.sha !== pull.base.sha
    ) {
      skip("Branch changed while checks were evaluated");
      continue;
    }
    if (current.mergeable !== true || current.mergeable_state !== "clean") {
      skip(
        "Waiting for GitHub mergeability, a branch update, or required review",
      );
      continue;
    }
    try {
      const { data: merged } = await github.rest.pulls.merge({
        ...repo,
        pull_number: pullNumber,
        sha,
        merge_method: "squash",
      });
      skip(
        merged.merged
          ? `Merged tested commit ${sha}`
          : "GitHub did not merge the pull request",
      );
    } catch (error) {
      if (![405, 409, 422].includes(error.status)) throw error;
      skip(
        "GitHub blocked the merge; branch protections or the commit changed",
      );
    }
  }
  await core.summary
    .addHeading("Dependabot auto-merge")
    .addTable([
      [
        { data: "PR", header: true },
        { data: "Result", header: true },
      ],
      ...results,
    ])
    .write();
}

module.exports = { eligiblePull, versionPinsOnly, checkGate, run };
