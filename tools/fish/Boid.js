// import * as THREE from './resources/js/three/three.module.js';
import * as THREE from './three.module.js';
import {clone} from './jsm/utils/SkeletonUtils.js';

const maxForce = 0.2 / 300;
const maxVel = 1.5 / 200;
const r = 2;
const scale = 20;

export default class Boid {
  constructor(scene, boids, obj, x, y, z) {
    this.boids = boids;

    // const geo = new THREE.ConeGeometry(0.2, 1, 3);
    // this.material = new THREE.MeshPhongMaterial({
    //   color: 0xccffff,
    // });
    // obj = new THREE.Mesh(geo, this.material);
    // obj.castShadow = true;

    // const octa = obj; // .clone();
    // this.mesh = cloneFbx(obj); // new THREE.Group();
    this.mesh = new THREE.Group();
    this.mesh.scale.multiplyScalar(1 + 0.4 * (Math.random() - 0.5));
    this.fbx = clone(obj);
    this.fbx.animations = obj.animations;
    this.mesh.add(this.fbx);
    this.mixer = new THREE.AnimationMixer(this.fbx);
    const action = this.mixer.clipAction(this.fbx.animations[0]);
    action.play();

    this.pos = new THREE.Vector3(x, y, z);
    this.mesh.position.copy(this.pos);

    this.vel = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    );
    this.vel.clampLength(0, maxVel);

    this.acc = new THREE.Vector3(0, 0, 0);

    scene.add(this.mesh);
  }

  update(dt) {
    this.mixer.update(dt / 1000 + Math.random() / 50);
    this.flock();

    this.vel.add(this.acc.multiplyScalar(dt));
    this.vel.clampLength(0, maxVel);
    this.pos.add(this.vel.multiplyScalar(dt));
    // if (this.pos.x < -scale) {
    //   this.pos.x = scale + scale + this.pos.x;
    // } else if (this.pos.x > scale) {
    //   this.pos.x = -scale - scale + this.pos.x;
    // }
    // if (this.pos.z < -scale) {
    //   this.pos.z = scale + scale + this.pos.z;
    // } else if (this.pos.z > scale) {
    //   this.pos.z = -scale - scale + this.pos.z;
    // }
    // if (this.pos.y > scale) {
    //   this.pos.y = this.pos.y - scale - scale;
    // } else if (this.pos.y < -scale) {
    //   this.pos.y = scale + scale + this.pos.y;
    // }
    this.acc.multiplyScalar(0);

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.order = 'YXZ';
    let flatLengthSq = this.vel.x * this.vel.x + this.vel.z * this.vel.z;
    if (flatLengthSq > maxVel * maxVel / 100) {
      this.mesh.rotation.y = Math.PI + Math.atan2(this.vel.x, this.vel.z);
    }
    this.mesh.rotation.x = Math.atan2(
      this.vel.y,
      Math.sqrt(flatLengthSq)
    );

    // this.mesh.quaternion.setFromUnitVectors(
    //   new THREE.Vecto.1;r3(0, 0, -1),
    //   new THREE.Vector3(0, 0, 0).copy(this.vel).normalize()
    // );
  }

  flock() {
    const sep = this.separate();
    const ali = this.align();
    const coh = this.cohesion();
    // const fear = this.fear();
    const walls = this.walls(5);
    const panicWalls = this.walls(1);

    sep.multiplyScalar(1.5);
    // ali.multiplyScalar(1.5);
    // coh.multiplyScalar(1.5);
    // fear.multiplyScalar(3);
    walls.multiplyScalar(0.5);
    panicWalls.multiplyScalar(2);
    this.acc.add(sep);
    this.acc.add(ali);
    this.acc.add(coh);
    // this.acc.add(fear);
    this.acc.add(walls);
    this.acc.add(panicWalls);
  }

  seek(target) {
    const des = new THREE.Vector3(0, 0, 0);
    des.copy(target);
    des.sub(this.pos);
    des.setLength(maxVel);

    const steer = des;
    steer.sub(this.vel);
    steer.clampLength(0, maxForce);
    return steer;
  }

  separate() {
    const desiredSeparation = 32;
    const steer = new THREE.Vector3(0, 0, 0);

    let count = 0;
    for (let boid of this.boids) {
      let d = this.pos.distanceToSquared(boid.pos);
      if (d < 0.0001 || d > desiredSeparation) {
        continue;
      }

      let diff = new THREE.Vector3(0, 0, 0)
        .subVectors(this.pos, boid.pos);
      diff.setLength(1 / Math.sqrt(d));
      steer.add(diff);
      count += 1;
    }
    if (count === 0) {
      return steer;
    }

    steer.multiplyScalar(1 / count);

    if (steer.lengthSq() > 0) {
      steer.setLength(maxVel);
      steer.sub(this.vel);
      steer.clampLength(0, maxForce);
    }
    return steer;
  }

  align() {
    const neighborDist = 100;
    const sum = new THREE.Vector3(0, 0, 0);

    let count = 0;
    for (let boid of this.boids) {
      let d = this.pos.distanceToSquared(boid.pos);
      if (d < 0.0001 || d > neighborDist) {
        continue;
      }

      sum.add(boid.vel);
      count += 1;
    }

    if (count === 0) {
      return sum;
    }

    sum.setLength(maxVel);
    sum.sub(this.vel);
    sum.clampLength(0, maxForce);
    return sum;
  }

  cohesion() {
    const neighborDist = 100;
    const sum = new THREE.Vector3(0, 0, 0);

    let count = 0;
    for (let boid of this.boids) {
      let d = this.pos.distanceToSquared(boid.pos);
      if (d < 0.0001 || d > neighborDist) {
        continue;
      }

      sum.add(boid.pos);
      count += 1;
    }

    if (count === 0) {
      return sum;
    }

    sum.multiplyScalar(1 / count);

    return this.seek(sum);
  }

  fear() {
    const desiredSeparation = 100;
    const fearPos = new THREE.Vector3(0, 0, 0);
    const diff = new THREE.Vector3().subVectors(this.pos, fearPos);

    if (diff.lengthSq() > desiredSeparation) {
      return new THREE.Vector3(0, 0, 0);
    }

    diff.setLength(maxVel);
    diff.sub(this.vel);
    diff.clampLength(0, maxForce);

    return diff;
  }

  walls(allowance) {
    const scale = 20;
    let sum = new THREE.Vector3(0, 0, 0);

    if (this.pos.x < -scale + allowance && this.vel.x < 0) {
      sum.add(new THREE.Vector3(1, 0, 0));
    }
    if (this.pos.x > scale - allowance && this.vel.x > 0) {
      sum.add(new THREE.Vector3(-1, 0, 0));
    }
    if (this.pos.y < -scale + allowance && this.vel.y < 0) {
      sum.add(new THREE.Vector3(0, 1, 0));
    }
    if (this.pos.y > scale - allowance && this.vel.y > 0) {
      sum.add(new THREE.Vector3(0, -1, 0));
    }
    if (this.pos.z < -scale + allowance && this.vel.z < 0) {
      sum.add(new THREE.Vector3(0, 0, 1));
    }
    if (this.pos.z > scale - allowance && this.vel.z > 0) {
      sum.add(new THREE.Vector3(0, 0, -1));
    }

    if (sum.lengthSq() < 1) {
      return sum;
    }

    // sum.setLength(maxVel);
    // sum.sub(this.vel);
    sum.clampLength(0, maxForce);

    return sum;
  }

}
