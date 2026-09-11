Created by 张欣, last modified on 五月 10, 2023

# 1.   **概述**

简要说明本功能/需求的背景，本文档的适用范围

# 2.   **需求分析**

geometry ST_Boundary(geometry geomA);

**函数作用**  ：  **根据输入的geometry对象返回对应的组合边界, 输出类型仍然是geometry。**

支持输入的geometry子类型：

- 点，多点输出GEOMETRYCOLLECTION EMPTY；
- 线的边界是端点；首尾闭合的线输出MULTIPOINT EMPTY；多线的输出是多点？ 
- 多边形的边界是内外边界的线性环，没有洞就是一个  LINEARRING，有洞则是MULTILINESTRING； 多多边形的边界是多线。


坐标输出顺序：  输出的点按照X坐标从负到正的顺序，Y坐标从负到正的顺序输出（X相等，则比较Y）；多边形的边界LINEARRING 点的顺序按多边形的点的顺序输出。

  


|输入|输出|和postgis差异|
|---|---|---|
|POINT|GEOMETRYCOLLECTION EMPTY|POINT EMPTY|
|MULTIPOINT|GEOMETRYCOLLECTION EMPTY|MULTIPOINT EMPTY|
|LINESTRING|MULTIPOINT|  
|
|LINEARRING,首尾闭合的LINESTRING|MULTIPOINT EMPTY|  
|
|MULTILINESTRING|MULTIPOINT|  
|
|POLYGON|LINEARRING，MULTILINESTRING|  
|
|MULTIPOLYGON|MULTILINESTRING|  
|
|GEOMETRYCOLLECTION 不支持|  
|  
|


限制：

不支持3维坐标，Z,M 坐标会被丢弃； 'POINT(0 1 1)' 和 'POINT(0 1 2)' 计算时认为是同一个点。

输入  geometry的SRID 不影响计算结果。构造数据时可以带上SRID.

特殊值：

1. null,空串，点线面 EMPTY, 多点多线多面中包含成员是EMPTY；
1. 线：除了首尾相接，折线，自相交的线；多线 成员有相同的线；
1. 多边形：没有‘洞’，有一个或多个‘洞’，  不合法  的多边形 ；多多边形，成员有相同的多边形。


  


# 3.   **测试设计方法**

场景分析，等价类。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[ST_Boundary.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Njc4OTcwYzJhZjRmNTFmN2ViIiwicmVmX2lkIjoiNjczOTY5Njc1OTNmOTljOWZmMjM0ZTRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTkwLCJleHAiOjE3ODIyMTM1OTB9.GF8hwpyZ1Yv976XpzM9cM7Hq2GyqmCfV4yv8RnvQRKY)

 (application/x-xmind)    
