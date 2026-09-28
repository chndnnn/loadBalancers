const express = require("express");

const app = express();

const PORT = process.env.PORT ;

app.get("/", (req, res) => {
     
    console.log(`Request received by ${PORT}`);

    setTimeout(() => {

        res.json({
            message: "Hello from server",
            port: PORT
        });

    }, 10000);
});

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});