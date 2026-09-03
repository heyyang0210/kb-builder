Created by 文博浩, last modified on 八月 23, 2023

##   [1. Overview（概述）](#1-overview概述)  

如果Geometry是空几何图形，则返回true。

语法：

```
ST_IsEmpty(geometry geomA) return boolean

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 如果GEOMETRYCOLLECTION里全是空几何图形，则返回true


参数类型：geometry

返回类型：boolean

Null值：参数为null返回null

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
geomIsEmpty()
commonGeomValidate()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

有些坐标有nan值的情况Empty判定与postgis不同，是因为GEOS把nan解析成了Empty。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

调用已经实现的piGeomIsEmpty接口。

```
bool piGeomIsEmpty(const Geometry* geom)
{
    switch (geom-&gt;type) {
        case YAS_GEOM_POINT:
            return pointIsEmpty((const GeomPoint*)geom);
        case YAS_GEOM_LINE:
            return lineStringIsEmpty((const GeomLineString*)geom);
        case YAS_GEOM_POLYGON:
            return polygonIsEmpty((const GeomPolygon*)geom);
        case YAS_GEOM_MPOINT:
        case YAS_GEOM_MLINE:
        case YAS_GEOM_MPOLYGON:
        case YAS_GEOM_COLLECTION:
            return collectionIsEmpty((const GeomCollection*)geom);
        default:
            return false;
    }
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

ST_IsEmpty

##   [9. TODO（遗留问题）](#9-todo遗留问题)  