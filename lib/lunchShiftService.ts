import { LunchShiftRow, LunchShiftSlot } from "@/lib/lunchShiftCore";
import { supabase } from "@/lib/supabase";

export { isCurrentUserAdmin } from "@/lib/queueService";

export type LunchShiftImportMeta = {
  periodLabel: string;
  importedAt: string;
  importedBy: string | null;
  slotCount: number;
};

export async function getLunchShiftsForWeekday(
  weekday: number
): Promise<LunchShiftRow[]> {
  const { data, error } = await supabase
    .from("lunch_shifts")
    .select("weekday, start_time, end_time, shift, course_codes")
    .eq("weekday", weekday);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    weekday: Number(row.weekday),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    shift: row.shift == null ? null : (Number(row.shift) as 1 | 2),
    courseCodes: (row.course_codes ?? []) as string[],
  }));
}

export async function getLunchShiftImportMeta(): Promise<LunchShiftImportMeta | null> {
  const { data, error } = await supabase
    .from("lunch_shifts")
    .select("period_label, imported_at, imported_by")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from("lunch_shifts")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;

  return {
    periodLabel: data.period_label ?? "",
    importedAt: data.imported_at,
    importedBy: data.imported_by,
    slotCount: count ?? 0,
  };
}

export async function replaceLunchShifts(
  periodLabel: string,
  slots: LunchShiftSlot[]
): Promise<void> {
  const { error } = await supabase.rpc("replace_lunch_shifts", {
    p_period_label: periodLabel,
    p_slots: slots.map((slot) => ({
      weekday: slot.weekday,
      start_time: slot.startTime,
      end_time: slot.endTime,
      shift: slot.shift,
      course_codes: slot.courseCodes,
    })),
  });
  if (error) throw error;
}
