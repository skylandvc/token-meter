import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function splitEnv(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized.includes("@")) {
    return false;
  }

  const allowedEmails = splitEnv(process.env.ALLOWED_EMAILS);
  if (allowedEmails.includes(normalized)) {
    return true;
  }

  const domain = normalized.split("@").pop();
  const allowedDomains = splitEnv(process.env.ALLOWED_EMAIL_DOMAINS);
  return allowedDomains.length > 0 && allowedDomains.includes(domain);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    async signIn({ user, profile }) {
      const email = user?.email || profile?.email;
      return isAllowedEmail(email);
    },
    async session({ session }) {
      if (session?.user?.email) {
        session.user.allowed = isAllowedEmail(session.user.email);
      }
      return session;
    },
  },
});
