"use client";

export function DisplayTypography() {
  return <style jsx global>{`
    .overview h1, .overview h2, .overview h3,
    .profile-page h1, .profile-page h2,
    .team-page h1, .team-page h2,
    .directory-page h1, .directory-page h2 { font-family: var(--font-display), Georgia, serif !important; }
  `}</style>;
}
