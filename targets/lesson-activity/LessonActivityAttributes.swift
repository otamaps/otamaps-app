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
    /// What is happening now. Empty title means a free period or before school.
    var currentTitle: String
    var currentRoom: String
    /// When `currentTitle` ends, as seconds since 1970. Drives the countdown.
    var currentEndsAt: Double?

    /// What follows — the next lesson, or lunch when that comes first.
    var nextTitle: String
    var nextRoom: String
    /// When `nextTitle` starts, as seconds since 1970.
    var nextStartsAt: Double?

    var currentEndDate: Date? {
      currentEndsAt.map { Date(timeIntervalSince1970: $0) }
    }
    var nextStartDate: Date? {
      nextStartsAt.map { Date(timeIntervalSince1970: $0) }
    }
  }

  /// Set once when the activity starts and never updated.
  var dayLabel: String
}
