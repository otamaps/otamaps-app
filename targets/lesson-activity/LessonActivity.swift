import ActivityKit
import SwiftUI
import WidgetKit

/// Fixed brand colours. The extension cannot read the app's JS theme, so the
/// accent is repeated here from `constants/theme.ts`.
private let accent = Color(red: 0x34 / 255, green: 0x78 / 255, blue: 0xF5 / 255)

/// A relative countdown to `date`, e.g. "12 min". Live Activity views are only
/// re-rendered by the system on a content update, so a plain formatted string
/// would freeze — `Text(timerInterval:)` is one of the few things that keeps
/// ticking on its own.
private func countdown(to date: Date) -> some View {
  Text(timerInterval: Date.now...date, countsDown: true)
    .monospacedDigit()
}

private struct LessonActivityView: View {
  let state: LessonActivityAttributes.ContentState

  var body: some View {
    HStack(alignment: .center, spacing: 14) {
      VStack(alignment: .leading, spacing: 3) {
        if state.currentTitle.isEmpty {
          Text("Ei tuntia nyt")
            .font(.headline)
            .foregroundStyle(.secondary)
        } else {
          Text(state.currentTitle)
            .font(.headline)
            .lineLimit(1)
          if !state.currentRoom.isEmpty {
            Text(state.currentRoom)
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }

        if !state.nextTitle.isEmpty {
          HStack(spacing: 4) {
            Text("Seuraavaksi")
              .foregroundStyle(.secondary)
            Text(state.nextTitle)
              .fontWeight(.medium)
              .lineLimit(1)
            if let start = state.nextStartDate {
              Text(start, style: .time)
                .foregroundStyle(.secondary)
            }
          }
          .font(.caption)
          .padding(.top, 1)
        }
      }

      Spacer(minLength: 0)

      if let end = state.currentEndDate {
        VStack(alignment: .trailing, spacing: 1) {
          countdown(to: end)
            .font(.title3.weight(.semibold))
            .foregroundStyle(accent)
            .multilineTextAlignment(.trailing)
          Text("jäljellä")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .fixedSize()
      } else if let start = state.nextStartDate {
        VStack(alignment: .trailing, spacing: 1) {
          countdown(to: start)
            .font(.title3.weight(.semibold))
            .foregroundStyle(accent)
            .multilineTextAlignment(.trailing)
          Text("alkuun")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .fixedSize()
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }
}

struct LessonActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LessonActivityAttributes.self) { context in
      LessonActivityView(state: context.state)
        .activityBackgroundTint(nil)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.state.currentTitle.isEmpty ? "Ei tuntia" : context.state.currentTitle)
              .font(.headline)
              .lineLimit(1)
            if !context.state.currentRoom.isEmpty {
              Text(context.state.currentRoom)
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let end = context.state.currentEndDate {
            countdown(to: end)
              .font(.title3.weight(.semibold))
              .foregroundStyle(accent)
              .frame(maxWidth: 72)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if !context.state.nextTitle.isEmpty {
            HStack(spacing: 4) {
              Text("Seuraavaksi")
                .foregroundStyle(.secondary)
              Text(context.state.nextTitle)
                .fontWeight(.medium)
                .lineLimit(1)
              if let start = context.state.nextStartDate {
                Text(start, style: .time)
                  .foregroundStyle(.secondary)
              }
            }
            .font(.caption)
          }
        }
      } compactLeading: {
        Image(systemName: "graduationcap.fill")
          .foregroundStyle(accent)
      } compactTrailing: {
        if let end = context.state.currentEndDate {
          countdown(to: end)
            .frame(maxWidth: 44)
            .foregroundStyle(accent)
        }
      } minimal: {
        Image(systemName: "graduationcap.fill")
          .foregroundStyle(accent)
      }
    }
  }
}

@main
struct LessonActivityBundle: WidgetBundle {
  var body: some Widget {
    LessonActivity()
  }
}
