import * as BABYLON from 'babylonjs';
import * as GUI from 'babylonjs-gui';
import { Room } from "colyseus.js";
import "@babylonjs/loaders";
import {
    Scene,
    Engine,
    SceneLoader,
    Vector3,
    HemisphericLight,
    FreeCamera,
    CannonJSPlugin,
    MeshBuilder,
    PhysicsImpostor,
    AbstractMesh,
    StandardMaterial,
    Color3,
    ActionManager,
    ExecuteCodeAction,
} from "@babylonjs/core";
import "@babylonjs/loaders";

import Menu from "./menu";
import { createSkyBox } from "./utils";

import * as CANNON from "cannon";
import * as Tone from 'tone';
import "@babylonjs/loaders/glTF";

const GROUND_SIZE = 500;

export default class Game {

    sphere: BABYLON.AbstractMesh;
    box: BABYLON.AbstractMesh;
    ground: BABYLON.AbstractMesh;
    synth: Tone.Synth | null;

    private canvas: HTMLCanvasElement;
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
    private camera: BABYLON.ArcRotateCamera;
    private light: BABYLON.Light;

    private room: Room<any>;
    private playerEntities: { [playerId: string]: BABYLON.Mesh } = {};
    private playerNextPosition: { [playerId: string]: BABYLON.Vector3 } = {};

    constructor(canvas: HTMLCanvasElement, engine: BABYLON.Engine, room: Room<any>) {
        this.canvas = canvas;
        this.engine = engine;
        this.room = room;
    }

    initPlayers(): void {
        this.room.state.players.onAdd((player, sessionId) => {

            const isCurrentPlayer = (sessionId === this.room.sessionId);

            const sphere = BABYLON.MeshBuilder.CreateSphere(`player-${sessionId}`, {
                segments: 8,
                diameter: 40
            }, this.scene);

            // Set player mesh properties
            const sphereMaterial = new BABYLON.StandardMaterial(`playerMat-${sessionId}`, this.scene);
            sphereMaterial.emissiveColor = (isCurrentPlayer) ? BABYLON.Color3.FromHexString("#ff9900") : BABYLON.Color3.Gray();
            sphere.material = sphereMaterial;

            // Set player spawning position
            sphere.position.set(player.x, player.y, player.z);

            this.playerEntities[sessionId] = sphere;
            this.playerNextPosition[sessionId] = sphere.position.clone();

            // update local target position
            player.onChange(() => {
                this.playerNextPosition[sessionId].set(player.x, player.y, player.z);
            });
        });

        this.room.state.players.onRemove((player, playerId) => {
            this.playerEntities[playerId].dispose();
            delete this.playerEntities[playerId];
            delete this.playerNextPosition[playerId];
        });

        this.room.onLeave(code => {
            this.gotoMenu();
        })
    }

    createGround(): void {
        // Create ground plane
        const plane = BABYLON.MeshBuilder.CreatePlane("plane", { size: GROUND_SIZE }, this.scene);
        plane.position.y = -15;
        plane.rotation.x = Math.PI / 2;

        let floorPlane = new BABYLON.StandardMaterial('floorTexturePlane', this.scene);
        floorPlane.diffuseTexture = new BABYLON.Texture('./public/ground.jpg', this.scene);
        floorPlane.backFaceCulling = false; // Always show the front and the back of an element

        let materialPlane = new BABYLON.MultiMaterial('materialPlane', this.scene);
        materialPlane.subMaterials.push(floorPlane);

        plane.material = materialPlane;
    }

    displayGameControls() {
        const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("textUI");

        const playerInfo = new GUI.TextBlock("playerInfo");
        playerInfo.text = `Room name: ${this.room.name}      Player: ${this.room.sessionId}`.toUpperCase();
        playerInfo.color = "#eaeaea";
        playerInfo.fontFamily = "Roboto";
        playerInfo.fontSize = 20;
        playerInfo.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        playerInfo.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        playerInfo.paddingTop = "10px";
        playerInfo.paddingLeft = "10px";
        playerInfo.outlineColor = "#000000";
        advancedTexture.addControl(playerInfo);

        const instructions = new GUI.TextBlock("instructions");
        instructions.text = "CLICK ANYWHERE ON THE GROUND!";
        instructions.color = "#fff000"
        instructions.fontFamily = "Roboto";
        instructions.fontSize = 24;
        instructions.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        instructions.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        instructions.paddingBottom = "10px";
        advancedTexture.addControl(instructions);

        // back to menu button
        const button = GUI.Button.CreateImageWithCenterTextButton("back", "<- BACK", "./public/btn-default.png");
        button.width = "100px";
        button.height = "50px";
        button.fontFamily = "Roboto";
        button.thickness = 0;
        button.color = "#f8f8f8";
        button.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        button.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        button.paddingTop = "10px";
        button.paddingRight = "10px";
        button.onPointerClickObservable.add(async () => {
            await this.room.leave(true);
        });
        advancedTexture.addControl(button);
    }

