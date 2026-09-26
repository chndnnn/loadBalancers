const http = require("http");

const servers = [
    "http://localhost:5001",
    "http://localhost:5002",
    "http://localhost:5003"
];

let currentServer = 0;

const loadBalancer = http.createServer((req, res) => {

    const target = servers[currentServer];

    currentServer =
        (currentServer + 1) % servers.length;

    console.log(`Forwarding request to ${target}`);

    const proxyReq = http.request(
        target + req.url,
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

    req.pipe(proxyReq);

    proxyReq.on("error", (error) => {

        console.error(error);

        res.statusCode = 502;
        res.end("Bad Gateway");
    });
});

loadBalancer.listen(5000, () => {
    console.log("Load balancer running on port 5000");
});