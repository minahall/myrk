"use client";
import { useState } from "react";

export default function Rings() {
  const [replay, setReplay] = useState(0);
  return (
    <svg
      key={replay}
      className="mark"
      onClick={() => setReplay((n) => n + 1)}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Three rings dissolving around a glowing core. Click to replay."
    >
      <circle className="ring r1" pathLength={100} cx={100} cy={100} r={92} />
      <circle className="ring r2" pathLength={100} cx={100} cy={100} r={66} />
      <circle className="ring r3" pathLength={100} cx={100} cy={100} r={40} />
      <circle className="core" cx={100} cy={100} r={9} />
    </svg>
  );
}
