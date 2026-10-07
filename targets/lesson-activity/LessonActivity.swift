import ActivityKit
import SwiftUI
import WidgetKit

/// Fixed brand colours. The extension cannot read the app's JS theme, so the
/// accent is repeated here from `constants/theme.ts`.
private let accent = Color(red: 0x34 / 255, green: 0x78 / 255, blue: 0xF5 / 255)

/// The card's background, translucent so the wallpaper shows through. Chosen
/// from the appearance the app sends rather than read from the environment: on
/// newer iOS versions the Lock Screen hands a Live Activity a dark colour
/// scheme whatever the phone is set to, or one that follows the wallpaper.
private let cardBackgroundDark = Color(white: 0.11, opacity: 0.86)
private let cardBackgroundLight = Color(white: 1.0, opacity: 0.90)

/// A relative countdown to `date`, e.g. "12:04". Live Activity views are only
/// re-rendered by the system on a content update, so a plain formatted string
/// would freeze — `Text(timerInterval:)` is one of the few things that keeps
/// ticking on its own.
///
/// The range's upper bound is never earlier than now: a view can be drawn
/// after the moment it counts down to, and `Date.now...date` with the bounds
/// the wrong way round is a fatal error, not an empty range.
private func countdown(to date: Date) -> some View {
  let now = Date.now
  return Text(timerInterval: now...max(date, now), countsDown: true)
    .monospacedDigit()
}

/// How far through the current lesson it is, ticking on its own like the
/// countdown. Left out when the app did not send a start time, or the lesson
/// is already over.
private struct LessonProgress: View {
  let start: Date?
  let end: Date?

  var body: some View {
    if let start, let end, end > start, end > Date.now {
      ProgressView(timerInterval: start...end, countsDown: false) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      .progressViewStyle(.linear)
      .tint(accent)
    }
  }
}

/// "NYT" — marks the lesson that is under way, as opposed to the free period
/// the card shows before and between lessons.
private struct NowBadge: View {
  var body: some View {
    Text("NYT")
      .font(.system(size: 10, weight: .heavy, design: .rounded))
      .tracking(0.6)
      .foregroundStyle(.white)
      .padding(.horizontal, 6)
      .padding(.vertical, 2)
      .background(accent, in: Capsule())
  }
}

/// The room, with a pin, when there is one.
private struct RoomLabel: View {
  let room: String

  var body: some View {
    if !room.isEmpty {
      Label(room, systemImage: "mappin.and.ellipse")
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
  }
}

/// What follows, on a soft panel of its own so it reads as secondary to the
/// lesson above it.
private struct NextRow: View {
  let title: String
  let room: String
  let start: Date?

  /// "MAA12.05 (Yrityskylä)": where the next lesson is, as well as what.
  private var label: String {
    room.isEmpty ? title : "\(title) (\(room))"
  }

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: "arrow.turn.down.right")
        .font(.caption.weight(.bold))
        .foregroundStyle(accent)
      Text("Seuraavaksi")
        .foregroundStyle(.secondary)
      Text(label)
        .fontWeight(.semibold)
        .lineLimit(1)
        // Shrinks a little before it truncates, so a room name that only just
        // misses fitting is still read in full.
        .minimumScaleFactor(0.8)
        .truncationMode(.tail)
      Spacer(minLength: 6)
      if let start {
        // The time is kept whole; a long room name gives way first.
        Text(start, style: .time)
          .monospacedDigit()
          .fontWeight(.medium)
          .foregroundStyle(accent)
          .layoutPriority(1)
      }
    }
    .font(.footnote)
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .background(Color.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

/// The big number on the right: time left in the lesson, or — in a free
/// period — time until the next one starts.
private struct CountdownBlock: View {
  let resolved: LessonActivityAttributes.ContentState.Resolved
  /// The Dynamic Island passes less of each.
  var fontSize: CGFloat = 30
  var maxWidth: CGFloat = 140

  var body: some View {
    if let current = resolved.current {
      block(date: current.endDate, caption: "jäljellä")
    } else if let next = resolved.next {
      block(date: next.startDate, caption: "alkuun")
    }
  }

  private func block(date: Date, caption: String) -> some View {
    VStack(alignment: .trailing, spacing: 0) {
      countdown(to: date)
        .font(.system(size: fontSize, weight: .bold, design: .rounded))
        .foregroundStyle(accent)
        .minimumScaleFactor(0.7)
        .lineLimit(1)
        // A timer Text fills whatever width it is given and sets its digits
        // from the leading edge, which left them floating away from the
        // caption beneath. Right-align them in the space they take.
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: .infinity, alignment: .trailing)
      Text(caption)
        .font(.caption2.weight(.medium))
        .foregroundStyle(.secondary)
    }
    // Capped rather than `fixedSize()`: a timer Text asks for more width than
    // its digits need, and left unbounded it pushed the row wider than the
    // card, so the title and the countdown ran into its edges.
    .frame(minWidth: 88, maxWidth: maxWidth, alignment: .trailing)
  }
}

