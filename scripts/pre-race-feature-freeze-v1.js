'use strict';

// Research-only copy of program fields at the same instant as the immutable
// PROGRAM_ONLY prediction. Never recover these fields from a mutable program
// file after the race.
const BOAT_FIELDS=[
  'lane','registration','class','fCount','lCount','avgST',
  'nationalWinRate','national2Rate','national3Rate',
  'localWinRate','local2Rate','local3Rate',
  'motor','motor2Rate','boat','boat2Rate'
];

function freeze(program,generatedAt){
  if(!program||program.resultEndpointsIncluded!==false||
     program.resultIncluded!==false||program.exhibitionIncluded!==false)return null;
  const fetched=Date.parse(program.fetchedAt);
  const generated=Date.parse(generatedAt);
  const deadline=Date.parse(`${program.date}T${program.deadline}:00+09:00`);
  if(!Number.isFinite(fetched)||!Number.isFinite(generated)||
     !Number.isFinite(deadline)||fetched>generated||generated>deadline-180000)return null;
  const boats=Array.isArray(program.boats)?[...program.boats].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
  if(boats.length!==6||boats.some((b,i)=>Number(b.lane)!==i+1))return null;
  return {
    schema:'boat-command-pre-race-feature-freeze-v1',
    researchOnly:true,resultInput:false,payoutInput:false,
    programFetchedAt:program.fetchedAt,
    raceType:String(program.raceType||''),
    boats:boats.map(boat=>Object.fromEntries(BOAT_FIELDS.map(key=>[
      key,boat[key]??null
    ])))
  };
}

module.exports={freeze};
