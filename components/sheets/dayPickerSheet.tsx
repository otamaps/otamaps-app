import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

export type DayPickerSheetRef = {
  /** Opens the sheet, showing the month that `iso` (`YYYY-MM-DD`) falls in. */
  present: (iso: string) => void;
  close: () => void;
};

type DayPickerSheetProps = {
  onSelectDay: (iso: string) => void;
  onDismiss?: () => void;
};

const WEEKDAY_HEADER_LABELS = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"];
const MONTH_LABELS = [
  "Tammikuu",
  "Helmikuu",
  "Maaliskuu",
  "Huhtikuu",
  "Toukokuu",
  "Kesäkuu",
  "Heinäkuu",
  "Elokuu",
  "Syyskuu",
  "Lokakuu",
  "Marraskuu",
  "Joulukuu",
];

function localISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** ISO weekday of a month's 1st: 1 (Monday) through 7 (Sunday). */
function isoWeekdayOfFirst(year: number, month: number): number {
  const weekday = new Date(year, month, 1).getDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * A bottom sheet showing a month calendar, letting the user pick any weekday
 * to jump the schedule screen to. Weekend cells are shown but not
 * selectable, since the schedule only ever displays Monday–Friday.
 */
const DayPickerSheet = forwardRef<DayPickerSheetRef, DayPickerSheetProps>(
  ({ onSelectDay, onDismiss }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const isDark = useColorScheme() === "dark";

    const todayISO = useMemo(() => {
      const d = new Date();
      return localISO(d.getFullYear(), d.getMonth(), d.getDate());
    }, []);

    const [selectedDay, setSelectedDay] = useState(todayISO);
    const [visibleYear, setVisibleYear] = useState(() =>
      Number(todayISO.slice(0, 4)),
    );
    const [visibleMonth, setVisibleMonth] = useState(
      () => Number(todayISO.slice(5, 7)) - 1,
    );

    // A fixed snap point sized for the (always 6-row) grid, with dynamic
    // sizing off — otherwise the sheet measures its content and resizes
    // itself, which is exactly the up/down jump this is meant to avoid.
    const snapPoints = useMemo(() => ["68%"], []);

    useImperativeHandle(ref, () => ({
      present: (iso: string) => {
        setSelectedDay(iso);
        const [y, m] = iso.split("-").map(Number);
        setVisibleYear(y);
        setVisibleMonth(m - 1);
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.close(),
    }));

    const goToMonth = useCallback((delta: number) => {
      setVisibleMonth((month) => {
        const total = month + delta;
        const wrapped = ((total % 12) + 12) % 12;
        if (total < 0 || total > 11) {
          setVisibleYear((year) => year + Math.floor(total / 12));
        }
        return wrapped;
      });
    }, []);

    const isViewingCurrentMonth =
      visibleYear === Number(todayISO.slice(0, 4)) &&
      visibleMonth === Number(todayISO.slice(5, 7)) - 1;

    const goToToday = useCallback(() => {
      setVisibleYear(Number(todayISO.slice(0, 4)));
      setVisibleMonth(Number(todayISO.slice(5, 7)) - 1);
    }, [todayISO]);

    // Always 6 rows (42 cells), padded with blanks — a 5-week month would
    // otherwise render a shorter grid than a 6-week one, making the sheet's
    // content (and its height) jump between months.
    const weeks = useMemo(() => {
      const totalDays = daysInMonth(visibleYear, visibleMonth);
      const leadingBlanks = isoWeekdayOfFirst(visibleYear, visibleMonth) - 1;
      const cells: (number | null)[] = [
        ...Array(leadingBlanks).fill(null),
        ...Array.from({ length: totalDays }, (_, i) => i + 1),
      ];
      while (cells.length < 42) cells.push(null);
      const rows: (number | null)[][] = [];
      for (let i = 0; i < cells.length; i += 7)
        rows.push(cells.slice(i, i + 7));
      return rows;
    }, [visibleYear, visibleMonth]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onDismiss={onDismiss}
        style={styles.sheetShadow}
        backgroundStyle={{ backgroundColor: isDark ? "#202226" : "#FFFFFF" }}
        handleStyle={{
          backgroundColor: isDark ? "#202226" : "#fff",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          // In dark mode the sheet's own background is close enough to the
          // page behind it (dimmed while the sheet is open) that the two can
          // blend together — a top border gives it a clear edge.
          ...(isDark && { borderTopWidth: 1, borderTopColor: "#3a3d42" }),
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? "#666666" : "#cccccc",
        }}
      >
        <BottomSheetView
          style={[styles.content, isDark && { backgroundColor: "#202226" }]}
        >
          <View style={styles.monthNav}>
            <Pressable
              onPress={goToToday}
              disabled={isViewingCurrentMonth}
              hitSlop={8}
              style={styles.todayBtn}
            >
              <Text
                style={[
                  styles.todayBtnText,
                  { color: isDark ? "#51a2ff" : "#4A89EE" },
                  isViewingCurrentMonth && styles.todayBtnTextDisabled,
                  isViewingCurrentMonth && isDark && { color: "#555" },
                ]}
              >
                Tänään
              </Text>
            </Pressable>
            <Text
              style={[styles.monthLabel, isDark && { color: "#fff" }]}
              numberOfLines={1}
            >
              {MONTH_LABELS[visibleMonth]} {visibleYear}
            </Text>
            <View style={styles.monthNavArrows}>
              <Pressable
                onPress={() => goToMonth(-1)}
                hitSlop={12}
                style={styles.monthNavBtn}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={26}
                  color={isDark ? "#51a2ff" : "#4A89EE"}
                />
              </Pressable>
              <Pressable
                onPress={() => goToMonth(1)}
                hitSlop={12}
                style={styles.monthNavBtn}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={26}
                  color={isDark ? "#51a2ff" : "#4A89EE"}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_HEADER_LABELS.map((label, i) => (
              <Text
                key={label}
                style={[
                  styles.weekdayLabel,
                  isDark && { color: "#888" },
                  i >= 5 && styles.weekendLabel,
                  i >= 5 && isDark && { color: "#555" },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          {weeks.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.weekRow}>
              {row.map((day, colIndex) => {
                if (day === null) {
                  return <View key={colIndex} style={styles.dayCell} />;
                }
                const iso = localISO(visibleYear, visibleMonth, day);
                const isWeekend = colIndex >= 5;
                const isSelected = iso === selectedDay;
                const isToday = iso === todayISO;
                return (
                  <Pressable
                    key={colIndex}
                    disabled={isWeekend}
                    onPress={() => {
                      setSelectedDay(iso);
                      onSelectDay(iso);
                      sheetRef.current?.close();
                    }}
                    style={styles.dayCell}
                  >
                    <View
                      style={[
                        styles.dayCellInner,
                        isToday && !isSelected && styles.dayCellInnerToday,
                        isToday &&
                          !isSelected &&
                          isDark && { borderColor: "#51a2ff" },
                        isSelected && [
                          styles.dayCellInnerSelected,
                          { backgroundColor: isDark ? "#51a2ff" : "#4A89EE" },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isDark && { color: "#fff" },
                          isWeekend && styles.dayCellTextWeekend,
                          isWeekend && isDark && { color: "#555" },
                          isToday &&
                            !isSelected && {
                              color: isDark ? "#51a2ff" : "#4A89EE",
                              fontFamily: "Figtree-SemiBold",
                            },
                          isSelected && styles.dayCellTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  sheetShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  monthNavBtn: { padding: 4 },
  monthNavArrows: { flexDirection: "row" },
  todayBtn: { paddingVertical: 4, paddingRight: 4 },
  todayBtnText: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 13,
  },
  todayBtnTextDisabled: { color: "#c2c8d0" },
  monthLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
    color: "#202833",
  },
  weekdayRow: { flexDirection: "row", marginBottom: 6 },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Figtree-Medium",
    fontSize: 12,
    color: "#8A929D",
  },
  weekendLabel: { color: "#c2c8d0" },
  weekRow: { flexDirection: "row" },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellInner: {
    width: "78%",
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellInnerToday: {
    borderWidth: 1.5,
    borderColor: "#4A89EE",
  },
  dayCellInnerSelected: {
    shadowColor: "#4A89EE",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  dayCellText: {
    fontFamily: "Figtree-Medium",
    fontSize: 15,
    color: "#202833",
  },
  dayCellTextWeekend: { color: "#c2c8d0" },
  dayCellTextSelected: { color: "#fff", fontFamily: "Figtree-SemiBold" },
});

DayPickerSheet.displayName = "DayPickerSheet";

export default DayPickerSheet;
