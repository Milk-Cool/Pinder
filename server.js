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
    pushUser,
    recommendUsers,
    pushSwipe,
    updateSwipe,
    getSwipeByPNIDs,
    updateUser,
    getMatches,
    getSkipped,
    removeSwipe
} from "./index.js";

const { TOKEN_SECRET, DEV, DOMAIN } = process.env;

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
const ejsOpts = {};

const app = express();
app.enable("trust proxy");
app.use(session({
    "secret": TOKEN_SECRET,
    "resave": true,
    "saveUninitialized": true,
    "proxy": true,
    "cookie": { "secure": !DEV, "httpOnly": true, "domain": DOMAIN, "path": "/" }
}));
app.use(express.urlencoded({ "extended": true }));

app.use(express.static("public"));
app.get("/", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const users = await recommendUsers(req.session.pnid);

    res.status(200).send(await ejs.renderFile(page("main"), {
        "info": req.query.info,
        "fc": req.session.fc || "",
        "pnid": req.session.pnid,
        "cards": users.reverse()
    }, ejsOpts));
});
app.get("/matched", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const matches = await getMatches(req.session.pnid);

    res.status(200).send(await ejs.renderFile(page("matched"), {
        "cards": await Promise.all(matches.reverse().map(
            async x => await getUserByPNID(x.from_u == req.session.pnid ? x.to_u : x.from_u)))
    }, ejsOpts));
});
app.get("/skipped", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const matches = await getSkipped(req.session.pnid);

    res.status(200).send(await ejs.renderFile(page("skipped"), {
        "cards": await Promise.all(matches.reverse().slice(0, 10).map(
            async x => await getUserByPNID(x.from_u == req.session.pnid ? x.to_u : x.from_u)))
    }, ejsOpts));
});
app.get("/prefs", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const user = await getUserByPNID(req.session.pnid);

    res.status(200).send(await ejs.renderFile(page("prefs"), {
        "fc": req.session.fc || "",
        "pnid": req.session.pnid,
        "show": user.show
    }, ejsOpts));
});

app.get("/api/skip/:pnid", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const swipe = await getSwipeByPNIDs(req.params.pnid, req.session.pnid);
    if(swipe) {
        await updateSwipe(swipe.id, 0);
        return;
    }

    if(!(await getSwipeByPNIDs(req.session.pnid, req.params.pnid)))
        await pushSwipe({
            "from_u": req.session.pnid,
            "to_u": req.params.pnid,
            "type": 0
        });
    res.status(200).send("skipped");
});

app.get("/api/sent/:pnid", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const swipe = await getSwipeByPNIDs(req.params.pnid, req.session.pnid);
    if(swipe) {
        await updateSwipe(swipe.id, 3);
        return res.status(200).send("match");
    }
    await pushSwipe({
        "from_u": req.session.pnid,
        "to_u": req.params.pnid,
        "type": 1
    });
    res.status(200).send("sent");
});
app.get("/api/unskip/:pnid", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const swipe = await getSwipeByPNIDs(req.session.pnid, req.params.pnid);
    if(swipe && swipe.type == 0)
        await removeSwipe(swipe.id);
    res.status(200).send("sent");
});

app.get("/api/show/:show", async (req, res) => {
    if(!req.session.authenticated)
        return res.redirect("/login");

    const show = parseInt(req.params.show);
    await updateUser(req.session.pnid, show);
    res.status(200).send("updated");
});

app.get("/login", async (req, res) => {
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
        if(!t2 || !t2.includes(req.session.code))
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