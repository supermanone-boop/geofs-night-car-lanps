'use strict';

(async()=>{

const viewer=geofs.api.viewer;
const scene=viewer.scene;
const globe=scene.globe;

const CAR_SPACING=80;
const SPEED_MPS=60/3.6;

const LOW_ALTITUDE_FEET=3000;
const LOW_ALTITUDE_RADIUS=1500;

const URLS=[
"https://raw.githubusercontent.com/supermanone-boop/model/main/hanshinexport.geojson",
"https://raw.githubusercontent.com/supermanone-boop/model/main/hokusetuexport.geojson",
"https://raw.githubusercontent.com/supermanone-boop/model/main/kyotoexport.geojson",
"https://raw.githubusercontent.com/supermanone-boop/model/main/kyotoshiexport.geojson",
"https://raw.githubusercontent.com/supermanone-boop/model/main/sakaiexport.geojson",
https://raw.githubusercontent.com/supermanone-boop/model/main/sennanexport.geojson,
https://raw.githubusercontent.com/supermanone-boop/model/main/senshuexport.geojson,
https://raw.githubusercontent.com/supermanone-boop/model/main/shinaiexport.geojson

];

const lights=scene.primitives.add(
    new Cesium.PointPrimitiveCollection()
);

const distance=(a,b)=>
    geofs.utils.llaDistanceInMeters(a,b);

console.log("道路データ読み込み中...");

const data=await Promise.all(
    URLS.map(
        url=>fetch(url).then(r=>r.json())
    )
);

const roads=data.flatMap(
    x=>x.features
);

const cars=[];

for(const feature of roads){

    if(
        !feature.geometry ||
        feature.geometry.type!=="LineString"
    ) continue;

    const pts=feature.geometry.coordinates;

    let total=0;
    const cumulative=[0];

    for(let i=0;i<pts.length-1;i++){

        total+=distance(
            [pts[i][1],pts[i][0],0],
            [pts[i+1][1],pts[i+1][0],0]
        );

        cumulative.push(total);
    }

    for(let d=0;d<total;d+=CAR_SPACING){

        let seg=0;

        while(
            seg<cumulative.length-1 &&
            cumulative[seg+1]<d
        ){
            seg++;
        }

        const segLen=
            cumulative[seg+1]-
            cumulative[seg];

        cars.push({

            index:cars.length,

            points:pts,

            segment:seg,

            t:segLen>0
                ? (d-cumulative[seg])/segLen
                : 0,

            speed:SPEED_MPS*
                (0.9+Math.random()*0.2),

            point:null
        });
    }
}

console.log(cars.length,"台生成");

let lastTime=performance.now();

function update(){

    const now=performance.now();
    const dt=(now-lastTime)/1000;

    lastTime=now;

    const player=
        geofs.aircraft.instance.llaLocation;

    const altitudeFeet=
        geofs.aircraft.instance.altitude;

    const lowAltitude=
        altitudeFeet<LOW_ALTITUDE_FEET;

    for(const car of cars){

        const pts=car.points;

        const current=
            pts[car.segment];

        const next=
            pts[
                (car.segment+1)
                % pts.length
            ];

        if(!next) continue;

        const segmentLength=distance(
            [current[1],current[0],0],
            [next[1],next[0],0]
        );

        car.t+=
            (car.speed*dt)/
            segmentLength;

        while(car.t>=1){

            car.t-=1;
            car.segment++;

            if(
                car.segment>=
                pts.length-1
            ){
                car.segment=0;
            }
        }

        const lon=
            current[0]+
            (next[0]-current[0])*
            car.t;

        const lat=
            current[1]+
            (next[1]-current[1])*
            car.t;

        const distToPlayer=
            distance(
                player,
                [lat,lon,0]
            );

        let visible;

        if(lowAltitude){

            visible=
                distToPlayer<
                LOW_ALTITUDE_RADIUS;

        }else{

            visible=

                distToPlayer<5000

                    ?

                    car.index%10<5

                    :

                    car.index%20<2;
        }

        if(!visible){

            if(car.point){

                lights.remove(
                    car.point
                );

                car.point=null;
            }

            continue;
        }

        const movingNorth=
            next[1]>
            current[1];

        const color=
            movingNorth

                ?

                new Cesium.Color(
                    1.0,
                    0.96,
                    0.90,
                    0.95
                )

                :

                new Cesium.Color(
                    1.0,
                    0.15,
                    0.1,
                    0.9
                );

        const height=
            globe.getHeight(
                Cesium.Cartographic.fromDegrees(
                    lon,
                    lat
                )
            ) || 0;

        const position=
            Cesium.Cartesian3.fromDegrees(
                lon,
                lat,
                height+1.2
            );

        const size=lowAltitude

            ?

            Math.max(
                1.2,
                3-distToPlayer/700
            )

            :

            Math.max(
                0.4,
                2-distToPlayer/4000
            );

        if(!car.point){

            car.point=
                lights.add({

                    position,

                    pixelSize:size,

                    color

                });

        }else{

            car.point.position=
                position;

            car.point.color=
                color;

            car.point.pixelSize=
                size;
        }
    }

    requestAnimationFrame(
        update
    );
}

update();

})();