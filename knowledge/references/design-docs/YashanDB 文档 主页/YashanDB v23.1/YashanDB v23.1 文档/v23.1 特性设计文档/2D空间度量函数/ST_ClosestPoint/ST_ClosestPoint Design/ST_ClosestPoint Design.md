Created by 胡威振, last modified on 六月 30, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_ClosestPoint函数的功能是：返回geom1上最接近geom2的2D点，这个点不一定是输入几何图形的端点。这是从一个几何图形到另一个几何图形的最短直线的第一个点((由ST_ShortestLine计算))。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 如果计算结果是一个EMPTY，则会返回POINT EMPTY，不会返回NULL。
- 输入为null则返回null。


#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_ClosestPoint(geom1 geometry, geom2 geometry);

```

- udf


```
create or replace function MDSYS.ST_CLOSESTPOINT(geom1 in ST_GEOMETRY, geom2 in ST_GEOMETRY) return ST_GEOMETRY is
    geom ST_GEOMETRY;
    head raw(40);
    ewkb blob;
begin
    SYS.GEOMETRY.ST_CLOSESTPOINT(geom1.head, geom1.geom, geom2.head, geom2.geom, head, ewkb);
    if ewkb is null then
        return null;
    end if;
    geom := new ST_GEOMETRY(head, ewkb);
    return geom;
end;
/

create or replace public synonym ST_CLOSESTPOINT for MDSYS.ST_CLOSESTPOINT
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomClosestPoint()

