// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "NoBrainrotKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "NoBrainrotKit", targets: ["NoBrainrotKit"]),
    ],
    targets: [
        // Sources/NoBrainrotKit/ContractData.swift and the test vectors are generated
        // from the TypeScript extension: run `pnpm ios:contract` in the repository root.
        .target(name: "NoBrainrotKit"),
        .testTarget(
            name: "NoBrainrotKitTests",
            dependencies: ["NoBrainrotKit"],
            resources: [.process("Resources")]
        ),
    ]
)
