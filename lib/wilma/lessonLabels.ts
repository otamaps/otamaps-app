export type LessonLabel = {
  /** Wilma course code, for example `GE01.23`. Empty when it adds nothing. */
  code: string;
  /** Course name, for example `Maailma muutoksessa`. */
  title: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Wilma names a lesson twice: a course code (`GE01.23`) and a course name
 * (`Maailma muutoksessa`). The two live in different fields per endpoint —
 * `shortCaption`/`fullCaption` on a student schedule, `code`/`name` on teacher
 * and room schedules — and some feeds already prefix the name with the code.
 * Every lesson surface splits them here so a code is shown beside the title
 * exactly once, and never on its own when it is all we have.
 */
export function lessonLabel(
  code: unknown,
  name: unknown,
  fallback: unknown = ""
): LessonLabel {
  const rawCode = clean(code);
  let title = clean(name) || clean(fallback);

  if (rawCode && title.toLowerCase().startsWith(rawCode.toLowerCase())) {
    // Only strip a prefix that ends on a separator, so code `GE01` never eats
    // the start of a different course's code in `GE01.23 Maailma muutoksessa`.
    const rest = title.slice(rawCode.length);
    const stripped = /^[\s:·–—-]/.test(rest) ? rest.replace(/^[\s:·–—-]+/, "").trim() : "";
    if (stripped) title = stripped;
  }

  if (!title) return { code: "", title: rawCode };
  return {
    code: rawCode.toLowerCase() === title.toLowerCase() ? "" : rawCode,
    title,
  };
}
