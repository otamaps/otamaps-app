import ActivityKit
import Foundation

/// The shape of the Lock Screen / Dynamic Island activity for a school day.
///
/// This file is compiled into **both** the app and the widget extension. The
/// two copies must stay byte-identical: ActivityKit matches an activity to its
/// attributes by type name and encoded shape, and a mismatch fails silently at
/// runtime rather than at build time.
struct LessonActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// One lesson or the lunch window, with its times as seconds since 1970.
    public struct Segment: Codable, Hashable {
      var title: String
      var room: String
      var start: Double
      var end: Double

      var startDate: Date { Date(timeIntervalSince1970: start) }
      var endDate: Date { Date(timeIntervalSince1970: end) }
    }

    /// What is happening now. Empty title means a free period or before school.
    var currentTitle: String
    var currentRoom: String
    /// When `currentTitle` ends, as seconds since 1970. Drives the countdown.
    var currentEndsAt: Double?
    /// When `currentTitle` started, as seconds since 1970. Lets the card draw
    /// how far through the lesson it is; absent from an older app's updates,
    /// in which case the progress bar is left out.
    var currentStartsAt: Double?

    /// What follows — the next lesson, or lunch when that comes first.
    var nextTitle: String
    var nextRoom: String
    /// When `nextTitle` starts, as seconds since 1970.
    var nextStartsAt: Double?

    /// The rest of the day. iOS cannot be told to update a Live Activity at a
    /// lesson boundary, so the card is given the whole day and works out which
    /// lesson is on whenever it is drawn — including the one redraw iOS makes
    /// when the activity goes stale. Absent from an older app's updates, in
    /// which case `currentTitle` and `nextTitle` are shown as they are.
    var segments: [Segment]?

    var currentStartDate: Date? {
      currentStartsAt.map { Date(timeIntervalSince1970: $0) }
    }
    var currentEndDate: Date? {
      currentEndsAt.map { Date(timeIntervalSince1970: $0) }
    }
    var nextStartDate: Date? {
      nextStartsAt.map { Date(timeIntervalSince1970: $0) }
    }

    /// What is on, what follows, and whether the day is finished.
    struct Resolved {
      var current: Segment?
      var next: Segment?
      var dayOver: Bool
    }

    /// Resolves the card against `date`. Two segments can cover the same
    /// minute — lunch sits inside a long midday block — so `current` is the
    /// one that ends soonest, as the app picks it; `next` is the earliest
    /// start still to come.
    func resolved(at date: Date) -> Resolved {
      guard let segments, !segments.isEmpty else {
        let current: Segment? =
          (currentTitle.isEmpty || currentEndsAt == nil)
          ? nil
          : Segment(
            title: currentTitle, room: currentRoom,
            start: currentStartsAt ?? currentEndsAt ?? 0, end: currentEndsAt ?? 0)
        let next: Segment? =
          (nextTitle.isEmpty || nextStartsAt == nil)
          ? nil
          : Segment(
            title: nextTitle, room: nextRoom,
            start: nextStartsAt ?? 0, end: nextStartsAt ?? 0)
        return Resolved(current: current, next: next, dayOver: false)
      }

      let now = date.timeIntervalSince1970
      let current = segments
        .filter { $0.start <= now && now < $0.end }
        .min { $0.end < $1.end }
      let next = segments
        .filter { $0.start > now }
        .min { $0.start < $1.start }
      return Resolved(current: current, next: next, dayOver: current == nil && next == nil)
    }
  }

  /// Set once when the activity starts and never updated.
  var dayLabel: String
}
