import Image from "next/image";
import { AuthNavbar } from "@/components/auth-navbar";
import { APP_NAME, BrandMark, COMPANY_NAME } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import officePhoto from "@/assets/login-office.webp";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AuthNavbar />
      <div className="grid flex-1 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[1.45fr_1fr]">
        <BrandPanel />

        {/* Form side on the warm paper background of clickfieldmedia.com. */}
        <main className="relative flex flex-col items-center justify-center gap-8 overflow-hidden bg-[#eee9e1] px-5 py-12 md:px-10 lg:px-8 xl:px-12">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(230_94_21/0.08),transparent_45%),radial-gradient(circle_at_0%_100%,rgb(10_37_65/0.06),transparent_50%)]"
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-3xl border border-[#e0d8ca] bg-[#f7f4ef] p-6 shadow-[0_24px_60px_-20px_rgb(10_37_65/0.25)] [--input:#d9d1c3] sm:p-9">
            {children}
          </div>
          <p className="relative text-xs text-[#5f625f]">
            Made for the {COMPANY_NAME} team · Lucknow, India
          </p>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

// The photo's aspect ratio. The stage below is sized like `object-cover`, so the text laid on
// top stays pinned to the same spot on the wall at every screen size.
const PHOTO_RATIO = "1006 / 924";
const stage: React.CSSProperties = {
  width: `max(100cqw, 100cqh * ${PHOTO_RATIO})`,
  height: `max(100cqh, 100cqw / (${PHOTO_RATIO}))`,
  // Crop mostly from the right and bottom, keeping the wall text in view.
  left: `calc((100cqw - max(100cqw, 100cqh * ${PHOTO_RATIO})) * 0.3)`,
  top: `calc((100cqh - max(100cqh, 100cqw / (${PHOTO_RATIO}))) * 0.2)`,
};

const wallWords = ["Strategy", "Creatives", "Performance", "Growth"];

/**
 * The Clickfield Media office: a cleaned photo of the studio wall with the welcome text set
 * on it as real, sharp type (sizes in `cqw` are fractions of the photo's width).
 */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#0a2541] [container-type:size] lg:block">
      <div className="absolute [container-type:inline-size]" style={stage}>
        <Image
          src={officePhoto}
          alt=""
          fill
          priority
          quality={90}
          placeholder="blur"
          sizes="75vw"
          className="object-cover"
        />

        {/* Product logo, top-left of the wall. */}
        <div className="absolute top-[11.6%] left-[19.1%] flex items-center gap-[1.9cqw] text-white">
          <BrandMark className="size-[6.8cqw] shadow-[0_0.6cqw_2cqw_rgb(0_0_0/0.35)] ring-0" />
          <div className="grid gap-[0.3cqw] leading-none">
            <span className="text-[2.75cqw] font-semibold tracking-tight">{APP_NAME}</span>
            <span className="text-[1.65cqw] text-white/75">by {COMPANY_NAME}</span>
          </div>
        </div>

        {/* Welcome headline. */}
        <div className="absolute top-[26.4%] left-[19.6%] text-white [text-shadow:0_0.15cqw_0_rgb(0_0_0/0.18),0_0.8cqw_3cqw_rgb(0_0_0/0.3)]">
          <h1 className="font-heading text-[5.25cqw] leading-[1.05] font-bold tracking-[-0.025em]">
            Welcome to
            <br />
            Clickfield <span className="text-brand-orange">Media</span>
          </h1>
          <p className="mt-[1.1cqw] text-[2.7cqw] font-light text-white/90">Your workspace</p>
          <div className="mt-[2.2cqw] h-[0.5cqw] w-[5.2cqw] rounded-full bg-brand-orange" />
        </div>

        {/* Words on the wall. */}
        <div className="absolute top-[21.8%] left-[65.2%]" aria-hidden>
          <ul className="space-y-[0.5cqw] text-[2.7cqw] leading-[1.2] font-medium tracking-tight text-white/70 [text-shadow:0_0.6cqw_2cqw_rgb(0_0_0/0.25)]">
            {wallWords.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="mt-[2cqw] h-[0.45cqw] w-[4.3cqw] rounded-full bg-brand-orange" />
        </div>

        {/* Poster in the frame on the sideboard. */}
        <div
          className="absolute top-[47.2%] left-[77.7%] text-[1.78cqw] leading-[1.17] font-semibold tracking-tight text-[#0a2541]"
          aria-hidden
        >
          Real
          <br />
          Estate
          <br />
          Marketing
          <br />
          That
          <br />
          <span className="text-brand-orange">Delivers.</span>
          <div className="mt-[1cqw] h-[0.2cqw] w-[2.2cqw] bg-brand-orange" />
        </div>
      </div>

      {/* Finish: soft vignette, fine film grain and a shadow where the photo meets the form. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_40%_35%,transparent_55%,rgb(4_14_28/0.4)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/20 to-transparent"
        aria-hidden
      />
    </aside>
  );
}

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
