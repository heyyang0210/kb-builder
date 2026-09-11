Created by 李思语, last modified on 十一月 15, 2024

-   [](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-)  
-   [1. 概述](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-1.概述)  
-   [2. 需求分析](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-2.2应用场景)  
    -   [2.3 规格约束](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-2.3规格约束)  
    -   [2.4 PROJ.4简介](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-2.4PROJ.4简介)  
-   [3. 详细测试设计](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-3.2详细测试设计)  
        -   [3.2.1 等价类划分](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-3.2.1等价类划分)  
        -   [3.2.2 场景测试](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-3.2.2场景测试)  
        -   [3.2.3 DFX](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-3.2.3DFX)  
        -   [4. 测试用例](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-4.测试用例)  
-   [5. 测试框架设计](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD34612ST_Transform(geometrygeom,textfrom_proj,integerto_srid)测试设计-7.工作量评估)  


# 1. 概述

本文描述ST_Transform(geometry geom, text from_proj, integer to_srid)测试设计。

SR:     [https://pingcode.yasdb.com/pjm/items/6718671ce489dd0868fcc078](https://pingcode.yasdb.com/pjm/items/6718671ce489dd0868fcc078)    ?    
  #YDBRD-34612 【GIS】支持ST_MakeValid、ST_CollectionExtract、ST_Centroid、ST_PointOnSurface、ST_Transform函数

# 2. 需求分析

## 2.1 功能点分析

**ST_Transform(geometry geom, text from_proj, integer to_srid) **  函数的  作用是将     geom 参数中的几何数据从 from_proj     指定的坐标参考系统（通常通过 PROJ.4 语法表示）转换为目标 SRID（  to_srid  ）指定的坐标系统。

语法：

```
ST_Transform(
   geometry geom,
   varchar from_proj,
   integer to_srid) 
RETURN geometry; 

```

## 2.2 应用场景

常用于地理信息系统(GIS)中，将地理数据从一个坐标系统转换到另一个坐标系统，以便进行空间分析和地图制作。

## 2.3 规格约束

|参数名|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|
|geometry|geometry|是|输入的几何对象|- 可以没有srid或在系统表spatial_ref_sys中没有定义
- 输入NULL，函数返回NULL
|
|from_proj|varchar|是|输入几何对象的原始空间参考|- 字符是  PROJ.4字符串
- 输入NULL，函数返回NULL
|
|to_srid|integer|是|目标空间参考系统的SRID标识符|- 必须在系统表spatial_ref_sys中定义
- 输入NULL，函数返回NULL
|


## 2.4 PROJ.4简介

PROJ.4是一个开源的地图投影库，广泛用于GIS中地图投影和坐标转换。它支持在不同的地理坐标系统之间进行转换。

PROJ.4的参数格式是一种文本字符串，通过不同的参数灵活定义不同的投影和坐标系，使得地理数据能够在不同的坐标系统之间转换。

|常用参数|描述|示例|
|---|---|---|
|+proj|投影的类型|+proj=latlong :表示经纬度，顺序是(纬度，经度),+proj=longlat :表示经纬度，顺序是(经度，纬度),+proj=utm：表示UTM(Universal Transverse Mercator)投影,+proj=merc：表示墨卡托投影,+proj=aea：表示等面积投影(Albers Equal Area)|
|+lon_0|中央经线，单位是度|+lon_0=-96：表示中央经线设为-96度|
|+lat_0|纬度原点，单位是度|+lat_0=50：表示原点纬度设置为50度|
|+k 或 +k_0|投影比例因子，用于控制投影坐标与地理坐标之间的尺度关系，默认值为1|+k_0=0.9996（这是UTM投影的标准值）|
|+units|坐标轴单位|+units=m：表示单位为米,+units=deg：表示单位为度|
|+lat_ts|真北方向，该参数定义了原点纬度|  
|
|+x_0 +y_0|坐标系的地理范围，这些参数通常用于设置原点在投影坐标系中的位置|  
|
|+datum|地球参考系统|+datum=WGS84：指定WG84地球参考系统，GPS及很多全球坐标系统使用的参考系,+datum=NAD83：表示北美 Datum 1983|
|+a +b +es|椭球参数：+a 椭球体的长半轴长度，+b 椭球体的短半轴长度，+es 椭球体的偏心率|  
|
|+no_defs|禁用默认的参数设置，确保仅使用用户指定的参数|  
|


```
+proj=lcc +lat_1=45.68333333333333 +lat_2=44.41666666666666 +lat_0=43.83333333333334 +lon_0=-100 +x_0=600000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs
```

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

主要采用等价类划分、场景法组合进行设计。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


### 3.2.1 等价类划分

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|部署形态|/|单机|仅支持在单机HEAP表中使用|- 集群
- 分布式
|拦截报错|
|参数校验|参数个数|3个|执行成功|0，1，4个|报错，提示正确|
|/|参数类型|- geometry：geometry
- from_proj：字符类型（可隐式转换为varhar类型）
- to_srid：数值类型（可隐式转换为int类型，小数四舍五入）
|  
|- geometry：非geometry类型
- from_proj：不可隐式转换为varchar类型
- to_srid：不可隐式转换为int类型
|报错，提示正确|
|/|参数传入方式|- 指定参数名称传参（参数名=>参数值，可无序传入参数）
- 直接传入参数（需按照参数顺序传参）
- 混合传参(指定参数名称+直接传入参数)
|  
|  
|  
|
|geometry参数值|子类型|- point
- linestring
- polygon
- multpoint
- multilienstring
- MultiPolygon
- geometry collection
|  
|- empty
- null
- 空串
|  
|
|/|坐标维度|- 1维、2维、3维、4维
|仅支持到三维坐标，如输入四维坐标则会忽略第四个坐标|  
|  
|
|/|坐标精度和范围|- double类型，doule有效精度15位，覆盖double边界值
- srid给定的坐标范围
|  
|- 特殊值：nan,inf,-inf
|  
|
|/|srid取值|- spatial_ref_sys 中记录的srid
- 在系统表spatial_ref_sys中没有定义的srid
- 特殊值：0，null
|  
|  
|  
|
|/|数据量|- 小数据量，小于1M常规测试
- 大数据量，1G等(通过导入测试）
|多点，多线，多面，集合类型 包含坐标点多|  
|  
|
|/|geometry来源|- 表中的geometry列
- 输入函数构造(WKT,WKB,GeoJson)
- 构造函数构造(ST_MakeLine,ST_MakePoint,ST_Point,ST_Polygon等)
- plsql中使用geometry变量
|  
|  
|  
|
|from_proj参数值|/|常量、变量,- spatial_ref_sys中记录的PROJ4TEXT
- 自定义的PROJ.4格式的字符
|  
|- 非PROJ.4格式的字符串
- null、空串、空格字符
- 超过varchar类型长度字符
- 不能转成varchar类型的常量、变量
|  
|
|to_srid参数值|/|- spatial_ref_sys 中记录的srid
- 可以转成有效srid的小数（四舍五入）、字符串、其他数据类型
|  
|- 在系统表spatial_ref_sys中没有定义的srid或转换后不在这范围内的int值
- 0、  null、  负数
- 超过int边界值
- 不能转成int的数据类型，常量，变量
|  
|
|关键字校验|函数名称|- 名称拼写错误
- 名称大小写
- 创建同名对象名（udp，udf，procedure，table等）
|  
|  
|  
|
|/|删除函数|- 普通用户drop 函数
- sys用户drop 函数
|  
|  
|  
|
|转换方式|geometry和geography|- 同类之间转换
- 不同类之间相互转换
|  
|  
|  
|
|参考坐标系|proj.4 和 to_srid|- 大地坐标系
- 投影坐标系
- 地心坐标系
|4326-3857 转换较多|  
|  
|
|返回值校验|校验类型|- typeof校验类型
|  
|  
|  
|
|/|校验值|- 校验坐标的结果正确性，对比postgis；
|  
|- 转换失败的会报错
|  
|
|  
|转换后的geometry再参与运算|- 多次转换（ST_Transform多层嵌套）
- 计算空间关系（作为空间关系函数入参）
- 结合处理函数、属性访问函数
|  
|  
|  
|


### **3.2.2 场景测试**

|输入条件|等价类|  
|
|---|---|---|
|PLSQL|- 匿名块中调用，使用函数给变量赋值
- 动态执行、绑定参数
- 与触发器结合：  函数入参使用new,old值
- 与forall、select ... bulk into、select ... into、insert ... into return ... into、游标语句结合
|选测，非重点|
|DQL|- 作为select投影列返回
- 作为where条件：  where func(col1) = xx、where col1 = func(xx)
- 结合join：  作为join投影列、作为join条件（on,where）
- 结合in/not in/exists/not exist/between and/like/not like/  any/all/some/is null/is not null等子查询
- 结合group by分组(聚合函数和窗口函数)
- 结合order by：  order by函数表达式、order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
- 结合distinct
- 参与运算：+ - * /  > < >= <=  and or
|选测，非重点|
|DDL|- create时作为列的默认值
- alter时作为列的default默认值
- create view as select 函数
- create table as select 函数
|选测，非重点|
|DML|- update
- delete
- insert
- merge
|选测，非重点|


### 3.2.3 DFX

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


### 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Comments:

|  [](null)  ,proj字符串构造来源：,1.系统表查询–一般有效,2.自定义构造-有效的（等同于系统表查询的，调整参数顺序）,3.无效proj.4--能否正确返回错误信息,Posted by lisiyu at 十一月 14, 2024 16:08|
|---|
