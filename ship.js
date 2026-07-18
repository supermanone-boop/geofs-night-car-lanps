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

    function distance(a, b) {

        return geofs.utils.llaDistanceInMeters(
            a,
            b
        );

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

    function createCollision() {

        const collisionTriangles = [];

        const RADIUS = 1000;
        const SEGMENTS = 96;

        for (let i = 0; i < SEGMENTS; i++) {

            const a0 =
                (i / SEGMENTS) *
                Math.PI * 2;

            const a1 =
                ((i + 1) / SEGMENTS) *
                Math.PI * 2;

            collisionTriangles.push(

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

        return {

            name: "SHIP_COLLISION",

            type: 100,

            url: "",

            location: [0, 0, 0],

            llaLocation: [0, 0, 0],

            htr: [0, 0, 0],

            rotateModelOnly: false,

            scale: 1,

            metricOffset: [0, 0, 0],

            collisionRadius: RADIUS,

            collisionTriangles,

            options: {}

        };

    }

    function createModel(type) {

        return scene.primitives.add(

            Cesium.Model.fromGltf({

                url: type.url,

                scale: type.scale

            })

        );

    }

    const data = await fetch(

        "https://raw.githubusercontent.com/supermanone-boop/model/main/shipexport.geojson"

    ).then(

        r => r.json()

    );

    const ships = [];

    for (const feature of data.features) {

        if (

            !feature.geometry ||

            feature.geometry.type !== "LineString"

        ) {

            continue;

        }

        const pts =
            feature.geometry.coordinates;

        const cumulative = [0];

        let totalLength = 0;

        for (

            let i = 0;

            i < pts.length - 1;

            i++

        ) {

            totalLength += distance(

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

            cumulative.push(
                totalLength
            );

        }

        for (

            let d = 0;

            d < totalLength;

            d += SHIP_SPACING

        ) {

            let seg = 0;

            while (

                seg < cumulative.length - 1 &&

                cumulative[
                    seg + 1
                ] < d

            ) {

                seg++;

            }

            const segmentLength =

                cumulative[
                    seg + 1
                ] -

                cumulative[
                    seg
                ];

            const t =

                segmentLength > 0

                    ?

                    (

                        d -

                        cumulative[
                            seg
                        ]

                    ) /

                    segmentLength

                    :

                    0;

            ships.push({

                type:
                    chooseShip(),

                points: pts,

                segment: seg,

                t,

                forward: true,

                waiting: false,

                waitStart: 0,

                model: null,

                collision: null

            });

        }

    }

    console.log(

        ships.length +

        " 隻準備完了"

    );

    function spawn(ship) {

        ship.model =

            createModel(

                ship.type

            );

        ship.collision =

            createCollision();

        geofs.objects.objectList.push(

            ship.collision

        );

    }

    function remove(ship) {

        if (

            ship.model

        ) {

            scene.primitives.remove(

                ship.model

            );

            ship.model = null;

        }

        if (

            ship.collision

        ) {

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

    let lastTime =
        performance.now();

    function update() {

        const now =
            performance.now();

        const dt =

            (

                now -

                lastTime

            ) / 1000;

        lastTime = now;

        const player =

            geofs.aircraft.instance.llaLocation;

        for (

            const ship

            of ships

        ) {

            const pts =
                ship.points;

            const currentPoint =

                pts[
                    ship.segment
                ];

            const distToPlayer =

                distance(

                    player,

                    [

                        currentPoint[1],

                        currentPoint[0],

                        0

                    ]

                );

            if (

                distToPlayer >

                DISPLAY_DISTANCE

            ) {

                remove(

                    ship

                );

                continue;

            }

            if (

                !ship.model

            ) {

                spawn(

                    ship

                );

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

            } else {

                const nextIndex =

                    ship.forward

                        ?

                        ship.segment + 1

                        :

                        ship.segment - 1;

                const nextPoint =

                    pts[
                        nextIndex
                    ];

                if (

                    !nextPoint

                ) {

                    ship.waiting = true;

                    ship.waitStart =

                        Date.now();

                } else {

                    const segmentLength =

                        distance(

                            [

                                currentPoint[1],

                                currentPoint[0],

                                0

                            ],

                            [

                                nextPoint[1],

                                nextPoint[0],

                                0

                            ]

                        );

                    ship.t +=

                        (

                            SPEED_MPS *

                            dt

                        ) /

                        segmentLength;

                    while (

                        ship.t >= 1

                    ) {

                        ship.t -= 1;

                        ship.segment +=

                            ship.forward

                                ? 1

                                : -1;

                        if (

                            ship.segment <= 0 ||

                            ship.segment >=

                            pts.length - 1

                        ) {

                            ship.segment = Math.max(

                                0,

                                Math.min(

                                    pts.length