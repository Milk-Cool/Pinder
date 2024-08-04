const buttonShow = document.querySelector("#show");
const buttonDont = document.querySelector("#dont");

const update = async show => {
    await fetch("/api/show/" + show);
    alert("Preferences updated!");
}
buttonShow.addEventListener("click", () => update(1));
buttonDont.addEventListener("click", () => update(0));