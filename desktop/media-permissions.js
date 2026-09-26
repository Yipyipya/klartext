function requestedMediaTypes(details = {}) {
  if (Array.isArray(details.mediaTypes)) return details.mediaTypes;
  if (typeof details.mediaType === "string") return [details.mediaType];
  return [];
}

function isLocalFileUrl(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "file:" && !url.hostname;
  } catch {
    return false;
  }
}

function isTrustedAudioPermission(webContents, permission, origin, details, trustedContents) {
  if (!webContents || permission !== "media") return false;
  const trusted = trustedContents().filter(Boolean);
  if (!trusted.includes(webContents)) return false;
  if (details?.isMainFrame === false) return false;
  if (!isLocalFileUrl(origin) || !isLocalFileUrl(webContents.getURL?.())) return false;
  const mediaTypes = requestedMediaTypes(details);
  return mediaTypes.length > 0 && mediaTypes.every((mediaType) => mediaType === "audio");
}

function configureMediaPermissions(session, trustedContents) {
  session.setPermissionCheckHandler((webContents, permission, origin, details) => (
    isTrustedAudioPermission(webContents, permission, origin, details, trustedContents)
  ));
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl || details?.securityOrigin || "";
    callback(isTrustedAudioPermission(webContents, permission, origin, details, trustedContents));
  });
}

module.exports = {
  configureMediaPermissions,
  isTrustedAudioPermission,
  isLocalFileUrl,
  requestedMediaTypes,
};
