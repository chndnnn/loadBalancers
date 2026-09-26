const http = require("http");

const servers = [
    {
        url: "http://localhost:5001",
        healthy: true
    },
    {
        url: "http://localhost:5002",
        healthy: true
    },
    {
        url: "http://localhost:5003",
        healthy: true
    }
];

let currentServer = 0;

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

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

            res.resume();

            if (!wasHealthy && server.healthy) {
                console.log(`✅ ${server.url} is healthy again`);
            }

            if (wasHealthy && !server.healthy) {
                console.log(`❌ ${server.url} is unhealthy`);
            }
        }
    );

    healthCheck.setTimeout(2000, () => {
        healthCheck.destroy();
        markUnhealthy(server);
    });

    healthCheck.on("error", () => {
        markUnhealthy(server);
    });
}


/*
|--------------------------------------------------------------------------
| Mark Server Unhealthy
|--------------------------------------------------------------------------
*/

function markUnhealthy(server) {

    if (server.healthy) {
        console.log(`❌ ${server.url} is DOWN`);
    }

    server.healthy = false;
}


/*
|--------------------------------------------------------------------------
| Get Next Healthy Server
|--------------------------------------------------------------------------
*/

function getNextServer() {

    for (let i = 0; i < servers.length; i++) {

        const server = servers[currentServer];

        currentServer =
            (currentServer + 1) % servers.length;

        if (server.healthy) {
            return server;
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| Load Balancer
|--------------------------------------------------------------------------
*/

const loadBalancer = http.createServer((req, res) => {

    const server = getNextServer();

    /*
    |--------------------------------------------------------------------------
    | No Healthy Servers
    |--------------------------------------------------------------------------
    */

    if (!server) {

        console.log("❌ No healthy servers available");

        res.statusCode = 503;

        res.end("Service Unavailable");

        return;
    }


    /*
    |--------------------------------------------------------------------------
    | Forward Request
    |--------------------------------------------------------------------------
    */

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

            /*
            |--------------------------------------------------------------------------
            | Send Backend Response To Client
            |--------------------------------------------------------------------------
            */

            res.writeHead(
                proxyRes.statusCode,
                proxyRes.headers
            );

            proxyRes.pipe(res);
        }
    );


    /*
    |--------------------------------------------------------------------------
    | Backend Server Error
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Forward Client Request Body
    |--------------------------------------------------------------------------
    */

    req.pipe(proxyReq);
});


/*
|--------------------------------------------------------------------------
| Start Load Balancer
|--------------------------------------------------------------------------
*/

loadBalancer.listen(5000, () => {

    console.log(
        "🚀 Load balancer running on http://localhost:5000"
    );

    console.log(
        "🔄 Using Round-Robin load balancing"
    );
});


/*
|--------------------------------------------------------------------------
| Health Check Every 5 Seconds
|--------------------------------------------------------------------------
*/

setInterval(() => {

    console.log("\n🔍 Checking server health...");

    servers.forEach(checkHealth);

}, 5000);