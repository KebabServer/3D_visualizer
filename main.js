// Hankitaan kanvaasi ja konteksti
const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d');

// Asetetaan kanvaasin koko selainikkunan kokoiseksi
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;



// --- Apufunktiot ja Perusrakenteet ---


// 3D-vektori/piste - LISÄTTY MUUTAMIA METODEJA
class Vector3D {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    add(vec) {
        return new Vector3D(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }
    subtract(vec) {
        return new Vector3D(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }
    scale(scalar) {
        return new Vector3D(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    lengthSq() { // Neliöity pituus (nopeampi kuin length, koska ei neliöjuurta)
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }
    normalize() {
        const len = this.length();
        if (len === 0) return new Vector3D();
        return new Vector3D(this.x / len, this.y / len, this.z / len);
    }
    dot(vec) {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }
    cross(vec) {
        return new Vector3D(
            this.y * vec.z - this.z * vec.y,
            this.z * vec.x - this.x * vec.z,
            this.x * vec.y - this.y * vec.x
        );
    }

    lerp(targetVec, t) {
        // Lineaarinen interpolaatio: this + (target - this) * t
        return this.add(targetVec.subtract(this).scale(t));
    }

    clone() { // Kopioidaan vektori
        return new Vector3D(this.x, this.y, this.z);
    }
}

// Clamp-funktio arvon rajoittamiseksi
function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

// Kamera - Säädetään sijaintia ja kohdetta
const camera = {
    pos: new Vector3D(-10, 15, -20), // Siirretään kameraa sivummalle ja ylemmäs
    target: new Vector3D(5, 0, 5),  // Katsotaan portaiden suuntaan
    up: new Vector3D(0, 1, 0),
    fov: 60, // Pienennetään hieman näkökenttää
    near: 0.1,
    far: 1000
};

// 3D-Objekti (Mesh) - Lisätään tyyppi ja fysiikkaominaisuudet
class Mesh {
    constructor(vertices, edges, position = new Vector3D(), rotation = new Vector3D(), color = 'white', type = 'generic') {
        this.vertices = vertices; // Paikalliset koordinaatit
        this.edges = edges;       // Yhdistää verteksien indeksit
        this.position = position; // Sijainti maailmassa
        this.rotation = rotation; // Rotaatio (Euler-kulmat radiaaneina) - EI KÄYTETÄ TÄSSÄ ESIMERKISSÄ AKTIIVISESTI
        this.color = color;
        this.type = type; // 'cube', 'sphere', jne.

        // Fysiikkaominaisuudet (lisätään tarvittaessa)
        if (type === 'sphere') {
            this.radius = 0; // Asetetaan luonnin yhteydessä
            this.velocity = new Vector3D(0, 0, 0);
            this.bounciness = 0.7; // Kimmoisuuskerroin (0-1)
        }
        if (type === 'cube') {
            // Kuution puolikkaat mitat (oletetaan paikallinen keskipiste 0,0,0)
            // Nämä pitäisi laskea verteksien perusteella tai asettaa erikseen
            // Oletetaan standardikuutiolle (koko 2x2x2)
            this.halfExtents = new Vector3D(1, 1, 1);
            // Jos porraskuutio on eri kokoinen, säädä tätä tai laske tarkemmin
        }
    }
}

// --- Luodaan Objekteja ---

const sceneObjects = []; // Tyhjennetään vanhat ja lisätään uudet

// Portaiden parametrit
const stepCount = 10;
const stepWidth = 4;
const stepHeight = 1;
const stepDepth = 2;
const startPos = new Vector3D(0, 0, 0);

// Porraskuutioiden verteksit (esim. 4 leveä, 1 korkea, 2 syvä)
const stepVertices = [
    new Vector3D(-stepWidth / 2, -stepHeight / 2, -stepDepth / 2), new Vector3D(stepWidth / 2, -stepHeight / 2, -stepDepth / 2),
    new Vector3D(stepWidth / 2, stepHeight / 2, -stepDepth / 2), new Vector3D(-stepWidth / 2, stepHeight / 2, -stepDepth / 2),
    new Vector3D(-stepWidth / 2, -stepHeight / 2, stepDepth / 2), new Vector3D(stepWidth / 2, -stepHeight / 2, stepDepth / 2),
    new Vector3D(stepWidth / 2, stepHeight / 2, stepDepth / 2), new Vector3D(-stepWidth / 2, stepHeight / 2, stepDepth / 2)
];
const stepEdges = [ // Samat särmät kuin aiemmassa kuutiossa
    [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
];
const stepHalfExtents = new Vector3D(stepWidth / 2, stepHeight / 2, stepDepth / 2);

// Luodaan porraskuutio
for (let i = 0; i < stepCount; i++) {
    const pos = new Vector3D(
        startPos.x,
        startPos.y + i * stepHeight,
        startPos.z + i * stepDepth
    );

    // --- LISÄTÄÄN VÄRIN LASKENTA ---
    // Lasketaan sävy (0-360) portaan indeksin perusteella
    // Esim. 0 -> punainen, 120 -> vihreä, 240 -> sininen
    const hue = (i / stepCount) * 300; // Käytetään esim. 0-300 astetta väriympyrästä
    const color = `hsl(${hue}, 80%, 60%)`; // Kirkkaat värit (80% saturaatio, 60% valoisuus)
    // --- VÄRIN LASKENTA LOPPUU ---

    // Käytetään laskettua väriä Mesh-konstruktorissa
    const stairCube = new Mesh(stepVertices, stepEdges, pos, new Vector3D(), color, 'cube'); // Käytä 'color'
    stairCube.halfExtents = stepHalfExtents;
    sceneObjects.push(stairCube);
}

// --- Laske portaiden keskipiste ---
const stairCenterX = startPos.x;
// Y-keskipiste on puolivälissä portaiden korkeutta
const stairCenterY = startPos.y + (stepCount * stepHeight) / 2;
// Z-keskipiste on suunnilleen puolivälissä portaiden syvyyttä
// (Tämä on approksimaatio, riippuu miten stepDepth vaikuttaa)
const stairCenterZ = startPos.z + ((stepCount - 1) * stepDepth) / 2;
const stairCenter = new Vector3D(stairCenterX, stairCenterY, stairCenterZ);
// --- Keskipisteen laskenta loppuu ---

// Pallon luonti (käytetään createSphere-funktiota)
function createSphere(radius, latitudeBands, longitudeBands) {
    // ... (koodi createSphere-funktiolle kuten edellisessä vastauksessa) ...
    // Tässä lyhennettynä, kopioi koko funktio edellisestä vastauksesta
    const vertices = []; const edges = [];
    for (let lat = 0; lat <= latitudeBands; lat++) {
        const theta = lat * Math.PI / latitudeBands;
        const sinT = Math.sin(theta); const cosT = Math.cos(theta);
        for (let lon = 0; lon <= longitudeBands; lon++) {
            const phi = lon * 2 * Math.PI / longitudeBands;
            const sinP = Math.sin(phi); const cosP = Math.cos(phi);
            vertices.push(new Vector3D(radius * sinT * cosP, radius * cosT, radius * sinT * sinP));
        }
    }
    for (let lat = 0; lat < latitudeBands; lat++) {
        for (let lon = 0; lon < longitudeBands; lon++) {
            const current = lat * (longitudeBands + 1) + lon;
            const nextLon = current + 1; const nextLat = current + longitudeBands + 1; const nextLatLon = nextLat + 1;
            edges.push([current, nextLon]); edges.push([current, nextLat]);
            //edges.push([nextLon, nextLatLon]); edges.push([nextLat, nextLatLon]); // Voit lisätä nämä jos haluat enemmän viivoja
        }
    }
    return { vertices, edges };
}



const ballRadius = 0.8;
const ballDetail = 8; // Vähemmän yksityiskohtia palloon (nopeampi)
const sphereGeometry = createSphere(ballRadius, ballDetail, ballDetail * 2);

// Asetetaan pallon alkusijainti ylimmän portaan yläpuolelle
const ballStartPos = new Vector3D(
    startPos.x,
    startPos.y + stepCount * stepHeight + ballRadius * 2, // Aloittaa ylimmän tason yläpuolelta
    startPos.z + (stepCount - 1) * stepDepth // Suunnilleen ylimmän tason kohdalta Z-suunnassa
);

const ball = new Mesh(
    sphereGeometry.vertices,
    sphereGeometry.edges,
    ballStartPos,
    new Vector3D(0, 0, 0),
    '#FF8800', // Oranssi pallo
    'sphere'
);
ball.radius = ballRadius;
ball.velocity = new Vector3D(0, 0, -1.8); // Annetaan pieni alkuvauhti eteenpäin
ball.bounciness = 0.6; // Säädä kimmoisuutta
sceneObjects.push(ball);

// --- Kameran kiertoradan parametrit ---
let cameraAnimationTime = 0; // Aikaa seurataan animaatiossa
const cameraAnimationDuration = 12.0; // sekuntia koko liikkeelle
const cameraOrbitRadius = 18;         // Etäisyys keskipisteestä (X/Z-tasossa)
const cameraStartY = stairCenter.y + 15; // Aloituskorkeus
const cameraEndY = stairCenter.y + 6;   // Loppukorkeus
const cameraStartAngle = -Math.PI / 1.8; // Aloituskulma radiaaneina (n. -100 astetta, takaviistosta)
const cameraEndAngle = Math.PI / 4;     // Loppukulma radiaaneina (45 astetta, etuviistoon)
// --- Parametrit loppuu ---


// --- Aseta kameran ALKUSIJAINTI ja KOHDE ---
// Lasketaan sijainti ajanhetkellä t=0
const initialAngle = cameraStartAngle;
const initialCamX = stairCenter.x + cameraOrbitRadius * Math.cos(initialAngle);
const initialCamZ = stairCenter.z + cameraOrbitRadius * Math.sin(initialAngle);
camera.pos = new Vector3D(initialCamX, cameraStartY, initialCamZ);
// Kohdistetaan kamera portaiden keskipisteeseen
camera.target = stairCenter.clone();
// --- Alkutilan asetus loppuu ---


// --- Fysiikka ja Törmäykset ---
const gravity = 9.81;

// Törmäystarkistus: Pallo vs. Akselinsuuntainen laatikko (AABB)
function checkCollisionSphereAABB(sphere, cube) {
    // Etsi laatikon lähin piste pallon keskipisteeseen
    const closestPoint = new Vector3D(
        clamp(sphere.position.x, cube.position.x - cube.halfExtents.x, cube.position.x + cube.halfExtents.x),
        clamp(sphere.position.y, cube.position.y - cube.halfExtents.y, cube.position.y + cube.halfExtents.y),
        clamp(sphere.position.z, cube.position.z - cube.halfExtents.z, cube.position.z + cube.halfExtents.z)
    );

    // Laske etäisyyden neliö pallon keskipisteen ja lähimmän pisteen välillä
    const distanceSq = sphere.position.subtract(closestPoint).lengthSq();

    // Jos etäisyyden neliö on pienempi kuin säteen neliö, tapahtuu törmäys
    if (distanceSq < (sphere.radius * sphere.radius)) {
        // Laske törmäysnormaali (suunta lähimmästä pisteestä pallon keskipisteeseen)
        let collisionNormal = sphere.position.subtract(closestPoint).normalize();
        // Jos pallo on täsmälleen laatikon keskellä (harvinaista), annetaan oletusnormaali ylöspäin
        if (collisionNormal.lengthSq() === 0) {
            collisionNormal = new Vector3D(0, 1, 0);
        }

        // Laske tunkeutumissyvyys (kuinka paljon pallo on laatikon sisällä)
        const penetrationDepth = sphere.radius - Math.sqrt(distanceSq);

        return {
            collided: true,
            normal: collisionNormal,
            penetration: penetrationDepth,
            closestPoint: closestPoint // Hyödyllinen debuggaukseen
        };
    }

    return { collided: false };
}


// --- Renderöinti (sama kuin aiemmin) ---
function project(point3D) { // Yksinkertaistettu versio ilman matriiseja
    let point = point3D.subtract(camera.pos);
    const forward = camera.target.subtract(camera.pos).normalize();
    const right = forward.cross(camera.up).normalize();
    const up = right.cross(forward).normalize(); // Oikea kameran ylös

    const camX = point.dot(right);
    const camY = point.dot(up);
    const camZ = point.dot(forward);

    if (camZ <= camera.near || camZ >= camera.far) return null;

    const fovFactor = 1 / Math.tan((camera.fov * Math.PI / 180) / 2);
    const aspectRatio = canvas.width / canvas.height;
    const ndcX = (camX * fovFactor) / (camZ * aspectRatio);
    const ndcY = (camY * fovFactor) / camZ;

    const screenX = (ndcX + 1) * 0.5 * canvas.width;
    const screenY = (1 - (ndcY + 1) * 0.5) * canvas.height;

    return { x: screenX, y: screenY, z: camZ }; // Palautetaan myös syvyys (z)
}

function rotate(point, rotation) { // Ei käytetä aktiivisesti tässä
    let p = point.clone(); // Käytä clone()
    // Rotaatiot (X, Y, Z)
    let sinX = Math.sin(rotation.x); let cosX = Math.cos(rotation.x);
    let y = p.y * cosX - p.z * sinX; let z = p.y * sinX + p.z * cosX;
    p.y = y; p.z = z;
    let sinY = Math.sin(rotation.y); let cosY = Math.cos(rotation.y);
    let x = p.x * cosY + p.z * sinY; z = -p.x * sinY + p.z * cosY;
    p.x = x; p.z = z;
    let sinZ = Math.sin(rotation.z); let cosZ = Math.cos(rotation.z);
    x = p.x * cosZ - p.y * sinZ; y = p.x * sinZ + p.y * cosZ;
    p.x = x; p.y = y;
    return p;
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Järjestetään objektit karkeasti syvyyden mukaan (kauimmaiset ensin)
    // Tämä on hyvin yksinkertainen "Painter's Algorithm", ei täydellinen
    sceneObjects.sort((a, b) => {
        const distA = camera.pos.subtract(a.position).lengthSq();
        const distB = camera.pos.subtract(b.position).lengthSq();
        return distB - distA; // Kauempi ensin
    });

    sceneObjects.forEach(mesh => {
        const projectedVertices = [];
        mesh.vertices.forEach(vertex => {
            let rotatedVertex = rotate(vertex, mesh.rotation); // Rotaatio (vaikka ei käytetä)
            let worldVertex = rotatedVertex.add(mesh.position); // Siirto
            const projectedPoint = project(worldVertex);
            projectedVertices.push(projectedPoint);
        });

        ctx.strokeStyle = mesh.color;
        ctx.lineWidth = (mesh.type === 'sphere') ? 1.5 : 1; // Pallo hieman paksummalla viivalla
        ctx.beginPath();
        mesh.edges.forEach(edge => {
            const startPoint = projectedVertices[edge[0]];
            const endPoint = projectedVertices[edge[1]];
            if (startPoint && endPoint) {
                // Voit lisätä tarkistuksen, ettei viiva mene näkymättömän alueen läpi
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.lineTo(endPoint.x, endPoint.y);
            }
        });
        ctx.stroke();
    });
}

// --- Päivitys ja Animaatio ---

let lastTime = 0;
const maxDeltaTime = 0.1; // Estää fysiikan sekoamisen, jos frame hyppää
const cameraFollowSpeed = 0.02; // Kuinka nopeasti kamera seuraa (0-1, pienempi = hitaampi)

function update(time = 0) {
    let deltaTime = (time - lastTime) * 0.001;
    lastTime = time;
    // Rajoitetaan deltaTime estämään fysiikan räjähtämistä tauon jälkeen
    deltaTime = Math.min(deltaTime, maxDeltaTime);


    // --- Pallon fysiikka ---
    if (ball && ball.type === 'sphere') {
        // 1. Painovoima
        ball.velocity.y -= gravity * deltaTime;
        ball.rotation.y += 0.005;
        // 2. Törmäystarkistus ja reagointi
        sceneObjects.forEach(obj => {
            if (obj.type === 'cube') { // Tarkista vain kuutioita vastaan
                const collisionInfo = checkCollisionSphereAABB(ball, obj);

                if (collisionInfo.collided) {
                    // Törmäysreaktio:
                    // Laske nopeus suhteessa normaaliin
                    const relativeVelocity = ball.velocity; // Oletetaan kuutio staattiseksi
                    const velocityAlongNormal = relativeVelocity.dot(collisionInfo.normal);

                    // Älä reagoi, jos pallo liikkuu jo poispäin pinnasta
                    if (velocityAlongNormal < 0) {
                        // Laske kimpoamisvoima (impulssi)
                        const restitution = ball.bounciness; // Pallon kimmoisuus
                        let j = -(1 + restitution) * velocityAlongNormal;
                        // Skaalataan impulssia (voisi ottaa massan huomioon, jos olisi)

                        // Muuta nopeutta impulssin suunnassa
                        const impulse = collisionInfo.normal.scale(j);
                        ball.velocity = ball.velocity.add(impulse);

                        // Kitka (yksinkertaistettu): Vähennetään tangentiaalista nopeutta hieman
                        const tangentVelocity = relativeVelocity.subtract(collisionInfo.normal.scale(velocityAlongNormal));
                        ball.velocity = ball.velocity.subtract(tangentVelocity.scale(0.1)); // 10% kitka

                        // Korjaa sijainti hieman ulos tunkeumasta (estää uppoamista)
                        const correction = collisionInfo.normal.scale(collisionInfo.penetration * 0.8); // 80% korjaus
                        ball.position = ball.position.add(correction);

                    }
                }
            }
        });

        // 3. Päivitä sijainti nopeuden mukaan
        ball.position = ball.position.add(ball.velocity.scale(deltaTime));

        // Resetoi pallo jos se tippuu liian alas
        if (ball.position.y < -20) {
            ball.position = ballStartPos.clone();
            ball.velocity = new Vector3D(0, 0, -3); // Resetoidaan myös nopeus
        }

        // --- KAMERAN PÄIVITYS (UUSI VERSIO) ---
        cameraAnimationTime += deltaTime; // Kasvata animaatioaikaa

        // Laske etenemä animaatiossa (0-1)
        const t = clamp(cameraAnimationTime / cameraAnimationDuration, 0, 1);

        // Laske nykyinen kulma ja korkeus interpolaation avulla
        const currentAngle = cameraStartAngle + (cameraEndAngle - cameraStartAngle) * t;
        const currentY = cameraStartY + (cameraEndY - cameraStartY) * t;

        // Laske kameran X ja Z sijainti kiertoradalla
        const camX = stairCenter.x + cameraOrbitRadius * Math.cos(currentAngle);
        const camZ = stairCenter.z + cameraOrbitRadius * Math.sin(currentAngle);

        // Aseta kameran uusi sijainti
        camera.pos.x = camX;
        camera.pos.y = currentY;
        camera.pos.z = camZ;

        // Varmista, että kamera katsoo edelleen keskipisteeseen (tai muuhun haluttuun kohteeseen)
        camera.target = stairCenter; // Pidä kohde keskipisteessä
        // --- KAMERAN PÄIVITYS LOPPUU ---

    } // End ball physics

}

// Animaatiosilmukka
function animationLoop(time) {
    update(time);
    render();
    requestAnimationFrame(animationLoop);
}

// Käynnistä animaatio
requestAnimationFrame(animationLoop);

// Päivitä kanvaasin koko, jos ikkunan koko muuttuu
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});