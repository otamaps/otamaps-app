import { WeekTimetable } from "@/components/schedule/WeekTimetable";
import { fetchWilmaTeacherSchedule } from "@/lib/wilma/graphqlClient";
import { formatFinnishDate } from "@/lib/wilma/scheduleDates";
import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

export default function WilmaTeacherScheduleScreen() {
  const { teacherId, code, name } = useLocalSearchParams<{
    teacherId: string;
    code?: string;
    name?: string;
  }>();

  const fetchWeek = useCallback(
    async (monday: Date, forceRefresh: boolean) => {
      const id = Number(teacherId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("Virheellinen opettajan tunniste.");
      const schedule = await fetchWilmaTeacherSchedule(id, formatFinnishDate(monday), {
        forceRefresh,
      });
      return schedule.lessons.map((lesson) => ({
        ...lesson,
        groups: lesson.groups.map((group) => ({
          code: group.code,
          name: group.name,
          detail: group.rooms
            .map((room) => room.code || room.name)
            .filter(Boolean)
            .join(", "),
        })),
      }));
    },
    [teacherId],
  );

  return <WeekTimetable title={name || "Opettaja"} subtitle={code} fetchWeek={fetchWeek} />;
}
