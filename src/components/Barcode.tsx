import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  lineColor?: string;
  background?: string;
  className?: string;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  width = 1.8,
  height = 55,
  displayValue = true,
  fontSize = 13,
  lineColor = '#0f172a',
  background = 'transparent',
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue,
          font: 'JetBrains Mono, monospace',
          fontSize,
          fontOptions: '600',
          textMargin: 6,
          lineColor,
          background,
          margin: 0,
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [value, width, height, displayValue, fontSize, lineColor, background]);

  return (
    <div className={`sdl-barcode-container ${className}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg ref={svgRef} />
    </div>
  );
};
