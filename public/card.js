const checkReload = id => {
    if(id == 0) location.reload();
};

const skip = async id => {
    document.getElementById("c" + id).classList.add("left");
    checkReload(id);
};
const sent = async id => {
    document.getElementById("c" + id).classList.add("right");
    checkReload(id);
};

const THRESHOLD = 50;

for(const card of document.querySelectorAll(".card")) {
    const id = card.id.slice(1);
    const buttons = card.querySelectorAll("button");
    buttons[0].addEventListener("click", () => skip(id));
    buttons[1].addEventListener("click", () => sent(id));
    /** @type {number} */
    let start;
    card.addEventListener("touchstart", e => start = e.changedTouches[0].screenX);
    card.addEventListener("touchend", e => {
        if(e.changedTouches[0].screenX - start > THRESHOLD) sent(id);
        else if(start - e.changedTouches[0].screenX > THRESHOLD) skip(id);
    });
}