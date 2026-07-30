import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}
function Solid({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.25 9.25h3l1 1.75h3.5l1-1.75h3" />
      <path d="M2.25 9.25 3.9 3.6a1.2 1.2 0 0 1 1.15-.85h5.9a1.2 1.2 0 0 1 1.15.85l1.65 5.65v2.55a1.2 1.2 0 0 1-1.2 1.2H3.45a1.2 1.2 0 0 1-1.2-1.2z" />
    </Glyph>
  );
}

export function IconSent(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13.75 2.25 7.4 8.6" />
      <path d="M13.75 2.25 9.7 13.75l-2.3-5.15-5.15-2.3z" />
    </Glyph>
  );
}

export function IconSchedule(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 4.75V8l2.25 1.5" />
    </Glyph>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.75 4.25h10.5" />
      <path d="M6.25 4.25v-1.5h3.5v1.5" />
      <path d="M4.25 4.25l.6 8.15a1.2 1.2 0 0 0 1.2 1.1h3.9a1.2 1.2 0 0 0 1.2-1.1l.6-8.15" />
    </Glyph>
  );
}

export function IconAperture(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <circle cx="8" cy="8" r="2.4" />
    </Glyph>
  );
}

export function IconBrief(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.75 4.25h10.5M2.75 8h7.5M2.75 11.75h4.25" />
    </Glyph>
  );
}

export function IconBuddy(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.75 5.5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 2 2v3.75a2 2 0 0 1-2 2H7.1L4.4 13.4v-2.15a2 2 0 0 1-1.65-1.97z" />
      <path d="M6.25 7.4h.01M9.75 7.4h.01" />
    </Glyph>
  );
}

export function IconNudge(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 6.75a4 4 0 0 1 8 0v2.6l1.1 1.9H2.9L4 9.35z" />
      <path d="M6.4 11.25a1.6 1.6 0 0 0 3.2 0" />
    </Glyph>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" />
      <path d="M2.25 6.5h11.5" />
      <path d="M5.5 2v2.25M10.5 2v2.25" />
    </Glyph>
  );
}
export function IconBolt(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M9.4 1.5a.45.45 0 0 1 .8.36l-.72 4.09h3.13c.4 0 .61.47.35.77l-6.36 7.28a.45.45 0 0 1-.79-.36l.72-4.09H3.4a.46.46 0 0 1-.35-.77z" />
    </Solid>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7.3 2.25H3.45a1.2 1.2 0 0 0-1.2 1.2V7.3a1.2 1.2 0 0 0 .35.85l5.25 5.25a1.2 1.2 0 0 0 1.7 0l3.85-3.85a1.2 1.2 0 0 0 0-1.7L8.15 2.6a1.2 1.2 0 0 0-.85-.35z" />
      <path d="M5.15 5.15h.01" />
    </Glyph>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M5.6 8.15 7.25 9.8l3.15-3.6" />
    </Glyph>
  );
}

export function IconClock(props: IconProps) {
  return <IconSchedule {...props} />;
}

export function IconXCircle(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M6.1 6.1 9.9 9.9M9.9 6.1 6.1 9.9" />
    </Glyph>
  );
}

export function IconFlask(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6.4 2.25v4.1L2.9 11.6a1.2 1.2 0 0 0 1 1.9h8.2a1.2 1.2 0 0 0 1-1.9L9.6 6.35v-4.1" />
      <path d="M5.5 2.25h5M4.9 9.75h6.2" />
    </Glyph>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 6.25 8 9.75l3.5-3.5" />
    </Glyph>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13.25 8a5.25 5.25 0 1 1-1.6-3.78" />
      <path d="M13.4 2.6v3.1h-3.1" />
    </Glyph>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="7.2" cy="7.2" r="4.45" />
      <path d="M10.5 10.5l3 3" />
    </Glyph>
  );
}

export function IconReply(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6.25 3.25 2.5 7l3.75 3.75" />
      <path d="M2.5 7h6.25a4.75 4.75 0 0 1 4.75 4.75v1" />
    </Glyph>
  );
}

export function IconForward(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9.75 3.25 13.5 7l-3.75 3.75" />
      <path d="M13.5 7H7.25a4.75 4.75 0 0 0-4.75 4.75v1" />
    </Glyph>
  );
}

export function IconCalendarPlus(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13.75 7.5V5.25a2 2 0 0 0-2-2h-7.5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h4.25" />
      <path d="M2.25 7.5h11.5M5.5 2v2.25M10.5 2v2.25" />
      <path d="M11.75 9.75v4M9.75 11.75h4" />
    </Glyph>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Glyph>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.75 3.75h10.5L9.4 8.3v4.35L6.6 13.9V8.3z" />
    </Glyph>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.5 4.75h3.25M8.75 4.75h4.75M2.5 11.25h4.75M10.25 11.25h3.25" />
      <circle cx="7.25" cy="4.75" r="1.6" />
      <circle cx="8.75" cy="11.25" r="1.6" />
    </Glyph>
  );
}

export function IconCompose(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9.4 3.1l3.5 3.5" />
      <path d="M10.75 1.75a1.6 1.6 0 0 1 2.25 0l1.25 1.25a1.6 1.6 0 0 1 0 2.25l-7.4 7.4-3.6.85.85-3.6z" />
    </Glyph>
  );
}
