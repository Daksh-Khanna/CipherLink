// Deliberately excludes SDP, addresses, identifiers and captured audio/video.
// Enabled only by EXPO_PUBLIC_CALL_DIAGNOSTICS=true during a diagnostic build.
export function audioDiagnostics(reports: { forEach: (visit: (entry: any) => void) => void }) {
  const summary = { sentBytes: 0, sentPackets: 0, receivedBytes: 0, receivedPackets: 0, localLevel: 0, receivedLevel: 0, concealedSamples: 0 };
  reports.forEach(entry => {
    if ((entry.kind || entry.mediaType) !== 'audio') return;
    if (entry.type === 'outbound-rtp') { summary.sentBytes += entry.bytesSent || 0; summary.sentPackets += entry.packetsSent || 0; }
    if (entry.type === 'inbound-rtp') {
      summary.receivedBytes += entry.bytesReceived || 0; summary.receivedPackets += entry.packetsReceived || 0;
      summary.receivedLevel = Math.max(summary.receivedLevel, entry.audioLevel || 0);
      summary.concealedSamples += entry.concealedSamples || 0;
    }
    if (entry.type === 'media-source') summary.localLevel = Math.max(summary.localLevel, entry.audioLevel || 0);
  });
  return summary;
}
