import Foundation
import Testing
@testable import NoBrainrotKit

@Suite("Status")
struct StatusTests {
    let now = Date(timeIntervalSince1970: 1_700_000_000)
    let hour: TimeInterval = 3600

    private func contact(
        pageAgo: TimeInterval? = 1 * 3600,
        contactAgo: TimeInterval = 1 * 3600,
        siteAccess: [String: SiteAccess] = ["m.youtube.com": .granted, "www.youtube.com": .granted],
        extensionSettings: Int64 = 0,
        delivered: Int64 = 0
    ) -> ContactRecord {
        ContactRecord(
            lastContactAt: now.addingTimeInterval(-contactAgo),
            extensionVersion: "0.2.0",
            siteAccess: siteAccess,
            lastPageAt: pageAgo.map { now.addingTimeInterval(-$0) },
            lastPageHost: pageAgo == nil ? nil : "m.youtube.com",
            extensionSettingsUpdatedAt: extensionSettings,
            deliveredSettingsUpdatedAt: delivered
        )
    }

    private func report(
        _ contact: ContactRecord?,
        updatedAt: Int64 = 0,
        gate: Bool = false,
        app: Bool? = nil
    ) -> StatusReport {
        StatusReport.make(
            contact: contact,
            settings: StoredSettings(settings: .defaults(), updatedAt: updatedAt),
            gateMarkedSetUp: gate,
            youtubeAppInstalled: app,
            now: now
        )
    }

    @Test func neverHeardFromTheExtension() {
        let status = report(nil)
        #expect(status.extensionState == .neverSeen)
        #expect(status.level == .notSetUp)
    }

    @Test func recentPageMeansItWorked() {
        let status = report(contact(pageAgo: 3 * hour))
        #expect(status.extensionState == .ranRecently(at: now.addingTimeInterval(-3 * hour), host: "m.youtube.com"))
        #expect(status.level == .working)
    }

    @Test func aPageSeenLongAgoIsNotRecent() {
        let status = report(contact(pageAgo: StatusReport.recentWindow + 1))
        #expect(status.level == .needsAttention)
        guard case .quiet(let lastPage, _) = status.extensionState else {
            Issue.record("expected quiet")
            return
        }
        #expect(lastPage != nil)
    }

    @Test func aPageSeenJustInsideTheWindowIsRecent() {
        #expect(report(contact(pageAgo: StatusReport.recentWindow)).level == .working)
    }

    @Test func startedButNeverOnAPage() {
        let status = report(contact(pageAgo: nil))
        #expect(status.extensionState == .quiet(lastPage: nil, lastContact: now.addingTimeInterval(-hour)))
        #expect(status.level == .needsAttention)
    }

    @Test func missingSiteAccessOutranksARecentPage() {
        let status = report(contact(pageAgo: hour, siteAccess: ["m.youtube.com": .notGranted, "www.youtube.com": .granted]))
        #expect(status.extensionState == .siteAccessMissing(lastContact: now.addingTimeInterval(-hour)))
        #expect(status.level == .needsAttention)
        #expect(status.hostsWithoutAccess == ["m.youtube.com"])
    }

    @Test func unknownSiteAccessDoesNotBlockButIsSaid() {
        let status = report(contact(siteAccess: ["m.youtube.com": .unknown, "www.youtube.com": .unknown]))
        #expect(status.level == .working)
        #expect(status.hostsWithUnknownAccess == ["m.youtube.com", "www.youtube.com"])
        let copy = StatusCopy.make(from: status, relative: { _ in "just now" })
        #expect(copy.detail.contains("did not say"))
    }

    @Test func theDesktopSiteNotAllowedIsANoteNotAProblem() {
        let status = report(contact(siteAccess: ["m.youtube.com": .granted, "www.youtube.com": .notGranted]))
        #expect(status.level == .working)
        let copy = StatusCopy.make(from: status, relative: { _ in "just now" })
        #expect(copy.detail.contains("www.youtube.com"))
    }

    @Test func deliveryOfChangedRules() {
        #expect(report(contact(), updatedAt: 0).delivery == .defaultsInUse)
        #expect(report(nil, updatedAt: 10).delivery == .waiting)
        #expect(report(contact(extensionSettings: 5, delivered: 5), updatedAt: 10).delivery == .waiting)
        #expect(report(contact(extensionSettings: 5, delivered: 10), updatedAt: 10).delivery == .delivered)
        #expect(report(contact(extensionSettings: 10, delivered: 10), updatedAt: 10).delivery == .confirmed)
        #expect(report(contact(extensionSettings: 12, delivered: 12), updatedAt: 10).delivery == .confirmed)
    }

    @Test func keepsTheUsersOwnNotesApart() {
        let status = report(nil, gate: true, app: true)
        #expect(status.gateMarkedSetUp)
        #expect(status.youtubeAppInstalled == true)
    }

    @Test func wordsNeverClaimProtectionAndAlwaysSayWhatTheyDoNotCover() {
        let reports = [
            report(nil),
            report(contact()),
            report(contact(pageAgo: nil)),
            report(contact(pageAgo: StatusReport.recentWindow + 100)),
            report(contact(siteAccess: ["m.youtube.com": .notGranted])),
            report(contact(), updatedAt: 9),
        ]
        for status in reports {
            let copy = StatusCopy.make(from: status, relative: { _ in "3 hours ago" })
            let all = [copy.headline, copy.detail, copy.footnote, copy.deliveryLine ?? ""].joined(separator: " ").lowercased()
            #expect(!all.contains("protect"), "\(status)")
            #expect(!all.contains("blocked"), "\(status)")
            #expect(!all.contains("safe"), "\(status)")
            #expect(copy.footnote.contains("YouTube app"))
        }
    }

    @Test func wordsUseTheRelativeTime() {
        let copy = StatusCopy.make(from: report(contact(pageAgo: 3 * hour)), relative: { _ in "3 hours ago" })
        #expect(copy.headline == "Seen working in Safari 3 hours ago")
    }

    @Test func eachStateHasItsOwnHeadline() {
        let headlines = [
            report(nil),
            report(contact()),
            report(contact(pageAgo: nil)),
            report(contact(siteAccess: ["m.youtube.com": .notGranted])),
        ].map { StatusCopy.make(from: $0, relative: { _ in "x" }).headline }
        #expect(Set(headlines).count == headlines.count)
    }
}
