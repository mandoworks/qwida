type IconProps = { size?: number; className?: string };
const base = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export function Mic({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M5 10v2a7 7 0 0 0 14 0v-2" /><path d="M12 19v3" /></svg>;
}
export function Camera({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
}
export function Card({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8.5" cy="11" r="2.2" /><path d="M5 16c.6-1.6 1.9-2.4 3.5-2.4S11.4 14.4 12 16" /><path d="M15 9.5h4M15 13h4" /></svg>;
}
export function Phone({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>;
}
export function Play({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M8 5.5v13l11-6.5z" /></svg>;
}
export function Speaker({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 6a9 9 0 0 1 0 12" /></svg>;
}
export function Check({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M4.5 12.5 9.5 17.5 19.5 7" /></svg>;
}
export function Seal({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>;
}
export function X({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
export function ChevronRight({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M9 5l7 7-7 7" /></svg>;
}
export function ChevronLeft({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M15 5 8 12l7 7" /></svg>;
}
export function ChevronDown({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M5 9l7 7 7-7" /></svg>;
}
export function Alert({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M10.3 4.3 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v5" /><path d="M12 17.5h.01" /></svg>;
}
export function Fence({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M12 2 4 5.5v6c0 5 3.4 9.2 8 10.5 4.6-1.3 8-5.5 8-10.5v-6z" /></svg>;
}
export function Pill({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M10.5 20.5a5 5 0 0 1-7-7l7-7a5 5 0 0 1 7 7z" /><path d="M8.5 8.5l7 7" /></svg>;
}
export function Calendar({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
}
export function Clock({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
}
export function Pencil({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><path d="M14 6l3 3" /></svg>;
}
export function Copy({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>;
}
export function Message({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M21 11.5a8.5 8.5 0 0 1-12 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" /></svg>;
}
export function Filter({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg>;
}
export function Refresh({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M20.5 11a8.5 8.5 0 1 1-2.5-6" /><path d="M20 4v7h-7" /></svg>;
}
export function Eye({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}
export function ImageIcon({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="M3 17l5-5 4 4 3-3 6 6" /></svg>;
}
export function Users({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="8.5" r="2.8" /><path d="M16 14.5a5.5 5.5 0 0 1 5.5 5.5" /></svg>;
}
export function Mail({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
}
export function Download({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M12 3v12" /><path d="M7.5 11 12 15.5 16.5 11" /><path d="M4 19h16" /></svg>;
}
export function Globe({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></svg>;
}
export function Bell({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></svg>;
}
export function Plus({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M12 5v14M5 12h14" /></svg>;
}
export function Minus({ size = 24, className = "" }: IconProps) {
  return <svg {...base(size, className)}><path d="M5 12h14" /></svg>;
}
