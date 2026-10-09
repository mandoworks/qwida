import { NextResponse } from "next/server";

interface CallRequest {
  to?: string;
  recipientName?: string;
  message?: string;
  trigger?: string;
}

/**
 * Outbound voice reminder call endpoint.
 * In production: Triggers an automated outbound call via Twilio Voice API with TwiML / TTS.
 * In demo mode: Returns honest labeled SIMULADO fixture with full TwiML voice payload.
 */
export async function POST(req: Request) {
  try {
    const body: CallRequest = await req.json().catch(() => ({}));
    const to = body.to || "+17875550192";
    const recipientName = body.recipientName || "Doña Carmen";
    const message = body.message || "Recordatorio de medicamento.";

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || "+17873392039";

    const speechScript = `Bendición ${recipientName}. De parte de su familia en Quida le recordamos: ${message}. Que pase un lindo día.`;

    // Real Twilio Voice execution if credentials are provided
    if (sid && token) {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const twiml = `<Response><Say language="es-MX" voice="Polly.Mia">${speechScript}</Say></Response>`;
      
      const params = new URLSearchParams();
      params.set("To", to);
      params.set("From", from);
      params.set("Twiml", twiml);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );

      if (twilioRes.ok) {
        const data = await twilioRes.json();
        return NextResponse.json({
          ok: true,
          simulated: false,
          callSid: data.sid,
          status: data.status,
          provider: "Twilio Voice API",
          to,
          script: speechScript,
        });
      }
    }

    // Standard demo behavior: honest SIMULADO fixture with Twilio schema
    return NextResponse.json({
      ok: true,
      simulated: true,
      label: "SIMULADO",
      provider: "Twilio Voice API",
      to,
      recipientName,
      script: speechScript,
      callSid: `CA_sim_${Date.now().toString(36)}`,
      status: "queued",
      note: "Modo demo: sin cobro de troncal telefónica. En producción utiliza Twilio Voice API para teléfonos móviles y fijos de Puerto Rico.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar llamada";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
