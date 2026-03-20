import React from "react";

interface CurrencyLogoProps {
  className?: string;
}

export const CurrencyLogo: React.FC<CurrencyLogoProps> = ({ className = "h-4" }) => (
  <img
    src="/images/omani-rial.png"
    alt="OMR"
    className={`inline-block ${className}`}
  />
);
