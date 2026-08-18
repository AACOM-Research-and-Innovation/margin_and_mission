import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  const store = getStore("margin-and-mission");

  const url = new URL(request.url);

  // The function will receive requests such as:
  // /.netlify/functions/kv/mm%3Astate
  //
  // Extract everything after "/kv/".
  const match = url.pathname.match(/\/kv\/(.+)$/);

  if (!match) {
    return new Response(
      JSON.stringify({ error: "Missing key" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const key = decodeURIComponent(match[1]);

  try {
    if (request.method === "GET") {
      const value = await store.get(key);

      if (value === null) {
        return new Response(null, { status: 404 });
      }

      return new Response(
        JSON.stringify({ value }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (request.method === "PUT") {
      const body = await request.json();

      if (!Object.prototype.hasOwnProperty.call(body, "value")) {
        return new Response(
          JSON.stringify({ error: "Missing value" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      await store.set(key, body.value);

      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (request.method === "DELETE") {
      await store.delete(key);

      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};