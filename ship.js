'use strict';

(async () => {

    const viewer = geofs.api.viewer;
    const scene = viewer.scene;
    const globe = scene.globe;

    const DISPLAY_DISTANCE = 1000; // m
    const SHIP_SPACING = 5000; // m
    const SPEED_KMH = 80;
    const STOP_TIME = 180000; // ms

    const SPEED_MPS = SPEED_KMH / 3.6;
    const UPDATE_DT = 1 / 60;

    const SHIPS = [

        {
            url: "https://www.geo-fs.com/backend/aircraft/repository/CMV%20Probability_267286_5009/prob1.glb",
            scale: 1,
            chance: 85
        },

        {
            url: "https://www.geo-fs.com/models/objects/carrier/carrier.gltf",
            scale: 1,
            chance: 10
        },

        {
            url: "https://www.geo-fs.com/backend/aircraft/repository/t052_267286_5719/ddg052d1.glb",
            scale: 1,
            chance: 2.5
        },

        {
            url: "https://www.geo-fs.com/backend/aircraft/repository/t055_267286_5682/055-109.glb",
            scale: 1,
            chance: 2.5
        }

    ];

    function chooseShip() {

        const r = Math.random() * 100;

        let sum = 0;

        for (const ship of SHIPS) {

            sum += ship.chance;

            if (r <= sum) {

                return ship;

            }

        }

        return SHIPS[0];
    }

    function dist(a, b) {

        return geofs.utils.llaDistanceInMeters(a, b);

    }

    function tri(p0, p1, p2) {

        const u = [
            p1[0] - p0[0],
            p1[1] - p0[1],
            p1[2] - p0[2]
        ];

        const v = [
            p2[0] - p0[0],
            p2[1] - p0[1],
            p2[2] - p0[2]
        ];

        const n = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0]
        ];

        return Object.assign(
            [p0, p1, p2],
            { u, v, n }
        );
    }

    function makeCollision() {

        const tris = [];

        const RADIUS = 1000;
        const SEGMENTS = 96;

        for (let i = 0; i < SEGMENTS; i++) {

            const a0 =
                i / SEGMENTS * Math.PI * 2;

            const a1 =
                (i + 1) / SEGMENTS * Math.PI * 2;

            tris.push(

                tri(

                    [0, 0, 0],

                    [

                        Math.cos(a0) * RADIUS,

                        Math.sin(a0) * RADIUS,

                        0

                    ],

                    [

                        Math.cos(a1) * RADIUS,

                        Math.sin(a1) * RADIUS,

                        0

                    ]

                )

            );

        }

        return tris;

    }

    const data = await fetch(

        "https://raw.githubusercontent.com/supermanone-boop/model/main/shipexport.geojson"

    ).then(

        r => r.json()

    );

    const ships = [];

    for (

        const feature

        of data.features

    ) {

        if (

            !feature.geometry ||

            feature.geometry.type !== "LineString"

        ) {

            continue;

        }

        const pts =
            feature.geometry.coordinates;

        let total = 0;

        const cumulative = [0];

        for (

            let i = 0;

            i < pts.length - 1;

            i++

        ) {

            total += dist(

                [

                    pts[i][1],

                    pts[i][0],

                    0

                ],

                [

                    pts[i + 1][1],

                    pts[i + 1][0],

                    0

                ]

            );

            cumulative.push(total);

        }

        for (

            let d = 0;

            d < total;

            d += SHIP_SPACING

        ) {

            let seg = 0;

            while (

                cumulative[seg + 1] < d

            ) {

                seg++;

            }

            const shipType =
                chooseShip();

            ships.push({

                type: shipType,

                points: pts,

                segment: seg,

                offset: 0,

                forward: true,

                waiting: false,

                waitStart: 0,

                model: null,

                collision: null

            });

        }

    }

    function spawn(ship) {

        ship.model = scene.primitives.add(

            Cesium.Model.fromGltf({

                url: ship.type.url,

                scale: ship.type.scale

            })

        );

        ship.collision = {

            name: "SHIP",

            type: 100,

            url: "",

            location: [0, 0, 0],

            llaLocation: [0, 0, 0],

            htr: [0, 0, 0],

            rotateModelOnly: false,

            scale: 1,

            metricOffset: [0, 0, 0],

            collisionRadius: 1000,

            collisionTriangles:

                makeCollision(),

            options: {}

        };

        geofs.objects.objectList.push(

            ship.collision

        );

    }

    function remove(ship) {

        if (ship.model) {

            scene.primitives.remove(

                ship.model

            );

            ship.model = null;

        }

        if (ship.collision) {

            const i =

                geofs.objects.objectList.indexOf(

                    ship.collision

                );

            if (i !== -1) {

                geofs.objects.objectList.splice(

                    i,

                    1

                );

            }

            ship.collision = null;

        }

    }

    function update() {

        const player =

            geofs.aircraft.instance.llaLocation;

        for (

            const ship

            of ships

        ) {

            const pts = ship.points;

            const p = pts[ship.segment];

            const pos = [

                p[1],

                p[0],

                0

            ];

            const d = dist(

                player,

                pos

            );

            if (

                d < DISPLAY_DISTANCE

            ) {

                if (

                    !ship.model

                ) {

                    spawn(ship);

                }

            } else {

                remove(ship);

                continue;

            }

            if (

                ship.waiting

            ) {

                if (

                    Date.now() -

                    ship.waitStart >

                    STOP_TIME

                ) {

                    ship.waiting = false;

                    ship.forward =

                        !ship.forward;

                }

                continue;

            }

            ship.offset +=

                SPEED_MPS *

                UPDATE_DT;

            while (

                ship.offset > 50

            ) {

                ship.offset -= 50;

                ship.segment +=

                    ship.forward

                        ? 1

                        : -1;

                if (

                    ship.segment >=

                    pts.length - 1 ||

                    ship.segment <= 0

                ) {

                    ship.segment = Math.max(

                        0,

                        Math.min(

                            pts.length - 1,

                            ship.segment

                        )

                    );

                    ship.waiting = true;

                    ship.waitStart =

                        Date.now();

                }

            }

            const cur =
                pts[ship.segment];

            const next =
                pts[
                    ship.forward

                        ? Math.min(

                              pts.length - 1,

                              ship.segment + 1

                          )

                        : Math.max(

                              0,

                              ship.segment - 1

                          )

                ];

            const lon = cur[0];
            const lat = cur[1];

            const heading = Math.atan2(

                next[0] - cur[0],

                next[1] - cur[1]

            );

            const h =
                globe.getHeight(

                    Cesium.Cartographic.fromDegrees(

                        lon,

                        lat

                    )

                ) || 0;

            const matrix =

                Cesium.Transforms.headingPitchRollToFixedFrame(

                    Cesium.Cartesian3.fromDegrees(

                        lon,

                        lat,

                        h

                    ),

                    new Cesium.HeadingPitchRoll(

                        heading,

                        0,

                        0

                    )

                );

            ship.model.modelMatrix =

                matrix;

            ship.collision.location = [

                lat,

                lon,

                h + 22

            ];

            ship.collision.llaLocation = [

                lat,

                lon,

                h + 22

            ];

        }

        requestAnimationFrame(

            update

        );

    }

    update();

})();