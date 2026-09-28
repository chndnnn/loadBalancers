const http = require("http");

const servers = [
    {
        url: "http://localhost:5001",
        healthy: true,
        connections: 0
    },
    {
        url: "http://localhost:5002",
        healthy: true,
        connections: 0
    },
    {
        url: "http://localhost:5003",
        healthy: true,
        connections: 0
    }
];


// =====================================
// HEALTH CHECK
// =====================================

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

                console.log(
                    `✅ ${server.url} is healthy again`
                );
            }

            if (wasHealthy && !server.healthy) {

                console.log(
                    `❌ ${server.url} is unhealthy`
                );
            }
        }
    );


    // Timeout after 2 seconds

    healthCheck.setTimeout(2000, () => {

        healthCheck.destroy();

        markUnhealthy(server);
    });


    // Connection error

    healthCheck.on("error", () => {

        markUnhealthy(server);
    });
}


// =====================================
// MARK SERVER UNHEALTHY
// =====================================

function markUnhealthy(server) {

    if (server.healthy) {

        console.log(
            `❌ ${server.url} is DOWN`
        );
    }

    server.healthy = false;
}


// =====================================
// LEAST CONNECTIONS
// =====================================

function getNextServer() {

    const healthyServers = servers.filter(
        server => server.healthy
    );


    // No healthy servers

    if (healthyServers.length === 0) {
        return null;
    }


    // Start with first healthy server

    let selectedServer = healthyServers[0];


    // Find server with minimum connections

    for (const server of healthyServers) {

        if (
            server.connections <
            selectedServer.connections
        ) {

            selectedServer = server;
        }
    }


    return selectedServer;
}


// =====================================
// LOAD BALANCER
// =====================================

const loadBalancer = http.createServer(
    (req, res) => {

        const server = getNextServer();


        // No healthy server

        if (!server) {

            console.log(
                "❌ No healthy servers available"
            );

            res.statusCode = 503;

            res.end("Service Unavailable");

            return;
        }


        // Increase active connections

        server.connections++;


        console.log(
            `➡️ ${req.method} ${req.url} → ${server.url}`
        );

        console.log(
            `📊 ${server.url} active connections: ${server.connections}`
        );


        // Proxy request

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


        // Backend request error

        proxyReq.on("error", (error) => {

            console.error(
                `❌ Error connecting to ${server.url}`
            );

            console.error(error.message);


            markUnhealthy(server);


            // Request is no longer active

            server.connections--;


            if (!res.headersSent) {

                res.statusCode = 502;

                res.end("Bad Gateway");
            }
        });


        // When response finishes

        res.on("finish", () => {

            server.connections--;

            console.log(
                `📉 ${server.url} active connections: ${server.connections}`
            );
        });


        // Send request to backend

        req.pipe(proxyReq);
    }
);


// =====================================
// START LOAD BALANCER
// =====================================

loadBalancer.listen(5000, () => {

    console.log(
        "🚀 Least Connections Load Balancer running on http://localhost:5000"
    );
});


// =====================================
// HEALTH CHECK EVERY 5 SECONDS
// =====================================

setInterval(() => {

    console.log(
        "\n🔍 Checking server health..."
    );

    servers.forEach(checkHealth);

}, 5000);