document.querySelectorAll("input[type=\"password\"]").forEach(el => {
    el.addEventListener("mouseover", () => el.type = "text");
    el.addEventListener("mouseout", () => el.type = "password");
});