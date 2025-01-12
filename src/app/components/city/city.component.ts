import {Component, ElementRef, OnInit, ViewChild, AfterViewInit} from '@angular/core';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import {BufferGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Texture, WebGLRenderer} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

@Component({
  selector: 'app-city',
  templateUrl: './city.component.html',
  styleUrls: ['./city.component.scss'],
})
export class CityComponent implements AfterViewInit {
  @ViewChild('threeCanvas') private canvasRef!: ElementRef;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private map!: Mesh<BufferGeometry, MeshStandardMaterial>;
  private controls!: OrbitControls;

  constructor() {}

  ngAfterViewInit(): void {
    this.createScene();
    this.render();
  }

  private createScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(30, 80, 80);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvasRef.nativeElement });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = true;


    this.addLights();

    const loader = new THREE.TextureLoader();
    loader.load('assets/texture/coolcool.png', (texture) => this.onTextureLoaded(texture));

    this.addPaperPlaneModel();
    this.addCityModel();
  }

  private addLights() {
    const sunlight = new THREE.DirectionalLight(0xffffff, 1);
    sunlight.position.set(-100, 100, 0);
    sunlight.castShadow = true;

    sunlight.shadow.mapSize.width = 4096;
    sunlight.shadow.mapSize.height = 4096;
    sunlight.shadow.camera.near = 0.1;
    sunlight.shadow.camera.far = 500;
    sunlight.shadow.camera.left = -200;
    sunlight.shadow.camera.right = 200;
    sunlight.shadow.camera.top = 200;
    sunlight.shadow.camera.bottom = -200;

    this.scene.add(sunlight);


    const animateLight = () => {
      sunlight.position.x += 0.1;

      if (sunlight.position.x > 100) {
        sunlight.position.x = -100;
      }

      requestAnimationFrame(animateLight);
    };

    animateLight();
  }


  private addPaperPlaneModel() {
    const mtlLoader = new MTLLoader();
    mtlLoader.load('assets/paperplane.mtl', (materials) => {
      materials.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load(
        'assets/paperplane.obj',
        (object) => {
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          object.position.set(250, 15, 250);
          object.rotateY(40);
          object.scale.set(10, 10, 10);
          this.scene.add(object);


          this.animatePaperPlane(object);
        },
        undefined,
        (error) => {
          console.error('Error loading Paperplane OBJ:', error);
        }
      );
    });
  }


  private animatePaperPlane(object: THREE.Object3D) {
    const startPosition = { x: 250, z: 250 };
    const endPosition = { x: -50, z: -50 };
    const speed = 0.5;

    const animate = () => {
      object.position.x -= speed;
      object.position.z -= speed;

      // Zurücksetzen, wenn Punkt erreicht
      if (object.position.x <= endPosition.x && object.position.z <= endPosition.z) {
        object.position.x = startPosition.x;
        object.position.z = startPosition.z;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }


  private addCityModel() {
    const mtlLoader = new MTLLoader();
    mtlLoader.load('assets/threejs-city4.mtl', (materials) => {
      materials.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load(
        'assets/threejs-city4.obj',
        (object) => {
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          object.position.set(100, 1, 100);
          object.scale.set(17, 17, 17);
          object.name = 'city';
          this.scene.add(object);
        },
        undefined,
        (error) => {
          console.error('Error loading OBJ:', error);
        }
      );
    });
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.render());
  }

  private generateTerrain(imageData: ImageData) {
    const indices: number[] = [];
    const vertices: number[] = [];
    const colors: number[] = [];
    const imageWidth = imageData.width;
    const imageHeight = imageData.height;
    const scale = 0.1;

    let maxHeight = -Infinity;

    for (let z = 0; z < imageData.height; z++) {
      for (let x = 0; x < imageData.width; x++) {
        const pixelIndex = z * imageWidth + x;
        const y = imageData.data[pixelIndex * 4] * scale;
        maxHeight = Math.max(maxHeight, y);
      }
    }

    for (let z = 0; z < imageData.height; z++) {
      for (let x = 0; x < imageData.width; x++) {
        const pixelIndex = z * imageWidth + x;
        const y = imageData.data[pixelIndex * 4] * scale;

        const normalizedHeight = y / maxHeight;
        let color = [1, 1, 1, 1];
        if (normalizedHeight < 0.5) color = [0, 1, 0, 1];
        else if (normalizedHeight < 0.8) color = [0.6, 0.3, 0, 1];

        colors.push(...color);
        vertices.push(x, y, z);

        if (z < imageHeight - 1 && x < imageWidth - 1) {
          const topLeft = pixelIndex;
          const topRight = topLeft + 1;
          const bottomLeft = (z + 1) * imageWidth + x;
          const bottomRight = bottomLeft + 1;
          indices.push(topLeft, bottomLeft, topRight);
          indices.push(topRight, bottomLeft, bottomRight);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    this.map = new THREE.Mesh(geometry, material);
    this.map.castShadow = true;
    this.map.receiveShadow = true;
    this.scene.add(this.map);
  }

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
