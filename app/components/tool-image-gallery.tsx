"use client";

import { useState } from "react";

interface Props {
  images: string[];
  toolName: string;
}

export default function ToolImageGallery({ images, toolName }: Props) {
  const [active, setActive] = useState(0);
  const all = images.length > 0 ? images : ["/sky.jpg"];

  return (
    <div>
      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <div className="aspect-[4/3] bg-[#eef2ea]">
          <img
            key={active}
            src={all[active]}
            alt={toolName}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {all.slice(0, 3).map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`overflow-hidden rounded-[22px] bg-white shadow-sm outline-none ring-2 ring-offset-2 transition ${
              active === i
                ? "ring-[#8bbb46]"
                : "ring-transparent hover:ring-[#8bbb46]/50"
            }`}
          >
            <div className="aspect-[4/3] bg-[#eef2ea]">
              <img
                src={img}
                alt={`${toolName} ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
