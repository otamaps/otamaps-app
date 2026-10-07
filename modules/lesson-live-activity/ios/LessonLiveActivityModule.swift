import ActivityKit
import ExpoModulesCore

/// The JS-facing payload. Mirrors `LessonActivitySnapshot` in `index.ts`.
struct LessonSegmentInput: Record {
  @Field var title: String = ""
  @Field var room: String = ""
  @Field var start: Double = 0
  @Field var end: Double = 0
}

struct LessonActivityInput: Record {
  @Field var dayLabel: String = ""
  @Field var currentTitle: String = ""
  @Field var currentRoom: String = ""
  @Field var currentEndsAt: Double? = nil
  @Field var currentStartsAt: Double? = nil
  @Field var nextTitle: String = ""
  @Field var nextRoom: String = ""
  @Field var nextStartsAt: Double? = nil
  /// The whole day, so the card can move on between updates.
  @Field var segments: [LessonSegmentInput] = []
  /// The phone's appearance, so the card can follow it.
  @Field var isDark: Bool? = nil
}

public class LessonLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LessonLiveActivity")

    /// What this build of the module can do, so JavaScript — which can be
    /// updated over the air to an app with an older module — only asks for what
    /// is there. 1 is the module before it had a version: no delayed `end`.
    /// 2 adds `end(dismissAt)`. 3 adds `isActive`.
    Function("apiVersion") { () -> Int in
      return 3
    }

    /// Whether a lesson card is on the Lock Screen right now. An activity that
    /// has ended, or that the user swiped away, is not.
    Function("isActive") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return !Activity<LessonActivityAttributes>.activities.isEmpty
    }

    /// Whether this device can show one *and* the user has left Live
    /// Activities enabled for the app in Settings. Both have to be true, and
    /// the second can change while the app is running.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// Starts today's activity, or updates the one already running. Returns
    /// false when the platform refused it.
    AsyncFunction("start") { (input: LessonActivityInput) -> Bool in
      guard #available(iOS 16.2, *),
            ActivityAuthorizationInfo().areActivitiesEnabled else {
        return false
      }

      let state = LessonActivityAttributes.ContentState(
        currentTitle: input.currentTitle,
        currentRoom: input.currentRoom,
        currentEndsAt: input.currentEndsAt,
        currentStartsAt: input.currentStartsAt,
        nextTitle: input.nextTitle,
        nextRoom: input.nextRoom,
        nextStartsAt: input.nextStartsAt,
        segments: input.segments.isEmpty
          ? nil
          : input.segments.map {
            LessonActivityAttributes.ContentState.Segment(
              title: $0.title, room: $0.room, start: $0.start, end: $0.end)
          },
        isDark: input.isDark
      )

      // Only ever one activity for this app: reuse whatever is already
      // running so opening the app twice does not stack Lock Screen cards.
      if let running = Activity<LessonActivityAttributes>.activities.first {
        await running.update(Self.content(state, input))
        return true
      }

      do {
        _ = try Activity.request(
          attributes: LessonActivityAttributes(dayLabel: input.dayLabel),
          content: Self.content(state, input),
          pushType: nil
        )
        return true
      } catch {
        // Throwing here would surface as an unhandled JS rejection for
        // something the user cannot act on (too many activities, denied
        // while backgrounded). The caller treats false as "not showing".
        return false
      }
    }

    /// Ends the activity: at once, or — given `dismissAt`, in seconds since
    /// 1970 — leaves it on the Lock Screen as it is until then. An ended
    /// activity takes no more updates, but a countdown in it keeps running,
    /// and iOS removes it at that time (at the latest four hours after it ends).
    AsyncFunction("end") { (dismissAt: Double?) -> Void in
      guard #available(iOS 16.2, *) else { return }
      let policy: ActivityUIDismissalPolicy =
        dismissAt.map { .after(Date(timeIntervalSince1970: $0)) } ?? .immediate
      for activity in Activity<LessonActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: policy)
      }
    }
  }

  /// The activity goes stale when the thing it is counting down to has passed,
  /// so iOS dims it rather than leaving a finished lesson looking live. Without
  /// push updates that is the only signal available that the content is old.
  @available(iOS 16.2, *)
  private static func content(
    _ state: LessonActivityAttributes.ContentState,
    _ input: LessonActivityInput
  ) -> ActivityContent<LessonActivityAttributes.ContentState> {
    // The next moment the card has to change. With the whole day on board
    // that is the first segment boundary still ahead; iOS redraws the card
    // then, and it works out the lesson that followed. Without it, the
    // nearer of the current lesson's end and the next one's start.
    let now = Date().timeIntervalSince1970
    let boundaries = input.segments.flatMap { [$0.start, $0.end] }.filter { $0 > now }
    let fallback = [input.currentEndsAt, input.nextStartsAt].compactMap { $0 }
    let staleDate = (boundaries.isEmpty ? fallback : boundaries)
      .min()
      .map { Date(timeIntervalSince1970: $0) }
    return ActivityContent(state: state, staleDate: staleDate)
  }
}
