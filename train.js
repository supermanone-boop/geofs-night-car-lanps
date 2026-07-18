(async () => {

    const scene = geofs.api.viewer.scene;
    const globe = scene.globe;

    const DISPLAY_DISTANCE = 500; // m
    const TRAIN_SPACING = 1500;   // m
    const SPEED = 0.04;

    const TRAIN_MODELS = [

        {
            url: "https://www.geo-fs.com/backend/aircraft/repository/metroliner_267286_5772/metroliner.glb",
            scale: 1
        },

        {
            url: "https://www.geo-fs.com/backend/aircraft/repository/genesis_267286_5909/genesis.glb",
            scale: 1
        }

    ];

    function distance(a, b) {

        return geofs.utils.llaDistanceInMeters(
            a,
            b
        );

    }

    function createModel(vehicle) {

        return scene.primitives.add(

            Cesium.Model.fromGltf({

                url: vehicle.url,

                scale: vehicle.scale

            })

        );

    }

    console.log("線路データ取得中...");

    const data = await fetch(
        "https://raw.githubusercontent.com/supermanone-boop/model/main/3export.geojson"
    ).then(r => r.json());

    const rawRailways = data.features.filter(

        f =>

            f.geometry &&
            f.geometry.type === "LineString" &&
            f.geometry.coordinates.length > 1

    );

    console.log(
        rawRailways.length +
        " 本の線路を検出"
    );

    // 線路結合

    const railways = [];

    for (const feature of rawRailways) {

        const pts = [...feature.geometry.coordinates];

        let merged = false;

        for (const line of railways) {

            const last = line[
                line.length - 1
            ];

            const first = pts[0];

            const d = distance(

                [
                    last[1],
                    last[0],
                    0
                ],

                [
                    first[1],
                    first[0],
                    0
                ]

            );

            if (d < 100) {

                line.push(

                    ...pts.slice(1)

                );

                merged = true;

                break;

            }

        }

        if (!merged) {

            railways.push(
                pts
            );

        }

    }

    console.log(
        railways.length +
        " 本に結合"
    );

    const trains = [];

    for (const points of railways) {

        const cumulative = [0];

        let totalLength = 0;

        for (

            let i = 0;

            i < points.length - 1;

            i++

        ) {

            const d = distance(

                [
                    points[i][1],
                    points[i][0],
                    0
                ],

                [
                    points[i + 1][1],
                    points[i + 1][0],
                    0
                ]

            );

            totalLength += d;

            cumulative.push(
                totalLength
            );

        }

        if (

            totalLength <
            TRAIN_SPACING

        ) {

            continue;

        }

        for (

            let target = 0;

            target < totalLength;

            target += TRAIN_SPACING

        ) {

            let segment = 0;

            while (

                segment <
                    cumulative.length - 1 &&

                cumulative[
                    segment + 1
                ] < target

            ) {

                segment++;

            }

            const segmentLength =

                cumulative[
                    segment + 1
                ] -

                cumulative[
                    segment
                ];

            const local =

                target -

                cumulative[
                    segment
                ];

            const t =

                segmentLength > 0

                    ?

                    local /

                    segmentLength

                    :

                    0;

            const vehicle =

                TRAIN_MODELS[
                    Math.floor(
                        Math.random() *
                        TRAIN_MODELS.length
                    )
                ];

            trains.push({

                model: null,

                vehicle,

                points,

                index:

                    segment + t,

                speed: SPEED

            });

        }

    }

    console.log(
        trains.length +
        " 編成を生成"
    );

    function update() {

        const player =

            geofs.aircraft
                .instance
                .llaLocation;

        for (

            const train

            of trains

        ) {

            train.index +=
                train.speed;

            const pts =
                train.points;

            const segment =

                Math.floor(
                    train.index
                ) %

                pts.length;

            const next =

                (
                    segment + 1
                ) %

                pts.length;

            const t =

                train.index -

                Math.floor(
                    train.index
                );

            const [

                lon1,

                lat1

            ] = pts[
                segment
            ];

            const [

                lon2,

                lat2

            ] = pts[
                next
            ];

            const lon =

                lon1 +

                (
                    lon2 -
                    lon1
                ) * t;

            const lat =

                lat1 +

                (
                    lat2 -
                    lat1
                ) * t;

            const d = distance(

                player,

                [
                    lat,
                    lon,
                    0
                ]

            );

            if (

                d >

                DISPLAY_DISTANCE

            ) {

                if (

                    train.model

                ) {

                    scene.primitives.remove(

                        train.model

                    );

                    train.model = null;

                }

                continue;

            }

            if (

                !train.model

            ) {

                train.model =

                    createModel(

                        train.vehicle

                    );

            }

            const height =

                globe.getHeight(

                    Cesium.Cartographic.fromDegrees(

                        lon,

                        lat

                    )

                ) || 0;

            const heading =

                Math.atan2(

                    lon2 - lon1,

                    lat2 - lat1

                );

            train.model.modelMatrix =

                Cesium.Transforms.headingPitchRollToFixedFrame(

                    Cesium.Cartesian3.fromDegrees(

                        lon,

                        lat,

                        height + 1

                    ),

                    new Cesium.HeadingPitchRoll(

                        heading,

                        0,

                        0

                    )

                );

        }

        requestAnimationFrame(
            update
        );

    }

    update();

})();