    bootstrap(): void {
        // this.scene = new BABYLON.Scene(this.engine);
        // this.light = new BABYLON.HemisphericLight("pointLight", new BABYLON.Vector3(), this.scene);
        // this.camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, 1.0, 550, BABYLON.Vector3.Zero(), this.scene);
        // this.camera.setTarget(BABYLON.Vector3.Zero());

        // createSkyBox(this.scene);
        // this.createGround();
        // this.displayGameControls();
        // this.initPlayers();

        // this.scene.onPointerDown = (event, pointer) => {
        //     if (event.button == 0) {
        //         const targetPosition = pointer.pickedPoint.clone();

        //         // Position adjustments for the current play ground.
        //         targetPosition.y = -1;
        //         if (targetPosition.x > 245) targetPosition.x = 245;
        //         else if (targetPosition.x < -245) targetPosition.x = -245;
        //         if (targetPosition.z > 245) targetPosition.z = 245;
        //         else if (targetPosition.z < -245) targetPosition.z = -245;

        //         this.playerNextPosition[this.room.sessionId] = targetPosition;

        //         // Send position update to the server
        //         this.room.send("updatePosition", {
        //             x: targetPosition.x,
        //             y: targetPosition.y,
        //             z: targetPosition.z,
        //         });
        //     }
        // };

        this.scene = this.CreateScene();

        createSkyBox(this.scene);
        // this.createGround();
        this.displayGameControls();
        // this.initPlayers();

        this.CreateEnvironment();
        this.CreateController();
        this.createImpostors();
        this.detectTrigger();
        // Start the Tone.js context when a user action occurs

        this.canvas.addEventListener('click', () => {
            this.startAudioContext();
        });
        this.synth = null; // Initialize synth to null
        // this.startAudioContext().then(() => {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        })

        this.doRender();
    }

    private gotoMenu() {
        this.scene.dispose();
        const menu = new Menu('renderCanvas');
        menu.createMenu();
    }

    private doRender(): void {
        // constantly lerp players
        this.scene.registerBeforeRender(() => {
            for (let sessionId in this.playerEntities) {
                const entity = this.playerEntities[sessionId];
                const targetPosition = this.playerNextPosition[sessionId];
                entity.position = BABYLON.Vector3.Lerp(entity.position, targetPosition, 0.05);
            }
        });

        // Run the render loop.
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        // The canvas/window resize event handler.
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }






    //////////////////
    CreateScene(): BABYLON.Scene {

        const scene = new BABYLON.Scene(this.engine);
        // const envTex = BABYLON.CubeTexture.CreateFromPrefilteredData("./environement/xmas_bg.env", this.scene);
        // envTex.gammaSpace = false;
        // envTex.rotationY = Math.PI;
        // scene.environmentTexture = envTex;
        // scene.createDefaultSkybox(envTex, true, 1000, 0.25);

        new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);

        scene.onPointerDown = (evt) => {
            if (evt.button === 0) this.engine.enterPointerlock();
            if (evt.button === 1) this.engine.exitPointerlock();
        };

