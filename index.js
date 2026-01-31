const container = document.getElementById('mainContainer');
const menuBoxes = document.getElementById('menuBoxes');
const clickText = document.getElementById('clickText');
const sidebar = document.querySelector('.cottrai');
const hero = document.querySelector('.hero');

container.addEventListener('click', function (e) {
    if (e.target.classList.contains('box')) return;

    menuBoxes.classList.toggle('show');
    clickText.classList.toggle('hide');
    sidebar.classList.toggle('hide');
});

hero.addEventListener('click', function (e) {
    if (!container.contains(e.target)) {
        container.classList.add('minimized');
    }
});
container.addEventListener('click', function () {
    if (container.classList.contains('minimized')) {
        container.classList.remove('minimized');
    }
});