private struct LessonActivityView: View {
  let state: LessonActivityAttributes.ContentState
  let dayLabel: String

  var body: some View {
    // Worked out here, at draw time, so a card iOS redraws after a lesson has
    // ended shows the lesson that followed it.
    let resolved = state.resolved(at: Date.now)
    let hasCurrent = resolved.current != nil

    // Kept under the 160pt a Lock Screen activity is allowed.
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          HStack(spacing: 6) {
            if hasCurrent { NowBadge() }
            Text(dayLabel)
              .font(.caption.weight(.semibold))
              .foregroundStyle(.secondary)
          }

          if let current = resolved.current {
            Text(current.title)
              .font(.title3.weight(.bold))
              .lineLimit(1)
              .minimumScaleFactor(0.8)
            RoomLabel(room: current.room)
          } else {
            Text(resolved.dayOver ? "Koulupäivä päättyi" : "Ei tuntia nyt")
              .font(.title3.weight(.bold))
              .foregroundStyle(.secondary)
          }
        }
        // First call on the row's width, so the title keeps what it needs and
        // the countdown takes the rest, instead of the two splitting it evenly.
        .layoutPriority(1)

        Spacer(minLength: 0)

        CountdownBlock(resolved: resolved)
      }

      if let current = resolved.current {
        LessonProgress(start: current.startDate, end: current.endDate)
      }

      if let next = resolved.next {
        NextRow(title: next.title, room: next.room, start: next.startDate)
      }
    }
    // Held to the card's width before the padding goes on, so nothing inside
    // can be wider than the space the padding leaves.
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 20)
    .padding(.vertical, 14)
  }
}

struct LessonActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LessonActivityAttributes.self) { context in
      // Dark when the app says so, and when it has not said anything — an older
      // app's update — as that is how the card has always looked.
      let dark = context.state.isDark ?? true
      LessonActivityView(state: context.state, dayLabel: context.attributes.dayLabel)
        // Set here so `.primary`, `.secondary` and the panel tint inside all
        // follow the appearance chosen, not whatever iOS reports.
        .environment(\.colorScheme, dark ? .dark : .light)
        .activityBackgroundTint(dark ? cardBackgroundDark : cardBackgroundLight)
        .activitySystemActionForegroundColor(accent)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          let resolved = context.state.resolved(at: Date.now)
          VStack(alignment: .leading, spacing: 2) {
            Text(resolved.current?.title ?? (resolved.dayOver ? "Päivä päättyi" : "Ei tuntia"))
              .font(.headline.weight(.bold))
              .lineLimit(1)
            RoomLabel(room: resolved.current?.room ?? "")
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          CountdownBlock(resolved: context.state.resolved(at: Date.now), fontSize: 20, maxWidth: 90)
        }
        DynamicIslandExpandedRegion(.bottom) {
          let resolved = context.state.resolved(at: Date.now)
          VStack(spacing: 8) {
            if let current = resolved.current {
              LessonProgress(start: current.startDate, end: current.endDate)
            }
            if let next = resolved.next {
              NextRow(title: next.title, room: next.room, start: next.startDate)
            }
          }
        }
      } compactLeading: {
        Image(systemName: "graduationcap.fill")
          .foregroundStyle(accent)
      } compactTrailing: {
        if let current = context.state.resolved(at: Date.now).current {
          countdown(to: current.endDate)
            .frame(maxWidth: 44)
            .foregroundStyle(accent)
        }
      } minimal: {
        Image(systemName: "graduationcap.fill")
          .foregroundStyle(accent)
      }
      .keylineTint(accent)
    }
  }
}

@main
struct LessonActivityBundle: WidgetBundle {
  var body: some Widget {
    LessonActivity()
  }
}
