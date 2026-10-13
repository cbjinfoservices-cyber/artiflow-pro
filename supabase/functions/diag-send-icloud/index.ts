Deno.serve(() =>
  new Response(JSON.stringify({ ok: false, error: "Sonde désactivée." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
);
