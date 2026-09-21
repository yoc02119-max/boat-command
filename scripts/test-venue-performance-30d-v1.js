#!/usr/bin/env node
'use strict';
const assert=require('assert');
const perf=require('../venue-performance-30d-v1.js');

assert.equal(perf.version,'VENUE-PERFORMANCE-30D-V1');
assert.equal(perf.windowDays,30);
const dates=perf.windowDates('2026-09-22');
assert.equal(dates.length,30);
assert.equal(dates[0],'2026-09-22');
assert.equal(dates.at(-1),'2026-08-24');
assert.equal(new Set(dates).size,30);

const day={
  venue:'TEST',venueCode:'99',date:'2026-09-21',
  rows:[
    {race:1,actual:'1-2-3',payout100:1630,programOnly:{picks:['1-2-3','1-2-4','1-3-2','1-3-4'],hit:true,modelVersion:'M1',generatedAt:'2026-09-20T00:00:00Z'}},
    {race:2,actual:'2-1-3',payout100:920,programOnly:{picks:['1-2-3','1-2-4','1-3-2','1-3-4'],hit:false,modelVersion:'M1',generatedAt:'2026-09-20T00:00:00Z'}},
    {race:3,actual:'3-1-2',payout100:5000,classBaseline:{picks:['3-1-2']}}
  ]
};
const rows=perf.normalizeDay(day,{date:'2026-09-21',venueCode:'99'});
assert.equal(rows.length,2,'Rows without PROGRAM_ONLY must not enter the record');
assert.equal(rows[0].stake,400);
assert.equal(rows[0].returns,1630);
assert.equal(rows[0].profit,1230);
assert.equal(rows[1].returns,0);
assert.equal(rows[1].profit,-400);

const a=perf.aggregate(rows);
assert.deepEqual(
  {races:a.races,hits:a.hits,stake:a.stake,returns:a.returns,profit:a.profit},
  {races:2,hits:1,stake:800,returns:1630,profit:830}
);
assert.equal(a.hitRate,0.5);
assert.equal(a.roi,1630/800);

const grouped=perf.groupDays([
  ...rows,
  {...rows[0],date:'2026-09-20',race:4}
]);
assert.equal(grouped.length,2);
assert.equal(grouped[0].date,'2026-09-21');
assert.equal(grouped[1].date,'2026-09-20');

assert.equal(perf.normalizeDay({...day,date:'2026-09-20'},{date:'2026-09-21',venueCode:'99'}).length,0);
assert.equal(perf.normalizeDay(day,{date:'2026-09-21',venueCode:'98'}).length,0);

console.log('VENUE_PERFORMANCE_30D_CONTRACT_PASS');
