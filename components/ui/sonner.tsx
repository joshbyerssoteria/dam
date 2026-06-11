"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      // Brand toasts: navy fill, white text, gold accent icon; error fills red.
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#C2912D]" />,
        info: <InfoIcon className="size-4 text-[#C2912D]" />,
        warning: <TriangleAlertIcon className="size-4 text-[#C2912D]" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          error: "!bg-[#B43C3C] !text-white !border-[#B43C3C]",
        },
      }}
      style={
        {
          "--normal-bg": "#1B2A41",
          "--normal-text": "#FFFFFF",
          "--normal-border": "#1B2A41",
          "--border-radius": "0px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
