declare module "react-simple-maps" {
  import type React from "react";

  export interface GeographyProps {
    key?: string;
    geography?: unknown;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: React.CSSProperties & { default?: React.CSSProperties; hover?: React.CSSProperties; pressed?: React.CSSProperties };
    onClick?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
    onMouseEnter?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
    className?: string;
  }

  export const Geography: React.FC<GeographyProps>;

  export interface GeographiesProps {
    geography?: string | unknown;
    children?: (props: {
      geographies: unknown[];
      paths: unknown[];
      outline: unknown;
    }) => React.ReactNode;
  }

  export const Geographies: React.FC<GeographiesProps>;

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    className?: string;
    children?: React.ReactNode;
    data?: unknown;
  }

  export const ComposableMap: React.FC<ComposableMapProps>;

  export const Marker: React.FC<{ coordinates: [number, number]; children?: React.ReactNode; className?: string }>;
  export const ZoomableGroup: React.FC<{ center?: [number, number]; zoom?: number; children?: React.ReactNode }>;
  export const Sphere: React.FC<{ id?: string; strokeWidth?: number; stroke?: string; fill?: string }>;
  export const Annotation: React.FC<{ subject: [number, number]; dx?: number; dy?: number; children?: React.ReactNode }>;
  export const useZoomPan: () => unknown;
}
