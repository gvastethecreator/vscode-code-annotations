export function queueJob(name: string): string {
  // TODO: Validate the job name before queueing.
  // FIXME: Preserve the original retry error.
  // HACK: Remove the compatibility branch after the migration.
  // NOTE: Jobs stay local until dispatch.
  // REVIEW: Confirm cancellation behavior before release.
  return name;
}

const ignoredLiteral = "TODO inside a string is not an annotation";
void ignoredLiteral;
