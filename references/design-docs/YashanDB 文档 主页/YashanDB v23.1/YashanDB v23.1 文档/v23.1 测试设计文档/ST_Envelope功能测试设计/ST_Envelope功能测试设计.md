Created by 张欣, last modified on 六月 27, 2023

# 1.   **概述**

简要说明本功能/需求的背景，本文档的适用范围

# 2.   **需求分析**

geometry ST_Envelope(geometry geomA);

**函数作用**  ：  **根据输入的geometry对象返回一个最小外包矩形, 输出类型仍然是geometry。**

支持输入的geometry子类型：

- 点 单点返回仍然是点；多点返回矩形（  POLYGON  ）；
- 线，多线 返回矩形；特殊的 水平线，垂直线  也是返回矩形。（postgis退化成线）
- 多边形、   多多边形  返回矩形
- GEOMETRYCOLLECTION 


坐标输出顺序：  逆时针    ((  MINX  ,   MINY  ),(  MAXX  ,   MINY  ), (  MAXX  ,   MAXY  ), (  MINX  ,   MAXY  )  ,    (  MINX  ,   MINY  ))

  


|输入|输出|特殊值|和postgis差异|
|---|---|---|---|
|POINT|POINT|  
|  
|
|MULTIPOINT|矩形|重合的多点，重合完是一个点|  
|
|LINESTRING|矩形|水平线，垂直线,LINEARRING,首尾闭合的LINESTRING|  
|
|MULTILINESTRING|矩形|  
|  
|
|POLYGON|矩形|矩形,没有‘洞’，有一个或多个‘洞’,不合法  的多边形 |  
|
|MULTIPOLYGON|矩形|  
|  
|
|GEOMETRYCOLLECTION |矩形|点 点/多点：不重合，部分重合，重合,点 线/多线：在线上，在线外,点 线 面：contain，cover，cross等|  
|


限制：

不支持3维坐标，Z,M 坐标会被丢弃； 'POINT(0 1 1)' 和 'POINT(0 1 2)' 计算时任务是同一个点。

输入  geometry的SRID 不影响计算结果。

特殊值：

1. null,空串 ,返回null
1. 点线面 EMPTY,   返回point empty
1. 多点多线多面中包含成员是EMPTY；–跳过EMPTY的成员？
1. double边界值；nan,inf


  


# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

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

[ST_Envelope.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjdhMWFkOWEzMzExZGM3NjYyIiwicmVmX2lkIjoiNjczOTY5Njc3MjgyMDZlZmI5MmVmMmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTk0LCJleHAiOjE3ODIyMTM1OTR9.MlqTp_daWNCHk5sGsAxiJf1YlajHWawn0o8A-3EuwGg)

 (application/x-xmind)    
