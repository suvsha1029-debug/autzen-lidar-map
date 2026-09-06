"""Reproduce the cropped, sampled viewer data from the public PDAL Autzen LAZ."""
from pathlib import Path
import json, hashlib, sys
import numpy as np
import laspy
from pyproj import CRS, Transformer

source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('../lidar-source/autzen.laz')
out=Path(__file__).resolve().parents[1]/'public/data'
out.mkdir(parents=True,exist_ok=True)
parts=[]
with laspy.open(source) as f:
    original_count=f.header.point_count
    wkt=next(v.record_data.decode().strip('\x00') for v in f.header.vlrs if v.user_id=='liblas' and v.record_id==2112)
    crs=CRS.from_wkt(wkt)
    factor=crs.axis_info[0].unit_conversion_factor
    cx,cy=Transformer.from_crs(4326,crs,always_xy=True).transform(-123.0685,44.0583)
    # 850 m east-west by 800 m north-south, centered just south of the stadium.
    cy-=90/factor
    crop_count=0
    rng=np.random.default_rng(2026)
    for chunk in f.chunk_iterator(400000):
        x=np.asarray(chunk.x); y=np.asarray(chunk.y); z=np.asarray(chunk.z)
        mask=(abs(x-cx)<=425/factor)&(abs(y-cy)<=400/factor)
        crop_count+=int(mask.sum())
        ids=np.flatnonzero(mask)
        ids=ids[rng.random(len(ids))<.15]
        if not len(ids):continue
        records=np.empty((len(ids),7),dtype=np.float64)
        records[:,0]=(x[ids]-cx)*factor
        records[:,1]=z[ids]*factor
        records[:,2]=-(y[ids]-cy)*factor
        records[:,3]=np.asarray(chunk.red)[ids]
        records[:,4]=np.asarray(chunk.green)[ids]
        records[:,5]=np.asarray(chunk.blue)[ids]
        records[:,6]=np.asarray(chunk.classification)[ids]
        parts.append(records)
    points=np.concatenate(parts)
    if len(points)>650000:points=points[rng.choice(len(points),650000,replace=False)]
    rng.shuffle(points)
    low=float(points[:,1].min()); high=float(points[:,1].max())
    points[:,1]-=low
    rgb=points[:,3:6]
    if rgb.max()>255:rgb=rgb/257
    packed=np.empty(len(points),dtype=[('xyz','<f4',(3,)),('rgb','u1',(3,)),('class','u1')])
    packed['xyz']=points[:,:3]; packed['rgb']=np.clip(rgb,0,255).astype('uint8');packed['class']=points[:,6].astype('uint8')
    packed.tofile(out/'points.bin')
    classes,counts=np.unique(packed['class'],return_counts=True)
    metadata=dict(title='Autzen Stadium and surroundings',location='Eugene, Oregon, USA',pointCount=len(points),originalPointCount=original_count,croppedPointCount=crop_count,width=float(np.ptp(points[:,0])),depth=float(np.ptp(points[:,2])),minElevation=low,maxElevation=high,centerLongitude=-123.0685,centerLatitude=44.0583,sourceUrl='https://github.com/PDAL/data/blob/main/autzen/autzen.laz',downloadUrl='https://media.githubusercontent.com/media/PDAL/data/main/autzen/autzen.laz',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceCrsWkt=wkt,sourceUnit='international foot',metersPerSourceUnit=factor,localOriginSourceUnits=[cx,cy,low/factor],axes=['east meters','elevation meters above minElevation','south meters'],verticalDatum='Not explicitly stated in source WKT; elevations retain source Z converted from feet to meters.',sampling='Seeded 15 percent random sample within 850 x 800 meter crop; capped at 650000 returns. No interpolation.',binaryLayout='16 bytes per point: little-endian float32 east, height, south; uint8 red, green, blue, LAS classification',classCounts={str(int(k)):int(v) for k,v in zip(classes,counts)})
    (out/'metadata.json').write_text(json.dumps(metadata,indent=2))
    print(json.dumps({k:metadata[k] for k in ['pointCount','croppedPointCount','width','depth','minElevation','maxElevation','classCounts']},indent=2))
    assert (out/'points.bin').stat().st_size==len(points)*16
    assert np.isfinite(packed['xyz']).all()
    assert (packed['class']==2).any(), 'Ground classification missing'
