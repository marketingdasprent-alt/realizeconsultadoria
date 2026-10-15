// Símbolos dos fornecedores de email (desenhos simplificados, só para identificar a escolha).
import React from 'react';

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
    {children}
  </svg>
);

export const GmailLogo: React.FC = () => (
  <Svg>
    <path fill="#4285F4" d="M7 40h7V23L4 16v21a3 3 0 0 0 3 3z" />
    <path fill="#34A853" d="M34 40h7a3 3 0 0 0 3-3V16l-10 7z" />
    <path fill="#FBBC04" d="M34 10v13l10-7v-4c0-3.7-4.2-5.8-7.2-3.6z" />
    <path fill="#EA4335" d="M14 23V10l10 7.5L34 10v13l-10 7.5z" />
    <path fill="#C5221F" d="M4 12v4l10 7V10l-2.8-2.1C8.2 5.7 4 7.8 4 12z" />
  </Svg>
);

export const OutlookLogo: React.FC = () => (
  <Svg>
    <rect x="6" y="6" width="36" height="36" rx="7" fill="#0F6CBD" />
    <ellipse cx="24" cy="24" rx="8" ry="9.5" fill="none" stroke="#fff" strokeWidth="4.5" />
  </Svg>
);

export const ICloudLogo: React.FC = () => (
  <Svg>
    <defs>
      <linearGradient id="rz-icloud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7DD3FC" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <path
      fill="url(#rz-icloud)"
      d="M14 36a8 8 0 0 1-1.2-15.9A11 11 0 0 1 34 17.5 9.5 9.5 0 0 1 35 36z"
    />
  </Svg>
);

export const Office365Logo: React.FC = () => (
  <Svg>
    <path fill="#EB3C00" d="M9 13 28 6l11 4v28l-11 4-19-7 19 3V12L16 15v15l-7 3z" />
  </Svg>
);

export const ExchangeLogo: React.FC = () => (
  <Svg>
    <rect x="6" y="6" width="36" height="36" rx="7" fill="#0A64C4" />
    <path fill="#fff" d="M17 14h14v4h-9.5v4H30v4h-8.5v4H31v4H17z" />
  </Svg>
);

export const YahooLogo: React.FC = () => (
  <Svg>
    <text
      x="24"
      y="36"
      textAnchor="middle"
      fontFamily="Arial Black, Arial"
      fontWeight="900"
      fontSize="28"
      fill="#6001D2"
    >
      y!
    </text>
  </Svg>
);

export const AolLogo: React.FC = () => (
  <Svg>
    <text
      x="24"
      y="31"
      textAnchor="middle"
      fontFamily="Arial Black, Arial"
      fontWeight="900"
      fontSize="17"
      fill="#3D7BE6"
    >
      Aol.
    </text>
  </Svg>
);

export const CustomLogo: React.FC = () => (
  <Svg>
    <rect x="6" y="11" width="36" height="26" rx="5" fill="#8B5CF6" />
    <path
      d="m8 14 16 12 16-12"
      fill="none"
      stroke="#fff"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
  </Svg>
);
