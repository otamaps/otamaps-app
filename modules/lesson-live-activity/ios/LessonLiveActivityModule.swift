import ActivityKit
import ExpoModulesCore

/// The JS-facing payload. Mirrors `LessonActivitySnapshot` in `index.ts`.
struct LessonActivityInput: Record {
  @Field var dayLabel: String = ""
  @Field var currentTitle: String = ""
  @Field var currentRoom: String = ""
  @Field var currentEndsAt: Double? = nil
  @Field var nextTitle: String = ""
  @Field var nextRoom: String = ""
  @Field var nextStartsAt: Double? = nil
}

public class LessonLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LessonLiveActivity")

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
        nextTitle: input.nextTitle,
        nextRoom: input.nextRoom,
        nextStartsAt: input.nextStartsAt
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

    AsyncFunction("end") { () -> Void in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<LessonActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
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
    let staleDate = [input.currentEndsAt, input.nextStartsAt]
      .compactMap { $0 }
      .min()
      .map { Date(timeIntervalSince1970: $0) }
    return ActivityContent(state: state, staleDate: staleDate)
  }
}
