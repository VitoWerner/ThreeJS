import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import * as THREE from 'three';
import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Texture,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader";

@Component({
  selector: 'app-heightmap',
  templateUrl: './heightmap.component.html',
  styleUrls: ['./heightmap.component.scss'],
})
export class HeightmapComponent implements AfterViewInit {

  /*
  Vorgangsweise:
  Szene, Kamera und Renderer machen
  Heightmap-Bild laden
  Geländedaten generiern (Höhenwerte aus Bild berechenn (Helligkeit an jeder Stelle vom Bild))
  Dreiecke machen
  Geometrie anwenden
  Terrain in Szene hinzufügen und rendern
 */

  /*
  BufferGeometry: speichert die Struktur vom 3D-Objekts (Punkte und Flächen).
  VertexBuffer: speichert die Position von den Punkten (Vertex)
  IndexBuffer: verbindet Punkte zu Dreiecken
  MeshBasicMaterial: einfache Materialoberfläche ohne Lichteffekte.
  WebGLRenderer: rendert die scene auf das CANVAS.
  */

  @ViewChild('threeCanvas')
  private canvasRef!: ElementRef;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private map!: Mesh<BufferGeometry, MeshStandardMaterial>;
  private cube!: Mesh;
  private controls!: OrbitControls;

  constructor() {
  }

  ngAfterViewInit(): void {
    this.createScene();
    this.render();
  }


  /**
   * Scene, Camera, Renderer werden erzeugt
   * Textureloader ladet aus der dem pfad die png datei mit onTextureLoader
   */
  private createScene() {
    // Scene und Camera initialisieren
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer ans Canvas binden und Größe geben
    this.renderer = new THREE.WebGLRenderer({canvas: this.canvasRef.nativeElement});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true; // Shadow Map aktivieren
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const loader = new THREE.TextureLoader;
    loader.load('assets/texture/coole-heightmap.png', (texture) => this.onTextureLoaded(texture))

    this.camera.position.set(30, 80, 80);
    //this.camera.lookAt(30, -30, 60);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;  // Enables smooth dragging
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = true;

    this.addLights();
    this.addCube(loader);
  }

  private addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 6000);
    spotLight.position.set(60, 60, 70);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 4096;
    spotLight.shadow.mapSize.height = 4096;

    this.scene.add(spotLight);
  }

  private addCube(loader: THREE.TextureLoader) {
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const normalMap = loader.load('assets/texture/normal.png');
    const material = new THREE.MeshStandardMaterial({color: 0x0077ff, normalMap: normalMap });
    this.cube = new THREE.Mesh(geometry, material);

    this.cube.position.set(30, 30, 60);
    this.cube.castShadow = true;
    this.cube.receiveShadow = true;

    this.scene.add(this.cube);
  }

  private render() {
    // Scene mit Camera rendern
    this.renderer.render(this.scene, this.camera);


    // Nächsten Frame anfordern und nochmal aufrufen
    // (An Framerate vom Bildschirm angepasst)
    requestAnimationFrame(() => this.render())
  }

  private generateTerrain(imageData: ImageData) {

    const indices: number[] = []; // verbindungen der vertices
    const vertices: number[] = []; // xyz jedes Punktes
    const colors: number[] = [];
    const imageWidth = imageData.width;
    const imageHeight = imageData.height;
    const scale = 0.10;


    // Keine elegantere Lösung gefunden
    let maxHeight = -Infinity;

    for (let z = 0; z < imageData.height; z++) {
      for (let x = 0; x < imageData.width; x++) {
        // Jede Zeile (z) hat imageWidth an Pixel, wenn man beides multipilziert,
        // überspringt man alle anderen davor und + x um dann genau zum richtigen index zu kommen
        let pixelIndex = z * imageWidth + x
        let y = imageData.data[pixelIndex * 4] * scale; // Es gibt 4 Werte, benutzen aber nur Rot-Werte

        maxHeight = Math.max(maxHeight, y)
      }
    }

    // durch Höhe und Breite vom Bild Terrain erstellen
    // jede position vom bild wird durchgelaufen um höhe zu berechen
    // Indizes verbinden benachbarte Punkte als Dreiecke
    // Dreieck kann nie verzerrt sein, selbst wenn eckpunkte unterschiedlich hoch sind
    // GPUs sind auf Dreiecke potimiert

    for (let z = 0; z < imageData.height; z++) {
      for (let x = 0; x < imageData.width; x++) {
        // liest Helligkeit des Pixels und berechnet damit Höhe
        let pixelIndex = z * imageWidth + x
        let y = imageData.data[pixelIndex * 4] * scale;

        const normalizedHeight = y / maxHeight;

        let color = [1, 1, 1, 1]; // weiß
        if (normalizedHeight < 0.5) {
          color = [0, 1, 0, 1]; // Grün
        } else if (normalizedHeight < 0.8) {
          color = [0.6, 0.3, 0, 1]; // Braun
        }

        colors.push(...color); //hängt an colors noch ne color an (...)
        vertices.push(x, y, z); // xyz hinzufügen für jeden Punkt
        //colors.push(1, 1, 1, 1) // weiß

        // Verbindet benachbarte Punkte zu Dreiecke für Oberfläche
        if (z < imageHeight - 1 && x < imageWidth - 1) {
          let topLeft = pixelIndex;
          let topRight = topLeft + 1;
          let bottomLeft = (z + 1) * imageWidth + x;
          let bottomRight = bottomLeft + 1;
          // Dreieck 1 und Dreieck 2 werden an die Geometrie übergeben,
          // um Terrain als vernetzte Dreieckfläche darzustellen
          indices.push(topLeft, bottomLeft, topRight);
          indices.push(topRight, bottomLeft, bottomRight);
        }
      }
    }

    /**
     * Vorgegeben
     * VertexBuffer und IndexBuffer erstellen und befüllen
     * BuggerGeometry erzeugen und anzeigen
     */
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, wireframe: false });
    this.map = new THREE.Mesh(geometry, material);
    this.map.castShadow = true;
    this.map.receiveShadow = true;
    this.scene.add(this.map);
  }

  /**
   *  Vorgegeben
   *  Texture Laden
   */
  private onTextureLoaded(texture: Texture) {
    const canvas = document.createElement('canvas');
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(texture.image, 0, 0);

    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    this.generateTerrain(data);
  }


}
