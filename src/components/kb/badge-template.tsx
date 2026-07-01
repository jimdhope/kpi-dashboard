import React from 'react';

export interface BadgeTemplateProps {
  ICON: string;
  BADGE_NAME: string;
  COMPETITION_NAME?: string;
  DATE?: string;
  POSITION?: string;
  STREAK?: string;
  MONTH?: string;
  YEAR?: string;
  agentName?: string;
  type: 'bronze' | 'silver' | 'gold' | 'platinum';
  iconColor: string;
  glowColor: string;
}

export const BadgeTemplate: React.FC<BadgeTemplateProps> = ({
  ICON,
  BADGE_NAME,
  COMPETITION_NAME,
  DATE,
  POSITION,
  STREAK,
  MONTH,
  YEAR,
  agentName,
  type,
  iconColor,
  glowColor,
}) => {
  const metals = {
    bronze: { bg: 'linear-gradient(to bottom right, #cd7f32, #8b5a2b, #cd7f32)', border: '#5c3a21' },
    silver: { bg: 'linear-gradient(to bottom right, #e0e0e0, #9e9e9e, #ffffff, #9e9e9e)', border: '#616161' },
    gold: { bg: 'linear-gradient(to bottom right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)', border: '#825a13' },
    platinum: { bg: 'linear-gradient(to bottom right, #e5e4e2, #b0c4de, #e5e4e2, #778899)', border: '#4a5d73' },
  };

  const style = metals[type] || metals.gold;
  const hasDate = MONTH && YEAR;

  const defaultGlow = { bronze: '#b45309', silver: '#94a3b8', gold: '#f59e0b', platinum: '#6366f1' };
  const effectiveGlow = glowColor || defaultGlow[type] || defaultGlow.gold;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 1200,
        height: 1200,
        background: style.bg,
        borderRadius: '24px 180px 24px 180px',
        padding: 40,
        border: `10px solid ${style.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          border: '4px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '16px 160px 16px 160px',
          padding: '40px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Highlight Gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)',
            borderRadius: '16px 160px 0 0',
          }}
        />

        {/* === TOP SECTION: Name + Competition === */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              color: '#ffffff',
              fontSize: 100,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '4px',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            {BADGE_NAME}
          </div>

          {COMPETITION_NAME && (
            <div
              style={{
                color: iconColor,
                fontSize: 50,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '8px',
                textAlign: 'center',
                marginTop: 16,
              }}
            >
              {COMPETITION_NAME}
            </div>
          )}
        </div>

        {/* === MIDDLE SECTION: Icon + Position (centered) === */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 320,
              height: 320,
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderRadius: '50%',
              border: `6px solid ${effectiveGlow}`,
              position: 'relative',
            }}
          >
            <div style={{ fontSize: 160 }}>{ICON}</div>
            {POSITION && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  }}
                >
                  {/* Number with black outline */}
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <div style={{ position: 'absolute', top: -4, left: -4, fontSize: 72, fontWeight: 900, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(0, -2)}</div>
                    <div style={{ position: 'absolute', top: -4, left: 4, fontSize: 72, fontWeight: 900, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(0, -2)}</div>
                    <div style={{ position: 'absolute', top: 4, left: -4, fontSize: 72, fontWeight: 900, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(0, -2)}</div>
                    <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 72, fontWeight: 900, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(0, -2)}</div>
                    <div style={{ position: 'relative', fontSize: 72, fontWeight: 900, color: '#ffffff' }}>{POSITION.slice(0, -2)}</div>
                  </div>

                  {/* Suffix with black outline */}
                  <div style={{ position: 'relative', display: 'flex', marginTop: 8 }}>
                    <div style={{ position: 'absolute', top: -3, left: -3, fontSize: 38, fontWeight: 700, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(-2)}</div>
                    <div style={{ position: 'absolute', top: -3, left: 3, fontSize: 38, fontWeight: 700, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(-2)}</div>
                    <div style={{ position: 'absolute', top: 3, left: -3, fontSize: 38, fontWeight: 700, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(-2)}</div>
                    <div style={{ position: 'absolute', top: 3, left: 3, fontSize: 38, fontWeight: 700, color: 'rgba(0,0,0,0.85)' }}>{POSITION.slice(-2)}</div>
                    <div style={{ position: 'relative', fontSize: 38, fontWeight: 700, color: '#ffffff' }}>{POSITION.slice(-2)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === BOTTOM SECTION: Agent → Streak → Date === */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {agentName && (
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: '#f1f5f9',
                textTransform: 'uppercase',
                letterSpacing: '6px',
                textAlign: 'center',
              }}
            >
              {agentName}
            </div>
          )}

          {STREAK && (
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                fontWeight: 700,
                color: '#fbbf24',
                marginTop: 16,
                letterSpacing: '1px',
              }}
            >
              🔥 {STREAK} Streak!
            </div>
          )}

          {(hasDate || DATE) && (
            <div
              style={{
                fontSize: 36,
                fontWeight: 400,
                color: '#94a3b8',
                letterSpacing: '2px',
                marginTop: 12,
              }}
            >
              {hasDate ? `${MONTH} ${YEAR}` : DATE}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
