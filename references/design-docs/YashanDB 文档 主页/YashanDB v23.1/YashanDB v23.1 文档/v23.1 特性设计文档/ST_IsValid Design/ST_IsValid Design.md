Created by 文博浩, last modified on 八月 22, 2023

##   [1. Overview（概述）](#1-overview概述)  

检查Geometry值在2d中的有效性。

语法：

```
ST_IsValid(geometry geomA) return boolean

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 由OGC SFS规范定义
- 每种几何类型的有效性如下：
    - Point：有效
    - MultiPoint：有效
    - LineString：有效
    - MultiLineString：有效
    - Polygon：如果违反以下规则，那么对应的单多边形就不是有效的。
        - 多边形的环必须闭合
        - 内环应该处于外环的内部
        - 环不能自相交（它们不能相互接触，也不能交叉）
        - 环不能与其他环接触，除非在某个点相切（只能有一个在一个点相切）
    - MultiPolygon：如果所有元素都是有效的，则有效
    - GeometryCollection：如果所有元素都是有效的，则有效
    - Empty：有效
- 对于3维和4维几何形状，有效性仍然仅在2维中检查
- 对于无效的几何图形，返回false，不报错


参数类型：geometry

返回类型：boolean

Null值：参数为null返回null

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
geomIsValid()
commonGeomValidate()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

由于已经实现的piGeomIsValid接口处理了inf值，此函数不需要处理inf，其他函数是为了防止在GEOS库core掉，不更改piGeomIsValid，调用GEOS库GEOSisValid_r()接口。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

ST_IsValid

##   [9. TODO（遗留问题）](#9-todo遗留问题)  