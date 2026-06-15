import { resend } from "./resend";

type SendInviteEmailProps = {
  email: string;
  token: string;
  organizationId: string;
  content: string;
};

export async function sendInviteEmail({
  email,
  token,
  organizationId,
  content,
}: SendInviteEmailProps) {
  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;

  const { data, error } = await resend.emails.send({
    from: "FlashAssign <onboarding@resend.dev>", // change after verifying your domain
    to: email,
    subject: "You've been invited to FlashAssign",
    html: `
      <h2>You've been invited to FlashAssign</h2>

      <p>${content}</p>

      <p>
        <a href="${inviteUrl}">
          Accept Invitation
        </a>
      </p>
    `,
  });
console.log("Resend data:", data);
console.log("Resend error:", error);
  if (error) {
    throw error;
  }

  return data;
}