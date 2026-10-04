import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Triggered by the user-emails SQS queue (fed by the SNS topic). It does not touch the
// database: each event already carries everything the email needs. That also means this
// function can run OUTSIDE the VPC, so it needs no VPC endpoint or NAT gateway.
//
// Environment variables: FROM_EMAIL (a verified SES identity), APP_TIMEZONE (optional)

const ses = new SESv2Client({ maxAttempts: 2 });
const TZ = process.env.APP_TIMEZONE ?? "UTC";

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
const oneLine = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();

// Plain text only on purpose: names and course titles come from users, so there is nothing to escape.
const templates = {
  BookingConfirmed: (e) => ({
    to: e.studentEmail,
    subject: `Seat ${oneLine(e.seat)} confirmed: ${oneLine(e.courseTitle)}`,
    text: [
      `Hi ${oneLine(e.studentName)},`,
      "",
      "Your seat is booked.",
      "",
      `Course:  ${oneLine(e.courseTitle)}`,
      `Teacher: ${oneLine(e.teacherName)}`,
      `When:    ${when(e.startTime)}`,
      `Room:    ${oneLine(e.roomName)} (${e.roomNumber})`,
      `Seat:    ${oneLine(e.seat)}`,
      "",
      "See you there!",
    ].join("\n"),
  }),

  SignupReviewed: (e) => ({
    to: e.email,
    subject: e.decision === "APPROVE" ? "Your account has been approved" : "Your signup request was not approved",
    text:
      e.decision === "APPROVE"
        ? `Hi ${oneLine(e.name)},\n\nYour signup has been approved. You can now log in and book classes.`
        : `Hi ${oneLine(e.name)},\n\nUnfortunately your signup request was not approved. Please contact the coaching center if you think this is a mistake.`,
  }),

  ClassCancelled: (e) => ({
    to: e.studentEmail,
    subject: `Class cancelled: ${oneLine(e.courseTitle)}`,
    text: [
      `Hi ${oneLine(e.studentName)},`,
      "",
      "We're sorry, but a class you booked has been cancelled.",
      "",
      `Course:        ${oneLine(e.courseTitle)}`,
      `Was scheduled: ${when(e.startTime)}`,
      `Room:          ${oneLine(e.roomName)} (${e.roomNumber})`,
      ...(e.reason ? [`Reason:        ${oneLine(e.reason)}`] : []),
      "",
      "Your booking for this class is no longer valid. Please book another session.",
    ].join("\n"),
  }),
};

// Raw message delivery on the SNS subscription gives us the JSON directly.
// If it's off, the body is an SNS envelope and the event is inside "Message". Handle both.
function parseMessage(body) {
  let msg = JSON.parse(body);
  if (msg?.Type === "Notification" && typeof msg.Message === "string") {
    msg = JSON.parse(msg.Message);
  }
  return msg;
}

export const handler = async (event) => {
  const from = process.env.FROM_EMAIL;
  if (!from) throw new Error("FROM_EMAIL is not set"); // config error: let every message retry

  // Only the messages that failed go back to the queue (needs "Report batch item failures" on the trigger)
  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      const msg = parseMessage(record.body);
      const build = templates[msg.eventType];
      if (!build) {
        console.warn(JSON.stringify({ msg: "no email template for event, skipping", eventType: msg.eventType }));
        continue;
      }

      const mail = build(msg);
      if (!mail.to) {
        console.warn(JSON.stringify({ msg: "event has no recipient, skipping", eventType: msg.eventType, eventId: msg.eventId }));
        continue;
      }

      const res = await ses.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [mail.to] },
          Content: {
            Simple: {
              Subject: { Data: mail.subject },
              Body: { Text: { Data: mail.text } },
            },
          },
        })
      );
      // The recipient address is deliberately not logged
      console.log(JSON.stringify({ msg: "email sent", eventType: msg.eventType, eventId: msg.eventId, sesMessageId: res.MessageId }));
    } catch (err) {
      // Typical causes: MessageRejected "Email address is not verified" (SES sandbox),
      // AccessDenied (IAM), Throttling (sandbox allows 1 email/second)
      console.error(JSON.stringify({ msg: "email failed", messageId: record.messageId, error: err.name, detail: err.message }));
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
