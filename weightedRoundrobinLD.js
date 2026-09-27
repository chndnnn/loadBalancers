const http = require("http");

const servers = [
    {
        url: "http://localhost:5001",
        weight: 1,
        healthy: true
    },
    {
        url: "http://localhost:5002",
        weight: 3,
        healthy: true
    },
    {
        url: "http://localhost:5003",
        weight: 2,
        healthy: true
    }
];

let currentServer = 0;
let currentWeight = 0;

function checkHealth(server) {

    const healthCheck = http.get(
        `${server.url}/health`,
        (res) => {

            const wasHealthy = server.healthy;

            if (res.statusCode === 200) {
                server.healthy = true;
            } else {
                server.healthy = false;
            }

            // Consume response body
            res.resume();

            if (!wasHealthy && server.healthy) {
                console.log(`✅ ${server.url} is healthy again`);
            }

            if (wasHealthy && !server.healthy) {
                console.log(`❌ ${server.url} is unhealthy`);
            }
        }
    );

    // Server didn't respond within 2 seconds
    healthCheck.setTimeout(2000, () => {

        healthCheck.destroy();

        markUnhealthy(server);
    });

    // Connection error
    healthCheck.on("error", () => {
        markUnhealthy(server);
    });
}

// -------------------------
// MARK SERVER UNHEALTHY
// -------------------------

function markUnhealthy(server) {

    if (server.healthy) {
        console.log(`❌ ${server.url} is DOWN`);
    }

    server.healthy = false;
}

// -------------------------
// WEIGHTED ROUND ROBIN
// -------------------------

function getNextServer() {

    while (true) {

        const server = servers[currentServer];

        // If server is unhealthy,
        // skip it
        if (!server.healthy) {

            currentServer =
                (currentServer + 1) % servers.length;

            currentWeight = 0;

            continue;
        }

        // Give this server requests
        // according to its weight
        if (currentWeight < server.weight) {

            currentWeight++;

            return server;
        }

        // Weight exhausted
        currentWeight = 0;

        currentServer =
            (currentServer + 1) % servers.length;
    }
}

// -------------------------
// LOAD BALANCER
// -------------------------

const loadBalancer = http.createServer((req, res) => {

    const server = getNextServer();

    if (!server) {

        res.statusCode = 503;
        res.end("Service Unavailable");

        return;
    }

    console.log(
        `➡️ ${req.method} ${req.url} → ${server.url}`
    );

    const proxyReq = http.request(
        server.url + req.url,
        {
            method: req.method,
            headers: req.headers
        },
        (proxyRes) => {

            res.writeHead(
                proxyRes.statusCode,
                proxyRes.headers
            );

            proxyRes.pipe(res);
        }
    );

    // Backend request failed
    proxyReq.on("error", (error) => {

        console.error(
            `❌ Error connecting to ${server.url}`
        );

        console.error(error.message);

        markUnhealthy(server);

        if (!res.headersSent) {

            res.statusCode = 502;

            res.end("Bad Gateway");
        }
    });

    // Send client request body
    req.pipe(proxyReq);
});


loadBalancer.listen(5000, () => {

    console.log(
        "🚀 Load balancer running on http://localhost:5000"
    );

    console.log(
        "⚖️ Weighted Round Robin enabled"
    );
});


// -------------------------
// RUN HEALTH CHECK EVERY 5 SEC
// -------------------------

setInterval(() => {

    console.log("\n🔍 Checking server health...");

    servers.forEach(checkHealth);

}, 5000);