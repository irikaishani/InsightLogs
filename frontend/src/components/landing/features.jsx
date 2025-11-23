// src/pages/Features.jsx
import React from "react";

/**
 * Public Features page (text-only content).
 * Route: /feature
 * This page intentionally contains no route links—it's a standalone informational page
 * that renders under the app Header and Footer (so you don't need to import header/footer here).
 */

export default function Features() {
  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      {/* Decorative gradient background (subtle, same palette as Mainsection) */}
      <img
        src="/gradient.png"
        alt="background gradient"
        className="pointer-events-none absolute -top-12 right-0 w-[48rem] opacity-40 -z-20 hidden lg:block"
      />
      <div
        className="absolute top-[18%] right-[-5%] w-[36rem] h-72 -rotate-[25deg] bg-[#95c0ff]/18 blur-[90px] -z-10"
        aria-hidden
      />

      {/* Add padding-top so fixed header doesn't overlap content */}
      <div className="pt-28 sm:pt-32 lg:pt-36 pb-16 px-5 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">
          {/* Intro / Hero card */}
          <div className="rounded-2xl bg-black/60 p-8 backdrop-blur-sm shadow-[0_0_30px_rgba(125,211,252,0.06)] border border-transparent/10">
            <header className="mb-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#93c5fd] drop-shadow-[0_0_12px_rgba(147,197,253,0.45)]">
                Features — InsightLogs
              </h1>
              <p className="mt-3 text-gray-300 max-w-2xl text-sm sm:text-base">
                Everything this service does, explained plainly. Designed for
                engineers and SREs who want fast, actionable insights from
                application logs.
              </p>
            </header>

            {/* Feature cards grid */}
            <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Card 1 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#3b82f6] via-[#7da7fc] to-[#c4b5fd] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 7v10a2 2 0 0 0 2 2h14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 7a5 5 0 0 1 10 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Upload & File Support</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Upload plain text logs (.log, .txt), JSON or JSONL. Files are stored
                      securely and uniquely named to avoid collisions — each upload
                      becomes a dataset the app can analyze.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 2 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#b0a9ff] via-[#9fb7ff] to-[#7da7fc] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 12h18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 3v18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Parsing & Deduplication</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      The backend extracts timestamps, levels, service names and messages.
                      Duplicate lines are skipped so results remain clean and accurate.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 3 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#3b82f6] via-[#7da7fc] to-[#c4b5fd] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 8v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 12h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Background Analysis Jobs</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Uploads spawn background jobs (queued → running → done). Progress is
                      recorded so the UI can poll and show live percent-complete updates.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 4 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#b0a9ff] via-[#9fb7ff] to-[#7da7fc] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 12h18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 8v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 8v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">AI-driven Insights</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      A sampled analysis is run through AI (with heuristics fallback) to
                      surface issues and proposed fixes — so you'll always get a useful summary.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 5 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#3b82f6] via-[#7da7fc] to-[#c4b5fd] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 6h18v12H3z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Searchable Logs & Filters</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Filter by upload id, level or free-text across message, service name or raw lines.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 6 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#b0a9ff] via-[#9fb7ff] to-[#7da7fc] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M4 7h16M4 12h16M4 17h16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Reports & Summaries</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      After analysis completes, lightweight reports summarize parse stats and detected issues.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 7 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#3b82f6] via-[#7da7fc] to-[#c4b5fd] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Management & Safety</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Uploads can be listed and deleted. Deletion removes the upload and its rows. AI calls are time-limited with safe fallbacks.
                    </p>
                  </div>
                </div>
              </article>

              {/* Card 8 */}
              <article className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-transparent/20 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-none rounded-lg p-3 bg-gradient-to-tr from-[#b0a9ff] via-[#9fb7ff] to-[#7da7fc] shadow-md">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 7h18v10H3z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base">Developer-friendly API</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Clear endpoints for uploads, jobs, logs, reports and AI queries — built for automation and CI/CD workflows.
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <div className="mt-6 text-sm text-gray-400">
              <strong className="text-gray-200">Note:</strong> This page is intentionally text-only.
              Use the app's Admin area to upload files, view dashboards and run analyses.
            </div>

           
          </div>
        </div>
      </div>
    </div>
  );
}
