import express from "express";
import session from "express-session";
import ejs from "ejs";
import { join } from "path";
import { createHash } from "crypto";
import { JSDOM } from "jsdom";
import {
    HTMLBrowser,
    get,
    getUserByPNID,
    pushUser
} from "./index.js";

const { TOKEN_SECRET, DEV } = process.env;

const timeouts = {};
const interval = 60 * 1000;

const browser = new HTMLBrowser();
let ready = false;
(async () => {
    await browser.make();
    ready = true;
})();

const getLastPost = async pid => {
    if(!ready) return "";
    const page = await browser.createPage();
    const content = await get(page, "/users/" + pid);
    page.close();

    const { document } = (new JSDOM(content, { "contentType": "text/html" })).window;
    const text = document.querySelector(".post-content > h4")?.textContent;
    return text;
}

const page = name => join("pages", name + ".ejs");
const template = name => join("templates", name + ".ejs");

/** @type {ejs.Options} */
const ejsOpts = {
    "async": true
};

const app = express();
app.use(session({
    "secret": TOKEN_SECRET,
    "resave": true,
    "saveUninitialized": true,
    "cookie": { "secure": !DEV, "httpOnly": true }
}));
app.use(express.urlencoded({ "extended": true }));

app.use(express.static("public"));
app.get("/", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    res.status(200).send(await ejs.renderFile(page("main"), {
        "indo": req.query.info,
        "fc": req.session.fc || "",
        "pnid": req.session.pnid
    }, ejsOpts));
});

app.get("/login", async (req, res) => {
    console.log(req.session)
    if(req.session.authenticated)
        return res.redirect("/");

    if(!req.session.stage)
        req.session.stage = 0;

    res.status(200).send(await ejs.renderFile(page("login"), {
        "stage": req.session.stage,
        "fc": req.session.fc || "",
        "code": req.session.code,
        "error": req.query.error
    }, ejsOpts));
});
app.post("/login", async (req, res) => {
    if(req.session.authenticated) return res.status(400).end("You're already authenticated!");
    if(req.session.stage && req.session.stage == 1) {
        if(req.ip in timeouts && new Date() - timeouts[req.ip] < interval)
            return res.redirect("/login?error=Try+checking+again+in+a+minute.");
        timeouts[req.ip] = new Date();
        req.session.fc = req.body.fc || "";
        const t2 = await getLastPost(req.session.pid);
        if(!t2.includes(req.session.code))
            return res.redirect("/login?error=Code+not+found+in+post");
        await pushUser({
            "pid": req.session.pid,
            "pnid": req.session.pnid,
            "fc": req.session.fc,
            "hash": req.session.hash
        });
        req.session.authenticated = true;
        return res.redirect("/?info=Please+delete+the+post+with+the+code.+Thanks!");
    }

    if(!req.body.pnid || !req.body.pass)
        return res.redirect("/login?error=Invalid+input+values");

    const user = await getUserByPNID(req.body.pnid);
    const hash = createHash("sha256").update(req.body.pass).digest("hex");
    if(!user) {
        const f1 = await fetch(`https://pnidlt.gabis.online/api/v1/pnid/${req.body.pnid}/FetchPID`);
        if(f1.status == 404)
            return res.redirect("/login?error=Can't+find+user");
        req.session.pid = await f1.text();
        req.session.start = new Date();
        req.session.code = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        req.session.pnid = req.body.pnid;
        req.session.hash = hash;
        req.session.stage++;
        return res.redirect("/login");
    }

    if(user.hash != hash)
        return res.redirect("/login?error=Wrong+password");
    req.session.pnid = user.pnid;
    req.session.pid = user.pid;
    req.session.fc = user.fc;
    req.session.authenticated = true;
    res.redirect("/");
});

app.listen(12583);