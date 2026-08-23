interface IconProps {
  className?: string;
  strokeWidth?: number;
}

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: props.strokeWidth ?? 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: props.className ?? "w-5 h-5",
    "aria-hidden": true,
  };
}

export function PushDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4.5h16" />
      <path d="M7.5 2.5v4" />
      <path d="M16.5 2.5v4" />
      <circle cx="12" cy="9.5" r="2" />
      <path d="M10 12.2 8.6 6" />
      <path d="M14 12.2 15.4 6" />
      <path d="M12 11.8v4.4" />
      <path d="m12 16.2-2.4 5" />
      <path d="m12 16.2 2.4 5" />
    </svg>
  );
}

export function PullDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 4h19" />
      <path d="M10 11 9.5 3.4" />
      <path d="M14 11l.5-7.6" />
      <circle cx="12" cy="8.6" r="2" />
      <path d="M12 10.8V15" />
      <path d="M12 15l-2 5.4" />
      <path d="M12 15l2 5.4" />
    </svg>
  );
}

export function LegsDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 7.5h17" />
      <path d="M6.5 5.5v4" />
      <path d="M17.5 5.5v4" />
      <path d="M12 9.6v2.6" />
      <path d="M12 12.2 6 15.4" />
      <path d="M6 15.4 6.6 20.4" />
      <path d="M12 12.2 18 15.4" />
      <path d="M18 15.4 17.4 20.4" />
    </svg>
  );
}

export function CardioDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M5.5 17 9 10h6" />
      <path d="m12 10 3.5 7" />
      <path d="M13.5 7h3.5l1.5 10" />
      <circle cx="12.5" cy="4.5" r="1.4" />
    </svg>
  );
}

/** A runner mid-stride, so a run day stops borrowing the bike glyph. */
export function RunDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="14.2" cy="4.4" r="1.7" />
      <path d="M13.4 7.4 11.4 12.6" />
      <path d="m13.2 8.1 3.3 1.7 2.9-.9" />
      <path d="M13.4 8.3 9.7 9.2 7.9 12" />
      <path d="m11.4 12.6 3.3 2.4-.7 5.4" />
      <path d="M11.4 12.6 8.4 16.2l-3.6.9" />
    </svg>
  );
}

/** A rower on the erg: seat, rail, handle pull. Covers rowing and SkiErg days. */
export function ErgDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 19.5h18" />
      <path d="M5 16.5h14" />
      <path d="M10 16.5v-1.6h3v1.6" />
      <circle cx="15.9" cy="7.8" r="1.6" />
      <path d="M15.2 9.8 12.2 13" />
      <path d="m13.4 11.4 4.8-1.2" />
      <path d="M12.2 13l-3.6.4-2-2.6" />
    </svg>
  );
}

/** A kettlebell for station work: wall balls, sleds, carries. */
export function StationsDayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.7 8.9 8.9 5.8a1.3 1.3 0 0 1 1.3-1.6h3.6a1.3 1.3 0 0 1 1.3 1.6l-.8 3.1" />
      <circle cx="12" cy="14" r="5.4" />
    </svg>
  );
}

export function DayIcon({ dayName, className, strokeWidth }: IconProps & { dayName: string }) {
  const n = dayName.toLowerCase();
  if (n.includes("push") && !n.includes("sled"))
    return <PushDayIcon className={className} strokeWidth={strokeWidth} />;
  if (n.includes("pull") && !n.includes("sled"))
    return <PullDayIcon className={className} strokeWidth={strokeWidth} />;
  if (n.includes("leg")) return <LegsDayIcon className={className} strokeWidth={strokeWidth} />;
  if (/run|tempo|interval|sprint|trail/.test(n))
    return <RunDayIcon className={className} strokeWidth={strokeWidth} />;
  if (/erg|row|ski|engine/.test(n))
    return <ErgDayIcon className={className} strokeWidth={strokeWidth} />;
  if (/station|hybrid|sim|hyrox|race/.test(n))
    return <StationsDayIcon className={className} strokeWidth={strokeWidth} />;
  if (n.includes("cardio") || n.includes("bike"))
    return <CardioDayIcon className={className} strokeWidth={strokeWidth} />;
  return (
    <svg {...base({ className, strokeWidth })}>
      <path d="M6.5 8.5v7" />
      <path d="M17.5 8.5v7" />
      <path d="M3.5 10.5v3" />
      <path d="M20.5 10.5v3" />
      <path d="M6.5 12h11" />
    </svg>
  );
}
