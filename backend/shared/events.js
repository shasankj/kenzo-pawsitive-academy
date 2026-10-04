import { randomUUID } from "node:crypto";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const TOPIC_ARN = process.env.EVENTS_TOPIC_ARN;

// Short timeouts: a Lambda inside a VPC with no route to SNS would otherwise hang.
const sns = TOPIC_ARN
  ? new SNSClient({
      maxAttempts: 1,
      requestHandler: { connectionTimeout: 2000, requestTimeout: 3000 },
    })
  : null;

// Best-effort notification. It never fails the request, and it always leaves a log line
// saying what happened, so a missing email can be traced in CloudWatch:
//   "event published"                  -> SNS accepted it (look downstream: SNS, SQS, SES)
//   "publishEvent skipped"             -> EVENTS_TOPIC_ARN is not set on this function
//   "publishEvent failed"              -> permissions (AuthorizationError) or network (TimeoutError)
export async function publishEvent(eventType, payload) {
  if (!sns) {
    console.log(JSON.stringify({ msg: "publishEvent skipped: EVENTS_TOPIC_ARN is not set", eventType }));
    return;
  }

  const eventId = randomUUID();
  try {
    const res = await sns.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Message: JSON.stringify({
          eventId,
          eventType,
          occurredAt: new Date().toISOString(),
          ...payload,
        }),
        MessageAttributes: { eventType: { DataType: "String", StringValue: eventType } },
      })
    );
    console.log(JSON.stringify({ msg: "event published", eventType, eventId, snsMessageId: res.MessageId }));
  } catch (err) {
    console.error(
      JSON.stringify({ msg: "publishEvent failed", eventType, eventId, error: err.name, detail: err.message })
    );
  }
}