        const framesPerSecond = 60;
        const gravity = -9.81;
        scene.gravity = new BABYLON.Vector3(0, gravity / framesPerSecond, 0);
        scene.collisionsEnabled = true;
        scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin(true, 10, CANNON));
        return scene;
    }


    createImpostors(): void {
        // this.box = MeshBuilder.CreateBox("box", { size: 2 }, this.scene);
        // this.box.position = new Vector3(0, 10, 2);
        // this.box.rotation = new Vector3(Math.PI / 4, 0, 0);
        // this.box.physicsImpostor = new PhysicsImpostor(this.box, PhysicsImpostor.BoxImpostor, { mass: 1, restitution: 1 }, this.scene)
        this.ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, this.scene);
        this.ground.position.y = 0.25;
        this.ground.isVisible = false;
        this.ground.physicsImpostor = new BABYLON.PhysicsImpostor(this.ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 1 }, this.scene);
        this.sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 3 }, this.scene);
        this.sphere.position = new BABYLON.Vector3(0, 6, 0);
        this.sphere.physicsImpostor = new BABYLON.PhysicsImpostor(this.sphere, BABYLON.PhysicsImpostor.SphereImpostor, { mass: 1, restitution: 1, friction: 1 }, this.scene);

        // this.sphere.physicsImpostor.registerOnPhysicsCollide([this.box.physicsImpostor,this.ground.physicsImpostor], this.detectCollision);
        // this.sphere.physicsImpostor.registerOnPhysicsCollide(this.ground.physicsImpostor, this.detectCollision);
        // this.sphere.physicsImpostor.unregisterOnPhysicsCollide(this.ground.physicsImpostor, this.detectCollision);
    }

    detectCollision(boxCollider: BABYLON.PhysicsImpostor, colliderAgainst: BABYLON.PhysicsImpostor): void {
        // boxCollider.object.scaling = new Vector3(3, 3, 3);
        // boxCollider.setScalingUpdated();
        const mat = new BABYLON.StandardMaterial("mat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0, 0);
        (colliderAgainst.object as BABYLON.AbstractMesh).material = mat;
    }

    detectTrigger(): void {
        const box = BABYLON.MeshBuilder.CreateBox("box", { width: 4, height: 1, depth: 4 }, this.scene);
        box.position.y = 0.5;
        box.visibility = 0.25;
        box.actionManager = new BABYLON.ActionManager(this.scene);
        box.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPickTrigger,
                () => {
                    this.playMelody();
                }
            )
        );


    }

    async CreateEnvironment(): Promise<void> {
        const { meshes } = await BABYLON.SceneLoader.ImportMeshAsync(
            "", // Mesh names to load, empty string to load all
            "./models/", // Root URL
            "playground.babylon", // Scene filename
            this.scene, // Target scene
            // () => {
            //     // Progress callback
            //     this.scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
            //         "https://assets.babylonjs.com/environments/environmentSpecular.env",
            //         this.scene
            //     );
            // }
        );
        // const { meshes } = await BABYLON.SceneLoader.ImportMeshAsync(
        //     "",
        //     "./models/",
        //     "playground.babylon",
        //     this.scene
        // );

        // const {meshes} = await BABYLON.SceneLoader.ImportMeshAsync(
        //     "",
        //     "./models/",
        //     "playground.glb",
        //     this.scene,
        //     undefined,
        //     ".glb"
        // );

        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, this.scene);
        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.ambientColor = new BABYLON.Color3(0.5, 0.5, 0.5); // ambient color
        ground.material = groundMat;
        ground.checkCollisions = true;

        // meshes.add(ground)
        meshes.forEach((mesh) => {
            mesh.checkCollisions = true;
            // mesh.isPickable = true;
        })
    }

    CreateController(): void {
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 10, -20), this.scene);
        camera.attachControl(this.canvas, true);
        camera.applyGravity = true;
        camera.checkCollisions = true;
        camera.setTarget(BABYLON.Vector3.Zero());

        // body camera
        camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);
        camera.speed = 0.5;

        camera.minZ = 0.40;

        camera.keysUp.push(90);
        camera.keysLeft.push(81);
        camera.keysDown.push(83);
        camera.keysRight.push(68);


    }


    // Tone.js melody setup
    async playMelody(): Promise<void> {
        // Stop the previous melody if it's playing
        // if (this.synth !== null) {
        //    await this.synth.triggerRelease();
        //    console.log(this.synth)
        // //    this.synth = null;
        // }

        // Start the audio context if not already started (required for Tone.js)
        // Tone.start();

        // Define your melody using Tone.js
        const newSound = new Tone.Synth().toDestination();

        // Play a middle 'C' for the duration of an 8th note
        newSound.triggerAttackRelease("C4", "8n");

        // Start the Tone.js Transport to play scheduled events
        Tone.Transport.start();
        this.synth = newSound;

    };



    // Method to start the audio context
    async startAudioContext(): Promise<void> {
        if (Tone.context.state === 'suspended') {
            await Tone.start();
        }
    }
















}