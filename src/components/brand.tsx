import Image from "next/image";
import { cn } from "@/lib/utils";

export const APP_NAME = "CFM Workplace";
export const COMPANY_NAME = "Clickfield Media";

/** Office details shown in the footers. */
export const COMPANY = {
  name: COMPANY_NAME,
  address: ["3/245, Vijayant Khand", "Gomti Nagar, Lucknow 226010", "(Behind Chandan Hospital)"],
  phone: "+91 63937 35033",
  phoneHref: "tel:+916393735033",
  whatsappUrl: "https://api.whatsapp.com/send/?phone=916393735033&text&type=phone_number&app_absent=0",
  email: "clickfieldmedia@gmail.com",
  // Opens a pre-filled Gmail draft, same as the company website.
  emailComposeUrl:
    "https://mail.google.com/mail/?view=cm&fs=1&to=clickfieldmedia%40gmail.com&su=Project%20enquiry&body=Hi%20Clickfield%20team%2C%0A%0AI%E2%80%99d%20like%20to%20talk%20about%20a%20project.%0A%0AName%3A%20%0APhone%20%2F%20WhatsApp%3A%20%0A%0AAbout%20the%20project%3A%0A%0A%0AThanks%2C%0A",
  website: "https://clickfieldmedia.com",
  websiteLabel: "clickfieldmedia.com",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("3/245 Vijayant Khand Gomti Nagar Lucknow 226010"),
  sites: [
    { label: "clickfieldmedia.com", href: "https://clickfieldmedia.com/" },
    { label: "tech.clickfieldmedia.com", href: "https://tech.clickfieldmedia.com/" },
    { label: "realestate.clickfieldmedia.com", href: "https://realestate.clickfieldmedia.com/" },
  ],
  socials: {
    threads: "https://www.threads.com/@clickfield_media",
    x: "https://x.com/clickfieldmedia",
    linkedin: "https://www.linkedin.com/company/clickfield-media/",
    facebook: "https://www.facebook.com/clickfieldmedia/",
    instagram: "https://www.instagram.com/clickfield_media/",
  },
};

/** The Clickfieldmedia round logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt={`${COMPANY_NAME} logo`}
      width={64}
      height={64}
      priority
      className={cn("size-8 shrink-0 rounded-full ring-1 ring-black/5", className)}
    />
  );
}

/** The "Clickfield Media" wordmark, as written on the company websites. */
export function Wordmark({ tone = "navy", className }: { tone?: "navy" | "white"; className?: string }) {
  const [src, width, height] =
    tone === "white" ? ["/logo-white.webp", 898, 278] : ["/logo-navy.webp", 300, 93];
  return (
    <Image
      src={src}
      alt={COMPANY_NAME}
      width={width}
      height={height}
      className={cn("h-9 w-auto", className)}
    />
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  );
}
