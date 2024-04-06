import Menu from './menu'
import { musicApplying } from './musicApplying';

window.addEventListener('DOMContentLoaded', () => {
    // Create the game using the 'renderCanvas'.
    // var canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

    // new musicApplying(canvas)
    let menu = new Menu('renderCanvas');
    // Create the scene.
    menu.createMenu();
});
