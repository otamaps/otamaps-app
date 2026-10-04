import { WeekTimetable } from "@/components/schedule/WeekTimetable";
import { fetchWilmaRoomSchedule } from "@/lib/wilma/graphqlClient";
import { formatFinnishDate } from "@/lib/wilma/scheduleDates";
import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

export default function WilmaRoomScheduleScreen() {
  const { roomId, code, name } = useLocalSearchParams<{
    roomId: string;
    code?: string;
    name?: string;
  }>();

  const fetchWeek = useCallback(
    async (monday: Date, forceRefresh: boolean) => {
      const id = Number(roomId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("Virheellinen tilan tunniste.");
      const schedule = await fetchWilmaRoomSchedule(id, formatFinnishDate(monday), {
        forceRefresh,
      });
      return schedule.lessons.map((lesson) => ({
        ...lesson,
        groups: lesson.groups.map((group) => ({
          code: group.code,
          name: group.name,
          detail: group.teachers
            .map((teacher) => teacher.name || teacher.code)
            .filter(Boolean)
            .join(", "),
        })),
      }));
    },
    [roomId],
  );

  // A room's code is what's on the door, so it leads; its full name, when
  // it has one, is the supporting line.
  return (
    <WeekTimetable
      title={code || "Tila"}
      subtitle={name && name !== code ? name : undefined}
      fetchWeek={fetchWeek}
    />
  );
}
