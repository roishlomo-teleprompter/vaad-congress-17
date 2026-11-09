import UIKit
import Capacitor
import GoogleSignIn

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { true }
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        if GIDSignIn.sharedInstance.handle(url) { return true }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }
    func application(_ application: UIApplication, continue activity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        ApplicationDelegateProxy.shared.application(application, continue: activity, restorationHandler: restorationHandler)
    }
}

@objc(KabclickViewController)
class KabclickViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(KabclickNativePlugin())
    }
}

@objc(KabclickNativePlugin)
public class KabclickNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KabclickNativePlugin"
    public let jsName = "KabclickNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExternal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise)
    ]
    private var authorizationInProgress = false
    private let allowedScopes: Set<String> = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/gmail.send"
    ]
    @objc func authorize(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let presenter = self.bridge?.viewController else {
                call.reject("Cannot present Google authorization"); return
            }
            guard !self.authorizationInProgress else { call.reject("Authorization already in progress"); return }
            guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
                  clientID.hasSuffix(".apps.googleusercontent.com"), !clientID.contains("REPLACE") else {
                call.reject("יש להגדיר לקוח Google OAuth מסוג iOS לפני ההתחברות. ראו README-HE.md"); return
            }
            let scopes = (call.getString("scope") ?? "").split(whereSeparator: { $0.isWhitespace }).map(String.init)
            guard !scopes.isEmpty, Set(scopes).isSubset(of: self.allowedScopes) else {
                call.reject("Unsupported Google authorization scopes"); return
            }
            self.authorizationInProgress = true
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            let forceSelection = call.getBool("forceSelection") ?? false
            if forceSelection {
                GIDSignIn.sharedInstance.signOut()
                self.signIn(call, scopes: scopes, presenter: presenter, hint: nil)
            } else if let user = GIDSignIn.sharedInstance.currentUser {
                self.authorizeUser(user, call: call, scopes: scopes, presenter: presenter)
            } else if GIDSignIn.sharedInstance.hasPreviousSignIn() {
                GIDSignIn.sharedInstance.restorePreviousSignIn { [weak self] user, _ in
                    DispatchQueue.main.async {
                        guard let self = self else { return }
                        if let user = user { self.authorizeUser(user, call: call, scopes: scopes, presenter: presenter) }
                        else { self.signIn(call, scopes: scopes, presenter: presenter, hint: call.getString("accountEmail")) }
                    }
                }
            } else {
                self.signIn(call, scopes: scopes, presenter: presenter, hint: call.getString("accountEmail"))
            }
        }
    }
    private func signIn(_ call: CAPPluginCall, scopes: [String], presenter: UIViewController, hint: String?) {
        GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: hint, additionalScopes: scopes) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard let user = result?.user, error == nil else { self.fail(call, error); return }
                self.finish(user, call: call)
            }
        }
    }
    private func authorizeUser(_ user: GIDGoogleUser, call: CAPPluginCall, scopes: [String], presenter: UIViewController) {
        let missing = Set(scopes).subtracting(Set(user.grantedScopes ?? []))
        if missing.isEmpty { finish(user, call: call); return }
        user.addScopes(Array(missing), presenting: presenter) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard let updated = result?.user, error == nil else { self.fail(call, error); return }
                self.finish(updated, call: call)
            }
        }
    }
    private func finish(_ user: GIDGoogleUser, call: CAPPluginCall) {
        user.refreshTokensIfNeeded { [weak self] refreshed, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard let refreshed = refreshed, error == nil else { self.fail(call, error); return }
                self.authorizationInProgress = false
                let expires = refreshed.accessToken.expirationDate?.timeIntervalSinceNow ?? 3500
                call.resolve(["access_token": refreshed.accessToken.tokenString,
                              "expires_in": max(1, Int(expires)),
                              "scope": (refreshed.grantedScopes ?? []).joined(separator: " ")])
            }
        }
    }
    private func fail(_ call: CAPPluginCall, _ error: Error?) {
        authorizationInProgress = false
        call.reject(error?.localizedDescription ?? "Google authorization cancelled or failed")
    }
    @objc func openExternal(_ call: CAPPluginCall) {
        guard let text = call.getString("url"), let url = URL(string: text),
              ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") else {
            call.reject("Unsupported URL"); return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("Cannot open link on this device") }
            }
        }
    }
    @objc func shareFile(_ call: CAPPluginCall) {
        guard let encoded = call.getString("data"), let data = Data(base64Encoded: encoded) else {
            call.reject("Invalid file data"); return
        }
        let name = URL(fileURLWithPath: call.getString("name") ?? "receipt.pdf").lastPathComponent
        guard !name.isEmpty, name != ".", name != ".." else { call.reject("Invalid filename"); return }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let file = dir.appendingPathComponent(name)
            try data.write(to: file, options: .atomic)
            DispatchQueue.main.async { [weak self] in
                guard let presenter = self?.bridge?.viewController else { call.reject("Cannot present sharing"); return }
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = presenter.view
                sheet.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                sheet.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: dir)
                    if let error = error { call.reject(error.localizedDescription) }
                    else if completed { call.resolve() }
                    else { call.reject("Sharing cancelled", "SHARE_CANCELLED") }
                }
                presenter.present(sheet, animated: true)
            }
        } catch { call.reject("Cannot prepare PDF for sharing") }
    }
}
