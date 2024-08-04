const cards = document.querySelectorAll(".card");
for(const i of cards)
    i.querySelector("button").addEventListener("click", async () => {
        await fetch("/api/unskip/" + i.dataset.pnid);
        alert("Un-skipped!");
    });