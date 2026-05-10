function errorName(error: unknown) {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name?: unknown }).name
    if (typeof name === "string") return name
  }

  return ""
}

export function microphoneErrorMessage(error: unknown) {
  switch (errorName(error)) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow microphone access in the browser site settings, then try again."
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found. Connect or select a microphone, then try again."
    case "NotReadableError":
    case "TrackStartError":
      return "The microphone is already in use or blocked by the system. Close other voice apps or check macOS microphone privacy settings, then try again."
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "The selected microphone settings are not available. Try another microphone input."
    case "AbortError":
      return "The browser could not start the microphone. Try again."
    default:
      return "Could not start the microphone. Check browser and macOS microphone permissions, then try again."
  }
}
