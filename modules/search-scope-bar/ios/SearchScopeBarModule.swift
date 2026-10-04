import ExpoModulesCore
import UIKit

/// Exposes `SearchScopeBarView` to React Native.
public class SearchScopeBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SearchScopeBar")

    View(SearchScopeBarView.self) {
      Events("onScopeChange")

      /// The segments, in order.
      Prop("titles") { (view: SearchScopeBarView, titles: [String]) in
        view.titles = titles
      }

      /// The selected segment's index.
      Prop("selectedIndex") { (view: SearchScopeBarView, index: Int) in
        view.selectedIndex = index
      }
    }
  }
}

/// Puts a selector *in* the navigation bar: the scope bar of the screen's own
/// search field — the segmented control UIKit draws beneath it, as Mail does
/// with All / Unread — kept permanently visible.
///
/// The bar belongs to react-native-screens, which creates the search
/// controller from `headerSearchBarOptions` and is its search bar's delegate.
/// It has no scope support, so this view finds that controller from the
/// screen it is mounted in, turns the scope bar on, and slips a forwarding
/// delegate in front of the screens one so scope changes can be reported
/// while every other delegate call still reaches it.
///
/// The view itself draws nothing and takes no space.
class SearchScopeBarView: ExpoView {
  let onScopeChange = EventDispatcher()

  var titles: [String] = [] {
    didSet { apply() }
  }

  var selectedIndex: Int = 0 {
    didSet { apply() }
  }

  private weak var searchBar: UISearchBar?
  private var proxy: ScopeDelegateProxy?
  private var retries = 0

  override func didMoveToWindow() {
    super.didMoveToWindow()
    retries = 0
    apply()
  }

  private func apply() {
    guard window != nil, !titles.isEmpty else { return }
    guard let controller = screenSearchController() else {
      // The screen's header may not have built its search controller yet.
      if retries < 20 {
        retries += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in self?.apply() }
      }
      return
    }

    let bar = controller.searchBar
    if bar.scopeButtonTitles != titles {
      bar.scopeButtonTitles = titles
    }
    if #available(iOS 16.0, *) {
      // Shown always, not only while the field is being searched in.
      controller.scopeBarActivation = .manual
    }
    bar.showsScopeBar = true
    if bar.selectedScopeButtonIndex != selectedIndex {
      bar.selectedScopeButtonIndex = selectedIndex
    }

    if searchBar !== bar || !(bar.delegate is ScopeDelegateProxy) {
      let proxy = ScopeDelegateProxy(original: bar.delegate) { [weak self] index in
        self?.onScopeChange(["index": index])
      }
      bar.delegate = proxy
      self.proxy = proxy
      searchBar = bar
    }
  }

  /// The search controller on the navigation item of the screen this view
  /// sits in: the nearest view controller up the responder chain that has one.
  private func screenSearchController() -> UISearchController? {
    var responder: UIResponder? = self
    while let current = responder {
      if let controller = current as? UIViewController,
        let search = controller.navigationItem.searchController
      {
        return search
      }
      responder = current.next
    }
    return nil
  }
}

/// Stands in as the search bar's delegate: reports scope changes, and hands
/// every delegate call — scope ones included — on to the delegate it replaced.
private final class ScopeDelegateProxy: NSObject, UISearchBarDelegate {
  private weak var original: UISearchBarDelegate?
  private let onScope: (Int) -> Void

  init(original: UISearchBarDelegate?, onScope: @escaping (Int) -> Void) {
    self.original = original
    self.onScope = onScope
  }

  func searchBar(_ searchBar: UISearchBar, selectedScopeButtonIndexDidChange selectedScope: Int) {
    onScope(selectedScope)
    original?.searchBar?(searchBar, selectedScopeButtonIndexDidChange: selectedScope)
  }

  override func responds(to aSelector: Selector!) -> Bool {
    super.responds(to: aSelector) || (original?.responds(to: aSelector) ?? false)
  }

  override func forwardingTarget(for aSelector: Selector!) -> Any? {
    original?.responds(to: aSelector) == true ? original : nil
  }
}
