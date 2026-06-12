// netlify/functions/channels.js
//
// Server-side proxy for Xtream Codes player_api.
// The TV never talks to 3vilcorp.uk directly - only to this Netlify
// function on the same domain as the page. Avoids CORS and TLS issues
// on old TV browsers.
//
// Usage: /.netlify/functions/channels?host=...&user=...&pass=...

exports.handler = async function (event) {
  var params = event.queryStringParameters || {};
  var host = params.host;
  var user = params.user;
  var pass = params.pass;

  if (!host || !user || !pass) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing host, user or pass" })
    };
  }

  // Strip trailing slash
  host = host.replace(/\/+$/, "");

  try {
    var catUrl = host + "/player_api.php?username=" + encodeURIComponent(user) +
                  "&password=" + encodeURIComponent(pass) + "&action=get_live_categories";
    var streamUrl = host + "/player_api.php?username=" + encodeURIComponent(user) +
                     "&password=" + encodeURIComponent(pass) + "&action=get_live_streams";

    var catRes = await fetch(catUrl);
    var streamRes = await fetch(streamUrl);

    if (!catRes.ok || !streamRes.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Upstream error", catStatus: catRes.status, streamStatus: streamRes.status })
      };
    }

    var categories = await catRes.json();
    var streams = await streamRes.json();

    var catMap = {};
    for (var i = 0; i < categories.length; i++) {
      catMap[categories[i].category_id] = categories[i].category_name;
    }

    var channels = [];
    for (var j = 0; j < streams.length; j++) {
      var s = streams[j];
      channels.push({
        id: s.stream_id,
        name: s.name,
        icon: s.stream_icon || "",
        category: catMap[s.category_id] || "Other",
        // Provide both formats; page will try m3u8 first, fall back to ts
        m3u8: host + "/live/" + encodeURIComponent(user) + "/" + encodeURIComponent(pass) + "/" + s.stream_id + ".m3u8",
        ts: host + "/live/" + encodeURIComponent(user) + "/" + encodeURIComponent(pass) + "/" + s.stream_id + ".ts"
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: channels })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
