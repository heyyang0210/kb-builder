Created by 文博浩, last modified on 八月 22, 2023

##   [1. Overview（概述）](#1-overview概述)  

返回点的X/Y坐标。

语法：

```
ST_X(geometry a_point) return double

ST_Y(geometry a_point) return double

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 如果坐标值无效则返回NULL
- 输入必须是一个点，否则报错
- 支持3d，不会丢失z轴


参数类型：geometry

返回类型：double

Null值：参数为null返回null

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
geomX()
geomY()
commonGeomXY()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

```
YspiResult piGeomXY(YspiHandle hExec, const Geometry* geom, double* res, bool isX, bool* isNull)
{
    if (geom-&gt;type != YAS_GEOM_POINT) {
        yspiSetError(hExec, "argument must have type POINT");
        return YSPI_ERROR;
    }
    const GeomPoint* point = (GeomPoint*)geom;
    if (pointIsEmpty(point)) {
        *isNull = true;
        return YSPI_SUCCESS;
    }
    Point2D* point2D = (Point2D*)point-&gt;point;
    if (isX) {
        *res = point2D-&gt;x;
    } else {
        *res = point2D-&gt;y;
    }
    return YSPI_SUCCESS;
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

ST_X、ST_Y

##   [9. TODO（遗留问题）](#9-todo遗留问题)  