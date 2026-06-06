const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("@expo/config-plugins");
const {
  addBuildSourceFileToGroup,
  addFramework,
  ensureGroupRecursively,
  getProjectName,
} = require("@expo/config-plugins/build/ios/utils/Xcodeproj");

const MICROPHONE_PERMISSION =
  "TrueBPM utilise le micro pour identifier le morceau que tu écoutes.";

const SWIFT_SOURCE = `import AVFoundation
import Foundation
import ShazamKit

@objc(TrueBPMShazam)
class TrueBPMShazam: NSObject {
  private var recognitionTask: Task<Void, Never>?
  private var managedSession: Any?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(recognize:rejecter:)
  func recognize(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    if recognitionTask != nil {
      reject("ERR_SHAZAM_BUSY", "Une reconnaissance ShazamKit est déjà en cours.", nil)
      return
    }

    recognitionTask = Task { [weak self] in
      guard let self else { return }

      do {
        guard await self.requestMicrophonePermission() else {
          reject("ERR_MICROPHONE_DENIED", "Permission micro refusée.", nil)
          self.finishRecognition()
          return
        }

        try await self.activateAudioSession()

        if #available(iOS 17.0, *) {
          let session = SHManagedSession()
          self.managedSession = session

          var result = await session.result()

          if case .error(let error, _) = result, self.isMatchAttemptFailed(error) {
            try? await Task.sleep(nanoseconds: 700_000_000)
            result = await session.result()
          }

          await self.deactivateAudioSession()

          switch result {
          case .match(let match):
            guard let item = match.mediaItems.first else {
              resolve(self.noMatchPayload("Aucun morceau reconnu."))
              self.finishRecognition()
              return
            }

            resolve(self.matchPayload(from: item))
            self.finishRecognition()

          case .noMatch:
            resolve(self.noMatchPayload("Aucun morceau reconnu. Essaie avec un extrait plus clair."))
            self.finishRecognition()

          case .error(let error, _):
            if self.isMatchAttemptFailed(error) {
              resolve(self.noMatchPayload("ShazamKit n’a pas pu terminer cette tentative. Réessaie avec un extrait plus clair."))
              self.finishRecognition()
              return
            }

            reject("ERR_SHAZAM_RECOGNITION", error.localizedDescription, error)
            self.finishRecognition()

          @unknown default:
            reject("ERR_SHAZAM_UNKNOWN", "Résultat ShazamKit inconnu.", nil)
            self.finishRecognition()
          }
        } else {
          reject("ERR_SHAZAM_UNSUPPORTED", "La reconnaissance native ShazamKit nécessite iOS 17 ou plus récent.", nil)
          self.finishRecognition()
        }
      } catch {
        await self.deactivateAudioSession()
        reject("ERR_SHAZAM_RECOGNITION", error.localizedDescription, error)
        self.finishRecognition()
      }
    }
  }

  @objc
  func cancel() {
    recognitionTask?.cancel()
    recognitionTask = nil

    if #available(iOS 17.0, *), let session = managedSession as? SHManagedSession {
      session.cancel()
    }

    managedSession = nil

    Task {
      await deactivateAudioSession()
    }
  }

  private func finishRecognition() {
    recognitionTask = nil
    managedSession = nil
  }

  private func requestMicrophonePermission() async -> Bool {
    await withCheckedContinuation { continuation in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        continuation.resume(returning: granted)
      }
    }
  }

  private func activateAudioSession() async throws {
    try await MainActor.run {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.record, mode: .default, options: [.duckOthers])
      try audioSession.setActive(true, options: [])
    }
  }

  private func deactivateAudioSession() async {
    await MainActor.run {
      try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
  }

  private func isMatchAttemptFailed(_ error: Error) -> Bool {
    let nsError = error as NSError
    return nsError.domain == SHErrorDomain && nsError.code == SHError.Code.matchAttemptFailed.rawValue
  }

  @available(iOS 15.0, *)
  private func matchPayload(from item: SHMatchedMediaItem) -> [String: Any] {
    let fallbackId = [item.title, item.artist]
      .compactMap { $0 }
      .joined(separator: "-")

    var track: [String: Any] = [
      "entityType": "song",
      "entityId": item.appleMusicID ?? item.shazamID ?? fallbackId,
      "title": item.title ?? "",
      "artist": item.artist ?? item.subtitle ?? "",
      "album": item.subtitle ?? "",
      "previewUrl": NSNull(),
      "matchOffset": item.matchOffset
    ]

    if #available(iOS 18.4, *) {
      track["confidence"] = item.confidence
    }

    track["cover"] = item.artworkURL?.absoluteString ?? NSNull()
    track["songLink"] = item.appleMusicURL?.absoluteString ?? NSNull()
    track["shazamId"] = item.shazamID ?? NSNull()
    track["isrc"] = item.isrc ?? NSNull()
    track["genres"] = item.genres

    return [
      "matched": true,
      "provider": "shazamkit",
      "track": track
    ]
  }

  private func noMatchPayload(_ message: String) -> [String: Any] {
    [
      "matched": false,
      "provider": "shazamkit",
      "error": message
    ]
  }
}
`;

const OBJC_SOURCE = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TrueBPMShazam, NSObject)
RCT_EXTERN_METHOD(recognize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancel)
@end
`;

const BRIDGING_HEADER = `#import <React/RCTBridgeModule.h>
`;

function writeFileIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === contents) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function withTrueBPMShazam(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription || MICROPHONE_PERMISSION;
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot;
      const projectName = getProjectName(projectRoot);
      const nativeRoot = path.join(iosRoot, projectName);

      writeFileIfChanged(path.join(nativeRoot, "TrueBPMShazam.swift"), SWIFT_SOURCE);
      writeFileIfChanged(path.join(nativeRoot, "TrueBPMShazam.m"), OBJC_SOURCE);
      writeFileIfChanged(path.join(nativeRoot, `${projectName}-Bridging-Header.h`), BRIDGING_HEADER);

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = getProjectName(config.modRequest.projectRoot);
    const groupName = projectName;

    ensureGroupRecursively(project, groupName);
    addBuildSourceFileToGroup({
      filepath: `${projectName}/TrueBPMShazam.swift`,
      groupName,
      project,
    });
    addBuildSourceFileToGroup({
      filepath: `${projectName}/TrueBPMShazam.m`,
      groupName,
      project,
    });
    addFramework({
      project,
      projectName,
      framework: "ShazamKit.framework",
    });

    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(withTrueBPMShazam, "with-truebpm-shazam", "1.0.0");
