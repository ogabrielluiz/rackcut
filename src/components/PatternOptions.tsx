import { PATTERN_GROUPS } from "@/lib/patterns";

/** The <option>s of a pattern select: "None", then each kind of pattern in its own group. */
export default function PatternOptions() {
  return (
    <>
      <option value="none">None</option>
      {PATTERN_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.entries.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
