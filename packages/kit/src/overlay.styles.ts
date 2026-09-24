export const OVERLAY_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 0 },
  elevation: 2,
} as const;

export const OVERLAY_DROP_SHADOW = `drop-shadow(${OVERLAY_SHADOW.shadowOffset.width}px ${OVERLAY_SHADOW.shadowOffset.height}px ${OVERLAY_SHADOW.shadowRadius / 2}px rgba(0, 0, 0, ${OVERLAY_SHADOW.shadowOpacity}))`;
