Created by 文博浩, last modified on 八月 22, 2023

##   [1. Overview（概述）](#1-overview概述)  

检查Geometry值是否简单。

语法：

```
ST_IsSimple(geometry geomA) return boolean

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 由OGC SFS规范定义
- 每种几何类型的简单性如下：
    - Point：简单
    - MultiPoint：每个点唯一，则简单
    - LineString：除了端点，不经过同一点两次，则简单
    - MultiLineString：如果所有元素都是简单的，并且任意两个元素之间的唯一交集出现在两个元素的边界上时，则简单
    - Polygon：是由线性环构成的，所以多边形有效时，则简单
    - MultiPolygon：如果所有元素都是简单的，则简单
    - GeometryCollection：如果所有元素都是简单的，则简单
    - Empty：简单
- 支持3d，不会丢失z轴


参数类型：geometry

返回类型：boolean

Null值：参数为null返回null

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
geomIsSimple()
commonGeomValidate()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

GEOS库函数GEOSisSimple_r()入参多点、多线、多多边形、几何集合中有EMPTY值会core，postgis也会core，暂时遗留，等实现我们的geometry到GEOS geometry转换，可以通过在我们的geometry里把EMPTY值去掉规避这个问题。

GEOS实现：

```
bool
IsSimpleOp::computeSimple(const Geometry&amp; geom)
{
    if (geom.isEmpty()) return true;
    switch(geom.getGeometryTypeId()) {
        case GEOS_MULTIPOINT:
            return isSimpleMultiPoint(dynamic_cast&lt;const MultiPoint&amp;&gt;(geom));
        case GEOS_LINESTRING:
            return isSimpleLinearGeometry(geom);
        case GEOS_MULTILINESTRING:
            return isSimpleLinearGeometry(geom);
        case GEOS_LINEARRING:
            return isSimplePolygonal(geom);
        case GEOS_POLYGON:
            return isSimplePolygonal(geom);
        case GEOS_MULTIPOLYGON:
            return isSimplePolygonal(geom);
        case GEOS_GEOMETRYCOLLECTION:
            return isSimpleGeometryCollection(geom);
        // all other geometry types are simple by definition
        default:
            return true;
    }
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

ST_IsSimple

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

入参多点、多线、多多边形、几何集合中有EMPTY值会core