```

#   [4. Details（详细设计）](#4-details详细设计)  

- 输入存在NULL，直接返回NULL。
- geom1与geom2的srid不同，拦截报错。
- 如果geom1或者geom2是集合类型，则会不断递归遍历geom1和geom2，直到拿到原子类型（Point、LineString、Polygon），如果原子类型是Empty，则直接返回。
- 如果两个geometry的外包括不重叠，并且两个子类型是LineString或者Polygon，则会走快捷路径，如果没有外包括则不走快速路径。


>   由于外包括不重叠，所以如果遇到Polygon，只需要将其外环与另外的geom进行比较即可。  

- 不走快捷路径的计算实际上有9种情况(三种原子类型两两组合)，计算完一次之后将计算的最短距离、最短线段的两个点的信息都保存下来，后续遍历会不断更新结果。
- MinDistance(Point, Point):


>   计算两点的距离，将两点的距离以及两个点保存下来。  

- MinDistance(Point, LineString):


>   由于点与线段的最短距离不一定是点到线段的端点，有可能最短距离的点在线段上，所以不能直接遍历点与LineString的点求最小距离，必须得遍历线段进行求解。  

>   将Point与LineString的每个线段进行比较，求出Point到每个线段的最小距离，不断更新最小距离和两个点。  

>   点与线段的计算过程是根据数学公式可以判断出点与线段、线段的两个点之间的关系，比如点在线段上、在线段的哪个方向的延长线上、距离线段的哪个点近，最终也是求点与最近点的距离。  

- MinDistance(Point, Polygon)：


>   Point与Polygon有三种位置关系：Point在Polygon之外(在外环之外)、Point在Polygon上(在外环之内，内环之外)、Point在Polygon之内（在某个内环之内）。  

>   如果Point在Polygon之外，则可以直接计算MinDistance(Point, Polygon.rings[0])，即Point与Polygon外环的最小距离，此时实际上就转化成了Point与LineString的计算过程。  

>   遍历Polygon的内环，如果Point在某个内环(ring)上或者在该内环(ring)内部，则最终结果为MinDistance(Point, ring)，实际上也转化成了Point与LineString的计算过程。  

>   如果遍历完了Polygon的内环，Point在所有内环外部，则说明Point在Polygon上，所以最短距离为0，最终结果的两个点就是Point。  

- MinDistance(LineString, Point)：


>   计算过程如同MinDistance(Point, LineString)，设置标志位表明颠倒顺序，最终结果的距离不变，两个点的顺序发生变化。  

- MinDistance(LineString, LineString)：


>   遍历两个线的每个线段，逐个对比，求两个线段之间的最短距离以及最短距离的两个点，每次对比都会与已经保存下来的最短距离进行比较，如果比之前的小，则会更新。  

>   两个线段的位置关系有4种：平行、共线、相交、不相交也不平行。求线段（seg1）与线段（seg2）的最短距离的过程：  

>   如果seg1的两个点是相同的，则转换成求点与线段的最短距离，计算过程如上。  

>   如果seg2的两个点是相同的，则也转换成求点与线段的最短距离，计算过程如上（此时颠倒顺序，需要对标记为做调整）。  

>   根据数学公式计算seg1和seg2的空间关系。  

>   如果seg1与seg2平行或共线或不相交，则计算四个值，seg1两个点分别与seg2线段的最短距离、seg2两个点分别与seg1线段的最短距离（计算过程会更新最小值）。  

>   如果seg1与seg2相交，则最短距离就是0，此时只需要求出交点。  

- MinDistance(LineString, Polygon)：


>   选取LineString上的任意一点作为参考（这里选取第一个点）。如果这个点在Polygon之外，则最终结果一定是LineString与Polygon的外环之间最短距离。此时转化成求MinDistance(LineString, LineString)。  

>   否则，则说明这个点在Polygon外环之内，逐个遍历Polygon的内环，不断计算LineString与Polygon内环的最短距离（计算过程中不断更新最小值，如果发现最小值等于0了，此时可以直接提前退出）。  

>   第二步遍历过程不一定是最终结果，因为LineString可能位于Polygon上，所以需要进一步判断，遍历所有内环，判断刚刚选取的那个点与内环的关系，如果在某个内环内，则说明刚刚的结果是正确的，直接返回。  

>   如果判断完点与内环的关系发现不在任何内环内，则说明这个点在Polygon，这个点在Polygon上，则最短距离肯定是0，最终结果就是这个点。  

- MinDistance(Polygon, Point)。


>   计算过程如同MinDistance(Point, Polygon)，设置标志位表明颠倒顺序，最终结果的距离不变，两个点的顺序发生变化。  

- MinDistance(Polygon，LineString)：


>   计算过程如同MinDistance(LineString, Polygon)，设置标志位表明颠倒顺序，最终结果的距离不变，两个点的顺序发生变化。  

- MinDistance(Polygon1, Polygon2)：


>   选取Polygon上的任意一点作为参考（这里选取第一个点，即Polygon1->Point1, Polygon2->Point2），如果Point1在Polygon2之外，并且Point2在Polygon1之外，则最终结果一定是两个Polygon的外环之间的最短距离。  

>   否则，遍历Polygon1的内环，如果Point2在Polygon1的某个内环内，则最终结果一定是Polygon2的外环与这个内环的最短距离。  

>   否则，遍历Polygon2的内环，如果Point1在Polygon2的某个内环内，则最终结果一定是Polygon1的外环与整个内环的最短距离。  

>   如果上述都不成立，则说明其中一个一个点是在另一个Polygon上，最短距离为0。  

#   [5. Restrict（限制）](#5-restrict限制)  

- 对于非法数据的输入（包括超出精度的输入，如inf、nan等）不保证结果的可靠性。


#   [6. Example（用例）](#6-example用例)  

- Empty


```
SQL&gt; select ST_AsText(ST_ClosestPoint(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY'))) from dual;

ST_ASTEXT(ST_CLOSEST                                             
---------------------------------------------------------------- 
POINT EMPTY                                                     

1 row fetched.


```

- Point


```
SQL&gt; select ST_AsText(ST_ClosestPoint(ST_GeomFromText('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))'))) from dual;

ST_ASTEXT(ST_CLOSEST                                             
---------------------------------------------------------------- 
POINT (0.000000000000000 0.000000000000000)                     

1 row fetched.


```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_ClosestPoint.html](https://postgis.net/docs/manual-3.3/ST_ClosestPoint.html)  

**附录：**  点P与线段AB的五种关系。



## Attachments:

[image2023-6-21_9-58-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGE4OTcwYzJhZjRmNTFmYmFmIiwicmVmX2lkIjoiNjczOTZhMGE1OTNmOTljOWZmMjM1NTBhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwOTkxLCJleHAiOjE3ODIyOTczOTF9.xfuVm7ORuv1FVyVU9cSbrpWYcIwL_T51xvb0i2hDqGQ)

 (image/png)    
