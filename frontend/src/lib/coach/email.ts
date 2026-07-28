export type CoachInvitationEmail = {
  coachName: string;
  athleteName: string;
  inviteUrl: string;
  expiresAt: string;
};

export type InvitationDeliveryResult =
  | { status: "confirmed"; provider: string }
  | { status: "development_available"; developmentLink: string }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function coachInvitationEmailTemplate(input: CoachInvitationEmail) {
  const coachName = escapeHtml(input.coachName);
  const athleteName = escapeHtml(input.athleteName);
  const inviteUrl = escapeHtml(input.inviteUrl);
  const expiry = escapeHtml(new Date(input.expiresAt).toUTCString());

  return {
    subject: `${input.athleteName} invited you to coach on Disciplin`,
    text: [
      `Hello ${input.coachName},`,
      "",
      `${input.athleteName} invited you to review their submitted corrections in Disciplin.`,
      "Accepting lets you approve, edit and approve, or reject only that athlete’s submitted work.",
      "",
      `Review invitation: ${input.inviteUrl}`,
      `This single-use link expires ${new Date(input.expiresAt).toUTCString()}.`,
      "",
      "If you were not expecting this invitation, you can ignore it.",
    ].join("\n"),
    html: [
      `<p>Hello ${coachName},</p>`,
      `<p><strong>${athleteName}</strong> invited you to review their submitted corrections in Disciplin.</p>`,
      "<p>Accepting lets you approve, edit and approve, or reject only that athlete’s submitted work.</p>",
      `<p><a href="${inviteUrl}">Review invitation</a></p>`,
      `<p>This single-use link expires ${expiry}.</p>`,
      "<p>If you were not expecting this invitation, you can ignore it.</p>",
    ].join(""),
  };
}

export async function deliverCoachInvitation(
  input: CoachInvitationEmail,
): Promise<InvitationDeliveryResult> {
  // No production provider is configured. Keeping the adapter explicit prevents
  // a created database invitation from being misrepresented as delivered.
  void coachInvitationEmailTemplate(input);
  if (process.env.NODE_ENV !== "production") {
    return {
      status: "development_available",
      developmentLink: input.inviteUrl,
    };
  }
  return {
    status: "unavailable",
    reason: "No production email provider is configured.",
  };
}

